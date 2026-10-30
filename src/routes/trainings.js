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
    const { personnelIds } = req.body;
    const participants = await TrainingParticipant.bulkCreate(
      personnelIds.map(pid => ({ trainingId: req.params.id, personnelId: pid, registrationDate: new Date() })),
      { ignoreDuplicates: true }
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

module.exports = router;
