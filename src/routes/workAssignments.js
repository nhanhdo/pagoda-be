const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { WorkAssignment, Personnel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { personnelId, status, priority } = req.query;
    const where = {};
    if (personnelId) where.personnelId = personnelId;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const assignments = await WorkAssignment.findAll({
      where,
      include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const assignment = await WorkAssignment.create({ ...req.body, assignedBy: req.user.id });
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin', 'truotri', 'thuki', 'truongban'), async (req, res) => {
  try {
    const assignment = await WorkAssignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Không tìm thấy công việc' });
    await assignment.update(req.body);
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const assignment = await WorkAssignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Không tìm thấy công việc' });
    await assignment.destroy();
    res.json({ message: 'Đã xóa công việc' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
