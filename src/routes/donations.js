const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { sequelize, Donation, BuddhistFollower } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, startDate, endDate, buddhistFollowerId } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { purpose: { [Op.like]: `%${search}%` } },
        { donorName: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } },
        { '$buddhistFollower.fullName$': { [Op.like]: `%${search}%` } },
        { '$buddhistFollower.dharmName$': { [Op.like]: `%${search}%` } },
      ];
    }
    if (buddhistFollowerId) where.buddhistFollowerId = buddhistFollowerId;
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
      }],
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

router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
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

    res.json({ totalAmount, count, thisMonthAmount, lastMonthAmount, anonymousCount, byMethod });
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
    const donation = await Donation.create(req.body);
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
    await donation.update(req.body);
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
