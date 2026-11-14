const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { sequelize, Donation, BuddhistFollower, Fund } = require('../models');
const { nextReceiptNo, defaultFundId, withRetry, likeOp, activeFund, num } = require('../services/finance');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Donation data (donors, amounts) is finance data: readable by the finance roles and trưởng ban (who can record donations).
const READ = ['admin', 'truotri', 'thuki', 'truongban'];
const EDITABLE = ['buddhistFollowerId', 'donorName', 'amount', 'donationDate', 'purpose', 'paymentMethod', 'receivedBy', 'fundId', 'notes'];
const METHODS = ['tiền_mặt', 'chuyển_khoản', 'khác'];

function pickEditable(body = {}) {
  const out = {};
  EDITABLE.forEach(k => { if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k]; });
  return out;
}

/** Returns an error message or null. */
function validateDonation(d, partial) {
  if (!partial || d.amount !== undefined) {
    if (!(num(d.amount) > 0)) return 'Số tiền cúng dường phải lớn hơn 0';
  }
  if (!partial || d.donationDate !== undefined) {
    if (!d.donationDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.donationDate).slice(0, 10))) return 'Chọn ngày cúng dường hợp lệ';
  }
  if (d.paymentMethod !== undefined && d.paymentMethod !== null && !METHODS.includes(d.paymentMethod)) return 'Hình thức cúng dường không hợp lệ';
  return null;
}

router.get('/', authorize(...READ), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, startDate, endDate, buddhistFollowerId, fundId } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      const like = { [likeOp()]: `%${search}%` };
      where[Op.or] = [
        { purpose: like },
        { donorName: like },
        { notes: like },
        { receiptNo: like },
        { '$buddhistFollower.fullName$': like },
        { '$buddhistFollower.dharmName$': like },
      ];
    }
    if (buddhistFollowerId) where.buddhistFollowerId = buddhistFollowerId;
    if (fundId) where.fundId = fundId;
    if (startDate && endDate) {
      where.donationDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.donationDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.donationDate = { [Op.lte]: endDate };
    }

    const { count, rows } = await Donation.findAndCountAll({
      where,
      include: [{
        model: BuddhistFollower,
        as: 'buddhistFollower',
        attributes: ['id', 'fullName', 'dharmName', 'code'],
        required: false,
      }, { model: Fund, as: 'fund', attributes: ['id', 'code', 'name', 'color'], required: false }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['donationDate', 'DESC'], ['createdAt', 'DESC']],
      subQuery: false,
      distinct: true,
    });

    res.json({ total: count, page: parseInt(page), data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/summary', authorize(...READ), async (req, res) => {
  try {
    const { startDate, endDate, fundId } = req.query;
    const where = {};
    if (fundId) where.fundId = fundId;
    if (startDate && endDate) {
      where.donationDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.donationDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.donationDate = { [Op.lte]: endDate };
    }

    const totalAmount = await Donation.sum('amount', { where }) || 0;
    const count = await Donation.count({ where });

    const anonymousCount = await Donation.count({
      where: {
        ...where,
        buddhistFollowerId: null,
        [Op.or]: [{ donorName: null }, { donorName: '' }],
      },
    });

    const methodRows = await Donation.findAll({
      where,
      attributes: ['paymentMethod', [sequelize.fn('SUM', sequelize.col('amount')), 'amount'], [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['paymentMethod'],
      raw: true,
    });
    const byMethod = methodRows.map(r => ({ method: r.paymentMethod, amount: Number(r.amount) || 0, count: Number(r.count) || 0 }));

    const fundRows = await Donation.findAll({
      where,
      attributes: ['fundId', [sequelize.fn('SUM', sequelize.col('amount')), 'amount'], [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['fundId'],
      raw: true,
    });
    const funds = await Fund.findAll({ attributes: ['id', 'name', 'color'], raw: true });
    const byFund = fundRows.map(r => {
      const fd = funds.find(x => x.id === r.fundId);
      return { fundId: r.fundId, name: fd?.name || '—', color: fd?.color, amount: Number(r.amount) || 0, count: Number(r.count) || 0 };
    });

    // Month bounds as local calendar dates (toISOString would shift to UTC and drop the last day)
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date();
    const monthSum = async (offset) => {
      const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
      return await Donation.sum('amount', { where: { donationDate: { [Op.between]: [ymd(start), ymd(end)] } } }) || 0;
    };
    const thisMonthAmount = await monthSum(0);
    const lastMonthAmount = await monthSum(-1);

    res.json({ totalAmount, count, thisMonthAmount, lastMonthAmount, anonymousCount, byMethod, byFund });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

async function syncFollowerContribution(buddhistFollowerId) {
  if (!buddhistFollowerId) return;
  const total = await Donation.sum('amount', { where: { buddhistFollowerId } }) || 0;
  await BuddhistFollower.update({ contributionAmount: total }, { where: { id: buddhistFollowerId } });
}

router.post('/', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const body = pickEditable(req.body);
    const err = validateDonation(body, false);
    if (err) return res.status(400).json({ message: err });
    const fundId = body.fundId || await defaultFundId();
    if (!(await activeFund(fundId))) return res.status(400).json({ message: 'Quỹ không tồn tại hoặc đã ngừng sử dụng' });
    // Retry regenerates the receipt number if another request took it first
    const donation = await withRetry(() => sequelize.transaction(async (transaction) => {
      const receiptNo = await nextReceiptNo(body.donationDate, transaction);
      return Donation.create({ ...body, fundId, receiptNo }, { transaction });
    }));
    await syncFollowerContribution(donation.buddhistFollowerId);
    res.status(201).json(donation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const donation = await Donation.findByPk(req.params.id);
    if (!donation) return res.status(404).json({ message: 'Không tìm thấy' });
    const oldFollowerId = donation.buddhistFollowerId;
    const body = pickEditable(req.body);
    const err = validateDonation(body, true);
    if (err) return res.status(400).json({ message: err });
    if (body.fundId === null) body.fundId = await defaultFundId();
    // A new fund must be active; keeping the current (possibly deactivated) fund is allowed
    if (body.fundId !== undefined && Number(body.fundId) !== donation.fundId && !(await activeFund(body.fundId))) {
      return res.status(400).json({ message: 'Quỹ không tồn tại hoặc đã ngừng sử dụng' });
    }
    await donation.update(body);
    const ids = [...new Set([oldFollowerId, donation.buddhistFollowerId].filter(Boolean))];
    for (const id of ids) await syncFollowerContribution(id);
    res.json(donation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const donation = await Donation.findByPk(req.params.id);
    if (!donation) return res.status(404).json({ message: 'Không tìm thấy' });
    const followerId = donation.buddhistFollowerId;
    await donation.destroy();
    await syncFollowerContribution(followerId);
    res.json({ message: 'Đã xóa' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
