const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const { Personnel, Department, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { makeStorage } = require('../config/cloudinary');

const storage = process.env.CLOUDINARY_CLOUD_NAME
  ? makeStorage('personnel')
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
      filename: (req, file, cb) => cb(null, `photo_${Date.now()}${path.extname(file.originalname)}`),
    });
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type, departmentId, status, position } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { dharmName: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }
    if (type) where.type = type;
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (position) where.position = position;

    const { count, rows } = await Personnel.findAndCountAll({
      where,
      include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['fullName', 'ASC']],
    });

    res.json({ total: count, page: parseInt(page), data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const personnel = await Personnel.findByPk(req.params.id, {
      include: [{ model: Department, as: 'department' }],
    });
    if (!personnel) return res.status(404).json({ message: 'Không tìm thấy nhân sự' });
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/', authorize('admin', 'truotri', 'thuki'), upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = req.file.path || `/uploads/${req.file.filename}`;

    const count = await Personnel.count();
    data.code = data.code || `NS${String(count + 1).padStart(4, '0')}`;

    const personnel = await Personnel.create(data);

    if (data.createAccount && data.username) {
      const hashed = await bcrypt.hash(data.password || '123456', 10);
      await User.create({
        username: data.username,
        password: hashed,
        role: data.userRole || 'user',
        personnelId: personnel.id,
      });
    }

    res.status(201).json(personnel);
  } catch (error) {
    console.error(error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Mã nhân sự đã tồn tại' });
    }
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin', 'truotri', 'thuki'), upload.single('photo'), async (req, res) => {
  try {
    const personnel = await Personnel.findByPk(req.params.id);
    if (!personnel) return res.status(404).json({ message: 'Không tìm thấy nhân sự' });

    const data = { ...req.body };
    if (req.file) data.photo = req.file.path || `/uploads/${req.file.filename}`;

    await personnel.update(data);
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const personnel = await Personnel.findByPk(req.params.id);
    if (!personnel) return res.status(404).json({ message: 'Không tìm thấy nhân sự' });
    await personnel.destroy();
    res.json({ message: 'Đã xóa nhân sự' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
