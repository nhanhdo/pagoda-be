const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const backup = require('../services/backup');

const router = express.Router();
router.use(authenticate, authorize('admin'));

// Status: table counts + cloud copies
router.get('/status', async (req, res) => {
  try {
    const snap = await backup.buildSnapshot();
    let cloudCopies = [];
    let cloudError = null;
    // Signed, short-lived download links (backups are not publicly accessible)
    try { cloudCopies = await backup.listCloud({ withLinks: true }); } catch (e) { cloudError = e.message; }
    res.json({
      counts: snap.counts,
      dialect: snap.dialect,
      cloudEnabled: backup.cloudEnabled(),
      cloudError,
      cloudCopies,
      lastAuto: backup.getLastAuto(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Không thể đọc trạng thái sao lưu' });
  }
});

// Download a full snapshot as a JSON file
router.get('/export', async (req, res) => {
  try {
    const snap = await backup.buildSnapshot();
    const stamp = snap.createdAt.slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quanlychua-backup-${stamp}.json"`);
    res.send(JSON.stringify(snap));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Không thể tạo bản sao lưu' });
  }
});

// Save a snapshot to Cloudinary now
router.post('/cloud', async (req, res) => {
  try {
    const snap = await backup.buildSnapshot();
    const saved = await backup.uploadSnapshot(snap, 'manual');
    res.json(saved);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message || 'Không thể lưu lên cloud' });
  }
});

// Validate a snapshot without changing anything (dry run)
router.post('/validate', express.json({ limit: '50mb' }), (req, res) => {
  try {
    backup.validateSnapshot(req.body);
    res.json({ ok: true, createdAt: req.body.createdAt, counts: req.body.counts || {} });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Restore: replaces ALL data. Requires an explicit confirmation phrase and a persisted safety copy:
// uploaded to the cloud when configured (restore aborts if that fails), otherwise the client must
// confirm it has already downloaded one (the page does this automatically before calling restore).
router.post('/restore', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { confirm, snapshot, safetyDownloaded } = req.body || {};
    if (confirm !== 'KHOI PHUC') {
      return res.status(400).json({ message: 'Thiếu xác nhận khôi phục' });
    }
    backup.validateSnapshot(snapshot);

    let safetyCloud = null;
    if (backup.cloudEnabled()) {
      try {
        safetyCloud = await backup.uploadSnapshot(await backup.buildSnapshot(), 'before-restore');
      } catch (e) {
        return res.status(500).json({ message: `Không lưu được bản sao lưu an toàn lên cloud (${e.message}) — đã hủy khôi phục, dữ liệu giữ nguyên` });
      }
    } else if (safetyDownloaded !== true) {
      return res.status(400).json({ message: 'Cần tải bản sao lưu an toàn của dữ liệu hiện tại về máy trước khi khôi phục' });
    }

    const restored = await backup.restoreSnapshot(snapshot);
    res.json({ ok: true, restored, safetyCloud });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message || 'Khôi phục thất bại' });
  }
});

module.exports = router;
