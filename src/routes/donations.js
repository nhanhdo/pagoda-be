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

    // This month
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const thisMonthAmount = await Donation.sum('amount', {
      where: { donationDate: { [Op.between]: [monthStart, monthEnd] } },
    }) || 0;

    res.json({ totalAmount, count, thisMonthAmount });
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
