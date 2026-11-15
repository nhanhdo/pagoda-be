const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Post, User, Personnel, Comment } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { makeStorage } = require('../config/cloudinary');

const storage = process.env.CLOUDINARY_CLOUD_NAME
  ? makeStorage('posts')
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
      filename: (req, file, cb) => cb(null, `post_${Date.now()}_${file.originalname}`),
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
        { model: Comment, as: 'comments', attributes: ['id'], required: false },
      ],
      order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true,
    });

    res.json({ total: count, page: parseInt(page), data: rows.map(r => ({ ...r.toJSON(), commentCount: r.comments?.length ?? 0 })) });
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
        { model: Comment, as: 'comments', attributes: ['id'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true,
    });

    res.json({ total: count, page: parseInt(page), data: rows.map(r => ({ ...r.toJSON(), commentCount: r.comments?.length ?? 0 })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// GET recent comments relevant to the current user: on posts they wrote or commented on, excluding their own.
// Registered before '/:id' so "comments" isn't parsed as a post id.
router.get('/comments/recent', async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const me = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const days = Math.min(parseInt(req.query.days, 10) || 7, 30);

    const myPosts = await Post.findAll({ where: { userId: me }, attributes: ['id'], raw: true });
    const commented = await Comment.findAll({ where: { userId: me }, attributes: ['postId'], group: ['postId'], raw: true });
    const postIds = [...new Set([...myPosts.map(p => p.id), ...commented.map(c => c.postId)])];
    if (!postIds.length) return res.json([]);

    const comments = await Comment.findAll({
      where: {
        postId: { [Op.in]: postIds },
        userId: { [Op.ne]: me },
        createdAt: { [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      },
      include: [
        { model: Personnel, as: 'commentAuthor', attributes: ['id', 'fullName', 'dharmName'], required: false },
        { model: User, as: 'commentUser', attributes: ['id', 'username'], required: false },
        { model: Post, as: 'post', attributes: ['id', 'title', 'userId'], required: true },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });
    res.json(comments.map(c => ({ ...c.toJSON(), onMyPost: c.post?.userId === me })));
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
    if (req.file) data.coverImage = req.file.path || `/uploads/${req.file.filename}`;
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
    if (req.file) data.coverImage = req.file.path || `/uploads/${req.file.filename}`;
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

/* ── Comment routes ───────────────────────────────────────── */

router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.findAll({
      where: { postId: req.params.id },
      include: [
        { model: Personnel, as: 'commentAuthor', attributes: ['id', 'fullName', 'dharmName'], required: false },
        { model: User, as: 'commentUser', attributes: ['id', 'username'], required: false },
      ],
      order: [['createdAt', 'ASC']],
    });
    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    if (!req.body.content?.trim()) return res.status(400).json({ message: 'Nội dung không được để trống' });

    // Reply: attach to the thread's top-level comment (one nesting level, like Facebook)
    let parentId = null;
    let replyToId = null;
    if (req.body.replyToId != null) {
      const target = await Comment.findOne({ where: { id: req.body.replyToId, postId: post.id } });
      if (!target) return res.status(400).json({ message: 'Bình luận được trả lời không còn tồn tại' });
      replyToId = target.id;
      parentId = target.parentId || target.id;
    }

    const comment = await Comment.create({
      postId: post.id,
      content: req.body.content.trim(),
      authorId: req.user?.personnelId || null,
      userId: req.user.id,
      parentId,
      replyToId,
    });
    const result = await Comment.findByPk(comment.id, {
      include: [
        { model: Personnel, as: 'commentAuthor', attributes: ['id', 'fullName', 'dharmName'], required: false },
        { model: User, as: 'commentUser', attributes: ['id', 'username'], required: false },
      ],
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.delete('/:postId/comments/:commentId', async (req, res) => {
  try {
    const comment = await Comment.findOne({ where: { id: req.params.commentId, postId: req.params.postId } });
    if (!comment) return res.status(404).json({ message: 'Không tìm thấy bình luận' });
    const isOwn = comment.userId === req.user.id;
    const isEditor = ['admin', 'truotri'].includes(req.user?.role);
    if (!isOwn && !isEditor) return res.status(403).json({ message: 'Không có quyền xóa' });
    // Deleting a top-level comment removes its replies too
    const removedIds = [comment.id];
    if (!comment.parentId) {
      const replies = await Comment.findAll({ where: { parentId: comment.id }, attributes: ['id'], raw: true });
      removedIds.push(...replies.map(r => r.id));
      if (replies.length) await Comment.destroy({ where: { parentId: comment.id } });
    }
    await comment.destroy();
    res.json({ message: 'Đã xóa', removedIds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
