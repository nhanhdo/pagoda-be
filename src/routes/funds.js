const express = require('express');
const { Fund, Donation, Expense } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { num, fundTotals } = require('../services/finance');

const router = express.Router();
router.use(authenticate);

const FINANCE = ['admin', 'truotri', 'thuki'];
const pick = (b) => {
  const out = {};
  ['name', 'description', 'targetAmount', 'color', 'sortOrder', 'isActive'].forEach(k => { if (b[k] !== undefined) out[k] = b[k]; });
  if (out.targetAmount === '' ) out.targetAmount = null;
  return out;
};

// Any authenticated user may read the fund list (needed for the donation form);
// totals are only included for finance roles.
router.get('/', async (req, res) => {
  try {
    const where = req.query.active === 'true' ? { isActive: true } : {};
    const funds = await Fund.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    const withTotals = FINANCE.includes(req.user.role);
    const totals = withTotals ? await fundTotals() : {};
    res.json(funds.map(f => {
      const base = f.toJSON();
      if (!withTotals) return base;
      const t = totals[f.id] || { income: 0, expense: 0, pendingExpense: 0, pendingCount: 0, balance: 0, donationCount: 0, expenseCount: 0 };
      const target = num(base.targetAmount);
      return { ...base, ...t, progress: target > 0 ? Math.min(1, t.income / target) : null };
    }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const data = pick(req.body);
    if (!data.name) return res.status(400).json({ message: 'Nhập tên quỹ' });
    const code = String(req.body.code || data.name)
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    if (await Fund.findOne({ where: { code } })) return res.status(400).json({ message: 'Mã quỹ đã tồn tại' });
    const fund = await Fund.create({ ...data, code });
    res.status(201).json(fund);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const fund = await Fund.findByPk(req.params.id);
    if (!fund) return res.status(404).json({ message: 'Không tìm thấy quỹ' });
    const data = pick(req.body);
    if (fund.code === Fund.DEFAULT_CODE && data.isActive === false) {
      return res.status(400).json({ message: 'Không thể ngừng Quỹ chung — đây là quỹ mặc định' });
    }
    await fund.update(data);
    res.json(fund);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const fund = await Fund.findByPk(req.params.id);
    if (!fund) return res.status(404).json({ message: 'Không tìm thấy quỹ' });
    if (fund.code === Fund.DEFAULT_CODE) return res.status(400).json({ message: 'Không thể xóa Quỹ chung' });
    const used = (await Donation.count({ where: { fundId: fund.id } })) + (await Expense.count({ where: { fundId: fund.id } }));
    if (used) return res.status(400).json({ message: 'Quỹ đã có giao dịch — hãy ngừng sử dụng thay vì xóa', inUse: true });
    await fund.destroy();
    res.json({ message: 'Đã xóa' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
