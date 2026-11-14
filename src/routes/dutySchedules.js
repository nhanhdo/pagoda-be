const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { DutySchedule, Personnel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, personnelId, dutyType, status } = req.query;
    const where = {};

    if (startDate && endDate) {
      where.dutyDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.dutyDate = { [Op.gte]: startDate };
    }
    if (personnelId) where.personnelId = personnelId;
    if (dutyType) where.dutyType = dutyType;
    if (status) where.status = status;

    const schedules = await DutySchedule.findAll({
      where,
      include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName', 'photo'] }],
      order: [['dutyDate', 'ASC'], ['shift', 'ASC']],
    });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const schedule = await DutySchedule.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/bulk', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const { schedules } = req.body;
    const created = await DutySchedule.bulkCreate(
      schedules.map(s => ({ ...s, createdBy: req.user.id }))
    );
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const schedule = await DutySchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Không tìm thấy lịch trực' });
    await schedule.update(req.body);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const schedule = await DutySchedule.findByPk(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Không tìm thấy lịch trực' });
    await schedule.destroy();
    res.json({ message: 'Đã xóa lịch trực' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
