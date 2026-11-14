const express = require('express');
const { Op } = require('sequelize');
const { Ceremony, CeremonyRegistration, CeremonyEntry, Fund } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const svc = require('../services/ceremony');
const { lunarToSolarChecked } = require('../utils/lunar');
const { likeOp } = require('../services/finance');

const router = express.Router();
router.use(authenticate);

const WRITE = ['admin', 'truotri', 'thuki', 'truongban'];
const REMOVE = ['admin', 'truotri'];
const fundAttrs = ['id', 'code', 'name', 'color'];

// Lunar → solar preview for the ceremony form
router.get('/solar-date', (req, res) => {
  const { lunarDay, lunarMonth, year } = req.query;
  const conv = lunarToSolarChecked(lunarDay, lunarMonth, year);
  if (conv.err) return res.status(400).json({ message: conv.err });
  res.json({ solarDate: conv.iso });
});

router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.year) where.year = req.query.year;
    const rows = await Ceremony.findAll({
      where,
      include: [{ model: Fund, as: 'defaultFund', attributes: fundAttrs }],
      order: [['solarDate', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    const stats = await svc.ceremonyStats(rows.map(r => r.id));
    const empty = { registrations: { 'cầu_an': 0, 'cầu_siêu': 0 }, names: { 'cầu_an': 0, 'cầu_siêu': 0 }, offering: 0 };
    res.json(rows.map(r => ({ ...r.toJSON(), stats: stats[r.id] || empty })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/:id', async (req, res) => {
  const row = await Ceremony.findByPk(req.params.id, { include: [{ model: Fund, as: 'defaultFund', attributes: fundAttrs }] });
  if (!row) return res.status(404).json({ message: 'Không tìm thấy đàn lễ' });
  const stats = await svc.ceremonyStats([row.id]);
  res.json({ ...row.toJSON(), stats: stats[row.id] });
});

router.post('/', authorize(...WRITE), async (req, res) => {
  try {
    const { err, data } = await svc.ceremonyPayload(req.body);
    if (err) return res.status(400).json({ message: err });
    const row = await Ceremony.create(data);
    res.status(201).json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.errors?.[0]?.message || 'Lỗi server' });
  }
});

router.put('/:id', authorize(...WRITE), async (req, res) => {
  try {
    const row = await Ceremony.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy đàn lễ' });
    const { err, data } = await svc.ceremonyPayload(req.body, row);
    if (err) return res.status(400).json({ message: err });
    await row.update(data);
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.errors?.[0]?.message || 'Lỗi server' });
  }
});

// Quick open/close toggle for registrations
router.patch('/:id/registration', authorize(...WRITE), async (req, res) => {
  const row = await Ceremony.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: 'Không tìm thấy đàn lễ' });
  await row.update({ registrationOpen: Boolean(req.body.open) });
  res.json(row);
});

router.delete('/:id', authorize(...REMOVE), async (req, res) => {
  try {
    const row = await Ceremony.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy đàn lễ' });
    const count = await CeremonyRegistration.count({ where: { ceremonyId: row.id } });
    if (count) return res.status(400).json({ message: `Đàn lễ đã có ${count} đăng ký — hãy xóa các đăng ký trước hoặc khóa đăng ký thay vì xóa` });
    await row.destroy();
    res.json({ message: 'Đã xóa' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Registrations of one ceremony (with names)
router.get('/:id/registrations', async (req, res) => {
  try {
    const { kind, search } = req.query;
    const where = { ceremonyId: req.params.id };
    if (kind) where.kind = kind;
    if (search) {
      const like = { [likeOp()]: `%${search}%` };
      const matched = await CeremonyEntry.findAll({ where: { fullName: like }, attributes: ['registrationId'], raw: true });
      where[Op.or] = [
        { code: like }, { registrantName: like }, { registrantPhone: like },
        { id: { [Op.in]: matched.map(m => m.registrationId) } },
      ];
    }
    const rows = await CeremonyRegistration.findAll({ where, include: svc.regInclude, order: [['id', 'DESC']] });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Data for printing the sớ list of a ceremony
router.get('/:id/print-list', async (req, res) => {
  try {
    const ceremony = await Ceremony.findByPk(req.params.id);
    if (!ceremony) return res.status(404).json({ message: 'Không tìm thấy đàn lễ' });
    const where = { ceremonyId: ceremony.id };
    if (req.query.kind) where.kind = req.query.kind;
    const registrations = await CeremonyRegistration.findAll({
      where,
      include: [{ model: CeremonyEntry, as: 'entries', separate: true, order: [['sortOrder', 'ASC'], ['id', 'ASC']] }],
      order: [['id', 'ASC']],
    });
    res.json({ ceremony, registrations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
