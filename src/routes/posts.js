const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Post, User, Personnel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (req, file, cb) => cb(null, `post_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

const EDITOR_ROLES = ['admin', 'truotri', 'thuki'];

// GET all approved posts (all authenticated users can read)
router.get('/', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const where = { isPublished: true, status: 'approved' };
    if (type) where.type = type;

    const { count, rows } = await Post.findAndCountAll({
      where,
      include: [
        { model: Personnel, as: 'author', attributes: ['id', 'fullName', 'dharmName'], required: false },
        { model: User, as: 'userAuthor', attributes: ['id', 'username'], required: false },
      ],
      order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({ total: count, page: parseInt(page), data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// GET pending posts (admin/truotri/thuki only)
router.get('/pending', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const where = { status: 'pending' };
    if (type) where.type = type;

    const { count, rows } = await Post.findAndCountAll({
      where,
      include: [
        { model: Personnel, as: 'author', attributes: ['id', 'fullName', 'dharmName'], required: false },
        { model: User, as: 'userAuthor', attributes: ['id', 'username'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({ total: count, page: parseInt(page), data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        { model: Personnel, as: 'author', attributes: ['id', 'fullName', 'dharmName'], required: false },
        { model: User, as: 'userAuthor', attributes: ['id', 'username'], required: false },
      ],
    });
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    res.json(post);
  } catch {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// POST - all authenticated users can create; editors approved instantly, others pending
router.post('/', upload.single('coverImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.coverImage = `/uploads/${req.file.filename}`;
    data.authorId = req.user?.personnelId || null;
    data.userId = req.user.id;
    const isEditor = EDITOR_ROLES.includes(req.user?.role);
    data.status = isEditor ? 'approved' : 'pending';
    // Non-editors: force isPublished=true so post is ready once approved
    if (!isEditor) data.isPublished = true;
    const post = await Post.create(data);
    res.status(201).json({ ...post.toJSON(), isPending: !isEditor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.put('/:id', authorize('admin', 'truotri', 'thuki'), upload.single('coverImage'), async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    const data = { ...req.body };
    if (req.file) data.coverImage = `/uploads/${req.file.filename}`;
    await post.update(data);
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:id', authorize('admin', 'truotri'), async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    await post.destroy();
    res.json({ message: 'Đã xóa' });
  } catch {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// PATCH approve/reject (admin/truotri/thuki only)
router.patch('/:id/approve', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    await post.update({ status: 'approved' });
    res.json(post);
  } catch {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.patch('/:id/reject', authorize('admin', 'truotri', 'thuki'), async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    await post.update({ status: 'rejected' });
    res.json(post);
  } catch {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
