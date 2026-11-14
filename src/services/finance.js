// Shared finance helpers: document numbering, local dates, fund totals.
const { Op } = require('sequelize');
const { sequelize, Fund, Donation, Expense } = require('../models');

const num = (v) => Number(v) || 0;
const pad = (n, w = 4) => String(n).padStart(w, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
const yearOf = (dateStr) => String(dateStr || ymd(new Date())).slice(0, 4);

/** Next "PREFIX-YYYY-####" number for the given model/column, unique per year. */
async function nextCode(model, column, prefix, dateStr, transaction) {
  const year = yearOf(dateStr);
  const like = `${prefix}-${year}-%`;
  const rows = await model.findAll({ where: { [column]: { [Op.like]: like } }, attributes: [column], raw: true, transaction });
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r[column]).split('-').pop(), 10) || 0), 0);
  return `${prefix}-${year}-${pad(max + 1)}`;
}

/**
 * Runs fn (normally a whole sequelize.transaction) again when two writers race for the same
 * document number (unique violation) or SQLite reports the database as busy/locked.
 * fn must regenerate its numbers on each call.
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function isRetryable(e) {
  if (!e) return false;
  if (e.name === 'SequelizeUniqueConstraintError') return true;
  const code = e.parent?.code || e.original?.code || e.code;
  if (code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || code === '40001' || code === '40P01') return true;
  return /SQLITE_BUSY|database is locked/i.test(e.message || '');
}
async function withRetry(fn, attempts = 8) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts - 1 || !isRetryable(e)) throw e;
      await sleep(Math.min(25 * 2 ** i, 800) + Math.random() * 50);
    }
  }
}

/** Case-insensitive LIKE operator for the current dialect (PostgreSQL LIKE is case-sensitive). */
const likeOp = () => (sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like);

const nextReceiptNo = (dateStr, t) => nextCode(Donation, 'receiptNo', 'PT', dateStr, t);
const nextExpenseCode = (dateStr, t) => nextCode(Expense, 'code', 'PC', dateStr, t);

async function defaultFundId(transaction) {
  const f = await Fund.findOne({ where: { code: Fund.DEFAULT_CODE }, transaction });
  return f ? f.id : null;
}

function dateRange(field, startDate, endDate) {
  if (startDate && endDate) return { [field]: { [Op.between]: [startDate, endDate] } };
  if (startDate) return { [field]: { [Op.gte]: startDate } };
  if (endDate) return { [field]: { [Op.lte]: endDate } };
  return {};
}

/** Per-fund totals: income (all donations), approved expense, pending expense, balance. */
async function fundTotals() {
  const income = await Donation.findAll({
    attributes: ['fundId', [sequelize.fn('SUM', sequelize.col('amount')), 'total'], [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['fundId'], raw: true,
  });
  const exp = await Expense.findAll({
    attributes: ['fundId', 'status', [sequelize.fn('SUM', sequelize.col('amount')), 'total'], [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['fundId', 'status'], raw: true,
  });
  const map = {};
  const get = (id) => (map[id] = map[id] || { income: 0, donationCount: 0, expense: 0, pendingExpense: 0, pendingCount: 0, expenseCount: 0 });
  income.forEach(r => { const m = get(r.fundId); m.income += num(r.total); m.donationCount += num(r.count); });
  exp.forEach(r => {
    const m = get(r.fundId);
    if (r.status === 'đã_duyệt') { m.expense += num(r.total); m.expenseCount += num(r.count); }
    if (r.status === 'chờ_duyệt') { m.pendingExpense += num(r.total); m.pendingCount += num(r.count); }
  });
  Object.values(map).forEach(m => { m.balance = m.income - m.expense; });
  return map;
}

async function fundBalance(fundId, transaction) {
  const income = num(await Donation.sum('amount', { where: { fundId }, transaction }));
  const expense = num(await Expense.sum('amount', { where: { fundId, status: 'đã_duyệt' }, transaction }));
  return income - expense;
}

/** Active fund by id → fund or null. */
async function activeFund(fundId, transaction) {
  const id = parseInt(fundId, 10);
  if (!id) return null;
  const f = await Fund.findByPk(id, { transaction });
  return f && f.isActive !== false ? f : null;
}

module.exports = {
  num, ymd, nextCode, nextReceiptNo, nextExpenseCode, defaultFundId, dateRange, fundTotals, fundBalance,
  withRetry, isRetryable, likeOp, activeFund,
};
