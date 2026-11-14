const express = require('express');
const router = express.Router();
const { RewardDiscipline, Personnel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { personnelId, type } = req.query;
    const where = {};
    if (personnelId) where.personnelId = personnelId;
    if (type) where.type = type;

    const records = await RewardDiscipline.findAll({
      where,
      include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName'] }],
      order: [['issuedDate', 'DESC']],
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const record = await RewardDiscipline.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const record = await RewardDiscipline.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    await record.update(req.body);
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const record = await RewardDiscipline.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    await record.destroy();
    res.json({ message: 'Đã xóa' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
