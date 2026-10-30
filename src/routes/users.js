const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, Personnel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin'));

// GET all users
router.get('/', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName', 'position', 'code'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// GET one user
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName', 'code'] }],
    });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// POST create user
router.post('/', async (req, res) => {
  try {
    const { username, password, role, personnelId, isActive } = req.body;

    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });

    const hashed = await bcrypt.hash(password || '123456', 10);
    const user = await User.create({
      username, password: hashed,
      role: role || 'user',
      personnelId: personnelId || null,
      isActive: isActive !== false,
    });

    const result = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName', 'code'] }],
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// PUT update user
router.put('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    const { username, role, personnelId, isActive } = req.body;

    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
    }

    await user.update({
      ...(username && { username }),
      ...(role && { role }),
      ...(personnelId !== undefined && { personnelId: personnelId || null }),
      ...(isActive !== undefined && { isActive }),
    });

    const result = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName', 'code'] }],
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// PUT reset password
router.put('/:id/reset-password', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    const newPassword = req.body.newPassword || '123456';
    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed });
    res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// DELETE user
router.delete('/:id', async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'Không thể xóa tài khoản đang đăng nhập' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    await user.destroy();
    res.json({ message: 'Đã xóa tài khoản' });
  } catch {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
