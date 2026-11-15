// Thư viện chư Phật & Bồ Tát — everyone signed in can read; admin / trụ trì / thư ký can edit.
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { BuddhaFigure } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { makeStorage } = require('../config/cloudinary');

const storage = process.env.CLOUDINARY_CLOUD_NAME
  ? makeStorage('library')
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
      filename: (req, file, cb) => cb(null, `library_${Date.now()}${path.extname(file.originalname)}`),
    });
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const EDITORS = ['admin', 'truotri', 'thuki'];
const TEXT_FIELDS = {
  name: 120, title: 200, intro: 20000, vowsIntro: 2000,
  mantraText: 2000, mantraPhonetic: 2000, mantraMeaning: 4000,
};

const parseList = (v) => {
  if (typeof v !== 'string') return v;
  try { return v ? JSON.parse(v) : []; } catch { return null; }
};

router.use(authenticate);

/** Validates and normalises the body. Returns [data, error]. */
function parseBody(body, partial) {
  const data = {};
  for (const [k, max] of Object.entries(TEXT_FIELDS)) {
    if (body[k] === undefined) continue;
    const v = String(body[k] ?? '').trim();
    if (v.length > max) return [null, `Trường ${k} quá dài (tối đa ${max} ký tự)`];
    data[k] = v || null;
  }
  if (!partial || body.name !== undefined) {
    if (!data.name) return [null, 'Vui lòng nhập tên'];
  }
  if (body.kind !== undefined) {
    if (!BuddhaFigure.KINDS.includes(body.kind)) return [null, 'Loại không hợp lệ'];
    data.kind = body.kind;
  }
  if (body.sortOrder !== undefined && body.sortOrder !== '') {
    const n = parseInt(body.sortOrder, 10);
    if (!Number.isFinite(n)) return [null, 'Thứ tự không hợp lệ'];
    data.sortOrder = n;
  }
  if (body.feastDays !== undefined) {
    let list = body.feastDays;
    if (typeof list === 'string') {
      try { list = list ? JSON.parse(list) : []; } catch { return [null, 'Ngày vía không hợp lệ']; }
    }
    if (!Array.isArray(list) || list.length > 8) return [null, 'Ngày vía không hợp lệ'];
    const clean = [];
    for (const f of list) {
      const day = parseInt(f?.day, 10);
      const month = parseInt(f?.month, 10);
      if (!(day >= 1 && day <= 30 && month >= 1 && month <= 12)) return [null, 'Ngày vía âm lịch không hợp lệ'];
      clean.push({ day, month, label: String(f.label || '').trim().slice(0, 60) });
    }
    data.feastDays = clean;
  }
  if (body.bioSections !== undefined) {
    const list = parseList(body.bioSections);
    if (!Array.isArray(list) || list.length > 30) return [null, 'Mục tiểu sử không hợp lệ'];
    const clean = [];
    for (const x of list) {
      const heading = String(x?.heading || '').trim();
      const text = String(x?.body || '').trim();
      if (!heading && !text) continue;
      if (heading.length > 120 || text.length > 8000) return [null, 'Mục tiểu sử quá dài'];
      clean.push({ heading, body: text });
    }
    data.bioSections = clean;
  }
  if (body.vows !== undefined) {
    const list = parseList(body.vows);
    if (!Array.isArray(list) || list.length > 60) return [null, 'Danh sách đại nguyện không hợp lệ'];
    const clean = [];
    for (const x of list) {
      const text = String(x?.text || '').trim();
      if (!text) continue;
      if (text.length > 3000) return [null, 'Lời nguyện quá dài'];
      const no = parseInt(x?.no, 10);
      clean.push({ no: Number.isFinite(no) && no > 0 && no < 1000 ? no : clean.length + 1, text });
    }
    data.vows = clean;
  }
  if (body.removeImage === 'true' || body.removeImage === true) data.image = null;
  return [data, null];
}

router.get('/', async (req, res) => {
  try {
    const rows = await BuddhaFigure.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/:id', async (req, res) => {
  const row = await BuddhaFigure.findByPk(req.params.id).catch(() => null);
  if (!row) return res.status(404).json({ message: 'Không tìm thấy' });
  res.json(row);
});

router.post('/', authorize(...EDITORS), upload.single('image'), async (req, res) => {
  try {
    const [data, err] = parseBody(req.body, false);
    if (err) return res.status(400).json({ message: err });
    if (req.file) data.image = req.file.path || `/uploads/${req.file.filename}`;
    if (data.sortOrder === undefined) data.sortOrder = ((await BuddhaFigure.max('sortOrder')) || 0) + 1;
    const row = await BuddhaFigure.create({ ...data, createdBy: req.user.id });
    res.status(201).json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize(...EDITORS), upload.single('image'), async (req, res) => {
  try {
    const row = await BuddhaFigure.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy' });
    const [data, err] = parseBody(req.body, true);
    if (err) return res.status(400).json({ message: err });
    if (req.file) data.image = req.file.path || `/uploads/${req.file.filename}`;
    await row.update(data);
    res.json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize(...EDITORS), async (req, res) => {
  try {
    const row = await BuddhaFigure.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy' });
    await row.destroy();
    res.json({ message: 'Đã xóa' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
