const express = require('express');
const { Op } = require('sequelize');
const { sequelize, MemorialTablet, CeremonyEntry, BuddhistFollower } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { intOrNull, yearOk } = require('../services/ceremony');
const { withRetry, likeOp } = require('../services/finance');

const router = express.Router();
router.use(authenticate);

const WRITE = ['admin', 'truotri', 'thuki', 'truongban'];
const REMOVE = ['admin', 'truotri'];
const ACTIVE = 'đang_thờ';
const pad = (n, w = 4) => String(n).padStart(w, '0');

const include = [{ model: BuddhistFollower, as: 'buddhistFollower', attributes: ['id', 'fullName', 'dharmName', 'code'] }];

function payload(body, existing = null) {
  const pick = (k) => (body[k] !== undefined ? body[k] : existing?.[k]);
  const data = {
    spiritName: String(pick('spiritName') || '').trim(),
    birthYear: intOrNull(pick('birthYear')),
    deathYear: intOrNull(pick('deathYear')),
    deathLunarDay: intOrNull(pick('deathLunarDay')),
    deathLunarMonth: intOrNull(pick('deathLunarMonth')),
    ageAtDeath: intOrNull(pick('ageAtDeath')),
    gender: pick('gender') || null,
    area: String(pick('area') || '').trim(),
    rowNo: intOrNull(pick('rowNo')),
    slotNo: intOrNull(pick('slotNo')),
    worshipperName: pick('worshipperName') || null,
    worshipperPhone: pick('worshipperPhone') || null,
    buddhistFollowerId: intOrNull(pick('buddhistFollowerId')) || null,
    installedDate: pick('installedDate') || null,
    status: pick('status') || ACTIVE,
    notes: pick('notes') || null,
  };
  if (!data.spiritName) return { err: 'Nhập tên hương linh' };
  if (!data.area) return { err: 'Chọn khu đặt linh vị' };
  if (!(data.rowNo >= 1) || !(data.slotNo >= 1)) return { err: 'Hàng và số phải từ 1 trở lên' };
  if (!yearOk(data.birthYear) || !yearOk(data.deathYear)) return { err: 'Năm sinh/năm mất không hợp lệ' };
  if (data.birthYear && data.deathYear && data.deathYear < data.birthYear) return { err: 'Năm mất trước năm sinh' };
  if (data.deathLunarDay !== null && (data.deathLunarDay < 1 || data.deathLunarDay > 30)) return { err: 'Ngày mất âm lịch phải từ 1 đến 30' };
  if (data.deathLunarMonth !== null && (data.deathLunarMonth < 1 || data.deathLunarMonth > 12)) return { err: 'Tháng mất âm lịch phải từ 1 đến 12' };
  if (!MemorialTablet.STATUSES.includes(data.status)) return { err: 'Trạng thái không hợp lệ' };
  return { data };
}

// Areas are compared case-insensitively ("Khu A" = "khu a"); a new entry reuses the existing spelling.
const lowerArea = (area) => sequelize.where(sequelize.fn('lower', sequelize.col('area')), String(area).toLowerCase());

async function canonicalArea(area, transaction) {
  const same = await MemorialTablet.findOne({ where: lowerArea(area), attributes: ['area'], transaction });
  return same ? same.area : area;
}

async function slotTaken(data, excludeId, transaction) {
  if (data.status !== ACTIVE) return null;
  const where = { [Op.and]: [lowerArea(data.area), { rowNo: data.rowNo, slotNo: data.slotNo, status: ACTIVE }] };
  if (excludeId) where[Op.and].push({ id: { [Op.ne]: excludeId } });
  return MemorialTablet.findOne({ where, transaction });
}

// The partial unique index (migrate.js) catches races the check above can't see
const slotConflict = (e) => e?.name === 'SequelizeUniqueConstraintError' && /area|slot|memorial_tablets_active_slot/i.test(JSON.stringify(e.fields || {}) + (e.parent?.message || '') + (e.message || ''));

const takenMessage = (t, d) => `Vị trí ${d.area} · hàng ${d.rowNo} · số ${d.slotNo} đã có linh vị “${t.spiritName}” (${t.code})`;

router.get('/', async (req, res) => {
  try {
    const { area, status, search } = req.query;
    const where = {};
    if (area) where.area = area;
    if (status) where.status = status;
    if (search) {
      const like = { [likeOp()]: `%${search}%` };
      where[Op.or] = [{ code: like }, { spiritName: like }, { worshipperName: like }, { worshipperPhone: like }];
    }
    const rows = await MemorialTablet.findAll({ where, include, order: [['area', 'ASC'], ['rowNo', 'ASC'], ['slotNo', 'ASC']] });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Occupancy map: areas → grid size → active tablets by position
router.get('/layout', async (req, res) => {
  try {
    const rows = await MemorialTablet.findAll({
      where: { status: ACTIVE },
      attributes: ['id', 'code', 'spiritName', 'area', 'rowNo', 'slotNo', 'deathYear', 'worshipperName'],
      order: [['area', 'ASC'], ['rowNo', 'ASC'], ['slotNo', 'ASC']],
      raw: true,
    });
    const allAreas = await MemorialTablet.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('area')), 'area']], raw: true });
    const map = {};
    allAreas.forEach(a => { map[a.area] = { area: a.area, rows: 0, slots: 0, tablets: [] }; });
    rows.forEach(t => {
      const a = map[t.area] || (map[t.area] = { area: t.area, rows: 0, slots: 0, tablets: [] });
      a.rows = Math.max(a.rows, t.rowNo);
      a.slots = Math.max(a.slots, t.slotNo);
      a.tablets.push(t);
    });
    const areas = Object.values(map).sort((x, y) => String(x.area).localeCompare(String(y.area), 'vi'));
    res.json({ areas, total: rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await MemorialTablet.findByPk(req.params.id, { include });
    if (!row) return res.status(404).json({ message: 'Không tìm thấy linh vị' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize(...WRITE), async (req, res) => {
  try {
    const { err, data } = payload(req.body);
    if (err) return res.status(400).json({ message: err });
    const create = () => sequelize.transaction(async (transaction) => {
      data.area = await canonicalArea(data.area, transaction);
      const taken = await slotTaken(data, null, transaction);
      if (taken) { const e = new Error(takenMessage(taken, data)); e.status = 409; throw e; }
      const codes = await MemorialTablet.findAll({ where: { code: { [Op.like]: 'LV-%' } }, attributes: ['code'], raw: true, transaction });
      const max = codes.reduce((m, r) => Math.max(m, parseInt(String(r.code).split('-').pop(), 10) || 0), 0);
      return MemorialTablet.create({ ...data, code: `LV-${pad(max + 1)}` }, { transaction });
    });
    let created;
    try {
      // Retry only code collisions; a slot collision is reported to the user
      created = await withRetry(async () => {
        try { return await create(); } catch (e) { if (slotConflict(e)) { e.slot = true; e.name = 'SlotConflict'; } throw e; }
      });
    } catch (e) {
      if (e.slot) return res.status(409).json({ message: `Vị trí ${data.area} · hàng ${data.rowNo} · số ${data.slotNo} vừa được đặt linh vị khác` });
      throw e;
    }
    res.status(201).json(await MemorialTablet.findByPk(created.id, { include }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: e.errors?.[0]?.message || 'Lỗi server' });
  }
});

router.put('/:id', authorize(...WRITE), async (req, res) => {
  try {
    const row = await MemorialTablet.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy linh vị' });
    const { err, data } = payload(req.body, row);
    if (err) return res.status(400).json({ message: err });
    await sequelize.transaction(async (transaction) => {
      data.area = await canonicalArea(data.area, transaction);
      const taken = await slotTaken(data, row.id, transaction);
      if (taken) { const e = new Error(takenMessage(taken, data)); e.status = 409; throw e; }
      await row.update(data, { transaction });
    });
    res.json(await MemorialTablet.findByPk(row.id, { include }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    if (slotConflict(e)) return res.status(409).json({ message: 'Vị trí này vừa được đặt linh vị khác' });
    console.error(e);
    res.status(500).json({ message: e.errors?.[0]?.message || 'Lỗi server' });
  }
});

router.delete('/:id', authorize(...REMOVE), async (req, res) => {
  try {
    const row = await MemorialTablet.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy linh vị' });
    await sequelize.transaction(async (transaction) => {
      await CeremonyEntry.update({ memorialTabletId: null }, { where: { memorialTabletId: row.id }, transaction });
      await row.destroy({ transaction });
    });
    res.json({ message: 'Đã xóa' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
