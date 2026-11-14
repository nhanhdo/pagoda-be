const express = require('express');
const { CeremonyRegistration } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const svc = require('../services/ceremony');

const router = express.Router();
router.use(authenticate);

const WRITE = ['admin', 'truotri', 'thuki', 'truongban'];

router.get('/:id', async (req, res) => {
  try {
    const row = await CeremonyRegistration.findByPk(req.params.id, { include: svc.regInclude });
    if (!row) return res.status(404).json({ message: 'Không tìm thấy đăng ký' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize(...WRITE), async (req, res) => {
  try {
    const r = await svc.saveRegistration({ body: req.body, user: req.user });
    if (r.err) return res.status(r.status || 400).json({ message: r.err });
    res.status(201).json(r.reg);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.errors?.[0]?.message || 'Lỗi server' });
  }
});

router.put('/:id', authorize(...WRITE), async (req, res) => {
  try {
    const existing = await CeremonyRegistration.findByPk(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy đăng ký' });
    const r = await svc.saveRegistration({ body: req.body, user: req.user, existing });
    if (r.err) return res.status(r.status || 400).json({ message: r.err });
    res.json(r.reg);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.errors?.[0]?.message || 'Lỗi server' });
  }
});

router.delete('/:id', authorize(...WRITE), async (req, res) => {
  try {
    const reg = await CeremonyRegistration.findByPk(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Không tìm thấy đăng ký' });
    // Deleting also deletes the recorded offering, so it needs the same rights as deleting a donation
    if (reg.donationId && !svc.FINANCE_OVERRIDE.includes(req.user.role)) {
      return res.status(403).json({ message: 'Đăng ký đã có phiếu thu cúng dường — chỉ admin hoặc trụ trì được xóa' });
    }
    await svc.deleteRegistration(reg);
    res.json({ message: 'Đã xóa' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
