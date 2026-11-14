const express = require('express');
const { Op } = require('sequelize');
const { Fund, Donation, Expense, BuddhistFollower } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { num, ymd, dateRange } = require('../services/finance');

const router = express.Router();
router.use(authenticate, authorize('admin', 'truotri', 'thuki'));

const APPROVED = 'đã_duyệt';
const fundWhere = (fundId) => (fundId ? { fundId: Number(fundId) } : {});

async function sumBefore(startDate, fundId) {
  if (!startDate) return 0;
  const income = num(await Donation.sum('amount', { where: { ...fundWhere(fundId), donationDate: { [Op.lt]: startDate } } }));
  const expense = num(await Expense.sum('amount', { where: { ...fundWhere(fundId), status: APPROVED, expenseDate: { [Op.lt]: startDate } } }));
  return income - expense;
}

/** Month keys "YYYY-MM" from start to end (inclusive), keeping the NEWEST 24; default = last 12 months. */
function monthKeys(startDate, endDate) {
  const end = endDate ? new Date(`${endDate}T00:00:00`) : new Date();
  let start = startDate ? new Date(`${startDate}T00:00:00`) : new Date(end.getFullYear(), end.getMonth() - 11, 1);
  const earliest = new Date(end.getFullYear(), end.getMonth() - 23, 1);
  if (start < earliest) start = earliest;
  const keys = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys.slice(-24);
}

router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate, fundId } = req.query;
    const fw = fundWhere(fundId);
    const donations = await Donation.findAll({ where: { ...fw, ...dateRange('donationDate', startDate, endDate) }, attributes: ['amount', 'donationDate', 'fundId'], raw: true });
    const expenses = await Expense.findAll({ where: { ...fw, status: APPROVED, ...dateRange('expenseDate', startDate, endDate) }, attributes: ['amount', 'expenseDate', 'fundId', 'category'], raw: true });

    const income = donations.reduce((s, d) => s + num(d.amount), 0);
    const expense = expenses.reduce((s, e) => s + num(e.amount), 0);
    const opening = await sumBefore(startDate, fundId);

    // Monthly series (bucketed in JS so it works the same on SQLite and PostgreSQL)
    const keys = monthKeys(startDate, endDate);
    const monthsStart = `${keys[0]}-01`;
    const seriesDon = startDate ? donations : await Donation.findAll({ where: { ...fw, donationDate: { [Op.gte]: monthsStart } }, attributes: ['amount', 'donationDate'], raw: true });
    const seriesExp = startDate ? expenses : await Expense.findAll({ where: { ...fw, status: APPROVED, expenseDate: { [Op.gte]: monthsStart } }, attributes: ['amount', 'expenseDate'], raw: true });
    const monthly = keys.map(k => ({ month: k, income: 0, expense: 0 }));
    const idx = Object.fromEntries(keys.map((k, i) => [k, i]));
    seriesDon.forEach(d => { const i = idx[String(d.donationDate).slice(0, 7)]; if (i !== undefined) monthly[i].income += num(d.amount); });
    seriesExp.forEach(e => { const i = idx[String(e.expenseDate).slice(0, 7)]; if (i !== undefined) monthly[i].expense += num(e.amount); });

    const funds = await Fund.findAll({ order: [['sortOrder', 'ASC'], ['id', 'ASC']], raw: true });
    const byFund = funds.map(f => ({
      fundId: f.id, code: f.code, name: f.name, color: f.color,
      income: donations.filter(d => d.fundId === f.id).reduce((s, d) => s + num(d.amount), 0),
      expense: expenses.filter(e => e.fundId === f.id).reduce((s, e) => s + num(e.amount), 0),
    })).filter(f => !fundId || f.fundId === Number(fundId));

    const catMap = {};
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + num(e.amount); });
    const byCategory = Object.entries(catMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

    const pendingCount = await Expense.count({ where: { ...fw, status: 'chờ_duyệt' } });
    const pendingAmount = num(await Expense.sum('amount', { where: { ...fw, status: 'chờ_duyệt' } }));

    res.json({
      range: { startDate: startDate || null, endDate: endDate || null },
      totals: { income, expense, net: income - expense, opening, closing: opening + income - expense, donationCount: donations.length, expenseCount: expenses.length },
      monthly, byFund, byCategory, pendingCount, pendingAmount,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/ledger', async (req, res) => {
  try {
    const { fundId, startDate, endDate } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 10000);
    const fw = fundWhere(fundId);
    const fundInc = [{ model: Fund, as: 'fund', attributes: ['id', 'name', 'color'] }];

    const donations = await Donation.findAll({
      where: { ...fw, ...dateRange('donationDate', startDate, endDate) },
      include: [...fundInc, { model: BuddhistFollower, as: 'buddhistFollower', attributes: ['fullName', 'dharmName'], required: false }],
    });
    const expenses = await Expense.findAll({ where: { ...fw, status: APPROVED, ...dateRange('expenseDate', startDate, endDate) }, include: fundInc });

    const rows = [
      ...donations.map(d => ({
        key: `d-${d.id}`, kind: 'income', id: d.id, date: d.donationDate, code: d.receiptNo,
        party: d.buddhistFollower ? (d.buddhistFollower.dharmName ? `${d.buddhistFollower.fullName} (${d.buddhistFollower.dharmName})` : d.buddhistFollower.fullName) : (d.donorName || 'Ẩn danh'),
        description: d.purpose || '', income: num(d.amount), expense: 0, fund: d.fund, createdAt: d.createdAt,
      })),
      ...expenses.map(e => ({
        key: `e-${e.id}`, kind: 'expense', id: e.id, date: e.expenseDate, code: e.code,
        party: e.payee || '', description: e.description || e.category, category: e.category,
        income: 0, expense: num(e.amount), fund: e.fund, createdAt: e.createdAt,
      })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)) || new Date(a.createdAt) - new Date(b.createdAt));

    const opening = await sumBefore(startDate, fundId);
    let running = opening;
    rows.forEach(r => { running += r.income - r.expense; r.balance = running; });

    const total = rows.length;
    const data = rows.slice((page - 1) * limit, page * limit);
    res.json({ total, page, opening, closing: running, totalIncome: rows.reduce((s, r) => s + r.income, 0), totalExpense: rows.reduce((s, r) => s + r.expense, 0), data, today: ymd(new Date()) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
