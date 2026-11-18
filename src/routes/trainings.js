const express = require('express');
const router = express.Router();
const { Training, TrainingParticipant, Personnel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const trainings = await Training.findAll({
      where,
      include: [{
        model: TrainingParticipant,
        as: 'participants',
        include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName'] }],
      }],
      order: [['startDate', 'DESC']],
    });
    res.json(trainings);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const training = await Training.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(training);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);
    if (!training) return res.status(404).json({ message: 'Không tìm thấy khóa học' });
    await training.update(req.body);
    res.json(training);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/:id/participants', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const { personnelIds = [] } = req.body;
    const training = await Training.findByPk(req.params.id, { attributes: ['id', 'maxParticipants'] });
    if (!training) return res.status(404).json({ message: 'Không tìm thấy khóa học' });
    // No unique index on (trainingId, personnelId), so ignoreDuplicates can't dedupe — filter existing enrolments here
    const existing = await TrainingParticipant.findAll({
      where: { trainingId: req.params.id },
      attributes: ['personnelId'],
      raw: true,
    });
    const enrolled = new Set(existing.map(e => e.personnelId));
    const toAdd = [...new Set(personnelIds)].filter(pid => !enrolled.has(pid));
    // Respect the course capacity (maxParticipants empty = unlimited)
    const max = Number(training.maxParticipants) || 0;
    if (max > 0 && existing.length + toAdd.length > max) {
      const left = Math.max(0, max - existing.length);
      return res.status(400).json({ message: left ? `Khóa học chỉ còn ${left} chỗ trống` : 'Khóa học đã đủ số học viên tối đa' });
    }
    const participants = await TrainingParticipant.bulkCreate(
      toAdd.map(pid => ({ trainingId: req.params.id, personnelId: pid, registrationDate: new Date() }))
    );
    res.status(201).json(participants);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id/participants/:participantId', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const participant = await TrainingParticipant.findByPk(req.params.participantId);
    if (!participant) return res.status(404).json({ message: 'Không tìm thấy học viên' });
    await participant.update(req.body);
    res.json(participant);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id/participants/:participantId', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const deleted = await TrainingParticipant.destroy({
      where: { id: req.params.participantId, trainingId: req.params.id },
    });
    if (!deleted) return res.status(404).json({ message: 'Không tìm thấy học viên' });
    res.json({ message: 'Đã xóa học viên' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const training = await Training.findByPk(req.params.id);
    if (!training) return res.status(404).json({ message: 'Không tìm thấy khóa học' });
    await TrainingParticipant.destroy({ where: { trainingId: training.id } });
    await training.destroy();
    res.json({ message: 'Đã xóa khóa học' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
