const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { BuddhistFollower } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type, status, region } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { dharmName: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }
    if (type) where.type = type;
    if (status) where.status = status;
    if (region) where.region = { [Op.like]: `%${region}%` };

    const { count, rows } = await BuddhistFollower.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['fullName', 'ASC']],
    });

    res.json({ total: count, page: parseInt(page), data: rows });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const count = await BuddhistFollower.count();
    const data = { ...req.body };
    data.code = data.code || `PT${String(count + 1).padStart(4, '0')}`;

    const follower = await BuddhistFollower.create(data);
    res.status(201).json(follower);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Mã phật tử đã tồn tại' });
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const follower = await BuddhistFollower.findByPk(req.params.id);
    if (!follower) return res.status(404).json({ message: 'Không tìm thấy phật tử' });
    await follower.update(req.body);
    res.json(follower);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const follower = await BuddhistFollower.findByPk(req.params.id);
    if (!follower) return res.status(404).json({ message: 'Không tìm thấy phật tử' });
    await follower.destroy();
    res.json({ message: 'Đã xóa' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
