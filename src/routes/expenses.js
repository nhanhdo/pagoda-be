const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Expense, Fund, User, Personnel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { num, nextExpenseCode, dateRange, fundBalance, withRetry, likeOp, activeFund } = require('../services/finance');

const router = express.Router();
router.use(authenticate, authorize('admin', 'truotri', 'thuki'));

const include = [
  { model: Fund, as: 'fund', attributes: ['id', 'code', 'name', 'color'] },
  { model: User, as: 'creator', attributes: ['id', 'username'], include: [{ model: Personnel, as: 'personnel', attributes: ['fullName', 'dharmName'] }] },
  { model: User, as: 'approver', attributes: ['id', 'username'], include: [{ model: Personnel, as: 'personnel', attributes: ['fullName', 'dharmName'] }] },
];

const editable = (b) => {
  const out = {};
  ['fundId', 'amount', 'expenseDate', 'category', 'payee', 'description', 'paymentMethod', 'notes'].forEach(k => { if (b[k] !== undefined) out[k] = b[k]; });
  return out;
};

function validate(data, partial = false) {
  if (!partial || data.amount !== undefined) {
    if (!(num(data.amount) > 0)) return 'Số tiền phải lớn hơn 0';
  }
  if (!partial || data.fundId !== undefined) { if (!data.fundId) return 'Chọn quỹ chi'; }
  if (!partial || data.expenseDate !== undefined) { if (!data.expenseDate) return 'Chọn ngày chi'; }
  if (data.category && !Expense.CATEGORIES.includes(data.category)) return 'Hạng mục không hợp lệ';
  if (data.paymentMethod && !Expense.METHODS.includes(data.paymentMethod)) return 'Hình thức không hợp lệ';
  return null;
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, fundId, status, category, startDate, endDate, search } = req.query;
    const where = { ...dateRange('expenseDate', startDate, endDate) };
    if (fundId) where.fundId = fundId;
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      const like = { [likeOp()]: `%${search}%` };
      where[Op.or] = [{ code: like }, { payee: like }, { description: like }];
    }
    const lim = Math.min(parseInt(limit, 10) || 10, 10000);
    const { count, rows } = await Expense.findAndCountAll({
      where, include, distinct: true,
      order: [['expenseDate', 'DESC'], ['id', 'DESC']],
      limit: lim, offset: (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim,
    });
    const pending = await Expense.count({ where: { status: 'chờ_duyệt' } });
    res.json({ total: count, page: parseInt(page, 10) || 1, pendingCount: pending, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await Expense.findByPk(req.params.id, { include });
    if (!row) return res.status(404).json({ message: 'Không tìm thấy phiếu chi' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = editable(req.body);
    const err = validate(data);
    if (err) return res.status(400).json({ message: err });
    if (!(await activeFund(data.fundId))) return res.status(400).json({ message: 'Quỹ không tồn tại hoặc đã ngừng sử dụng' });
    // Retry regenerates the voucher number if a concurrent request took it first
    const row = await withRetry(() => sequelize.transaction(async (transaction) => {
      const code = await nextExpenseCode(data.expenseDate, transaction);
      return Expense.create({ ...data, code, status: 'chờ_duyệt', createdBy: req.user.id }, { transaction });
    }));
    res.status(201).json(await Expense.findByPk(row.id, { include }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.errors?.[0]?.message || 'Lỗi server' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const row = await Expense.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy phiếu chi' });
    if (row.status !== 'chờ_duyệt') return res.status(400).json({ message: 'Chỉ sửa được phiếu đang chờ duyệt' });
    if (req.user.role !== 'admin' && row.createdBy !== req.user.id) return res.status(403).json({ message: 'Chỉ người lập phiếu hoặc admin được sửa' });
    const data = editable(req.body);
    const err = validate(data, true);
    if (err) return res.status(400).json({ message: err });
    if (data.fundId !== undefined && Number(data.fundId) !== row.fundId && !(await activeFund(data.fundId))) {
      return res.status(400).json({ message: 'Quỹ không tồn tại hoặc đã ngừng sử dụng' });
    }
    await row.update(data);
    res.json(await Expense.findByPk(row.id, { include }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.patch('/:id/approve', authorize('admin'), async (req, res) => {
  try {
    const row = await Expense.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy phiếu chi' });
    if (row.status !== 'chờ_duyệt') return res.status(400).json({ message: 'Phiếu không còn ở trạng thái chờ duyệt' });
    await row.update({ status: 'đã_duyệt', approvedBy: req.user.id, approvedAt: new Date(), rejectReason: null });
    const balance = await fundBalance(row.fundId);
    res.json({ expense: await Expense.findByPk(row.id, { include }), fundBalance: balance, negativeBalance: balance < 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.patch('/:id/reject', authorize('admin'), async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ message: 'Nhập lý do từ chối' });
    const row = await Expense.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy phiếu chi' });
    if (row.status !== 'chờ_duyệt') return res.status(400).json({ message: 'Phiếu không còn ở trạng thái chờ duyệt' });
    await row.update({ status: 'từ_chối', approvedBy: req.user.id, approvedAt: new Date(), rejectReason: reason });
    res.json(await Expense.findByPk(row.id, { include }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const row = await Expense.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy phiếu chi' });
    // Approved vouchers are part of the books and can't be deleted; record a correcting entry instead.
    if (row.status === 'đã_duyệt') {
      return res.status(400).json({ message: 'Phiếu chi đã duyệt không thể xóa vì đã ghi vào sổ quỹ' });
    }
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && !(row.createdBy === req.user.id && row.status === 'chờ_duyệt')) {
      return res.status(403).json({ message: 'Chỉ admin, hoặc người lập khi phiếu còn chờ duyệt, được xóa' });
    }
    await row.destroy();
    res.json({ message: 'Đã xóa' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
