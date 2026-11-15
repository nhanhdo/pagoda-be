// Single endpoint for the notification bell: one request instead of five.
const express = require('express');
const { Op } = require('sequelize');
const {
  WorkAssignment, DutySchedule, Post, Comment, Expense, Fund, User, Personnel,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const MANAGERS = ['admin', 'truotri', 'thuki', 'truongban'];
const APPROVERS = ['admin', 'truotri', 'thuki'];
const PERSON = ['id', 'fullName', 'dharmName'];

// Local calendar date (server TZ), never toISOString (UTC would shift the day).
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function safe(fn, fallback = []) {
  try { return await fn(); } catch (e) { console.error('[notifications]', e.message); return fallback; }
}

router.get('/summary', async (req, res) => {
  const me = req.user;
  const today = ymd(new Date());
  const isManager = MANAGERS.includes(me.role);

  const [overdueTasks, todayDuties, pendingPosts, pendingExpenses, comments] = await Promise.all([
    // Overdue tasks: managers see all, others only their own
    safe(async () => {
      const where = { endDate: { [Op.lt]: today }, status: { [Op.notIn]: ['hoàn_thành', 'hủy'] } };
      if (!isManager) {
        if (!me.personnelId) return [];
        where.personnelId = me.personnelId;
      }
      const rows = await WorkAssignment.findAll({
        where,
        attributes: ['id', 'title', 'endDate', 'status', 'priority'],
        include: [{ model: Personnel, as: 'personnel', attributes: PERSON, required: false }],
        order: [['endDate', 'ASC']],
        limit: 30,
      });
      return rows.map(r => r.toJSON());
    }),

    // Today's duties (pagoda-wide schedule)
    safe(async () => {
      const rows = await DutySchedule.findAll({
        where: { dutyDate: today },
        attributes: ['id', 'dutyType', 'shift', 'startTime', 'endTime', 'status'],
        include: [{ model: Personnel, as: 'personnel', attributes: PERSON, required: false }],
        order: [['shift', 'ASC']],
        limit: 30,
      });
      return rows.map(r => r.toJSON());
    }),

    // Posts awaiting approval
    APPROVERS.includes(me.role)
      ? safe(async () => {
        const rows = await Post.findAll({
          where: { status: 'pending' },
          attributes: ['id', 'title', 'type', 'createdAt'],
          include: [
            { model: Personnel, as: 'author', attributes: PERSON, required: false },
            { model: User, as: 'userAuthor', attributes: ['id', 'username'], required: false },
          ],
          order: [['createdAt', 'DESC']],
          limit: 30,
        });
        return rows.map(r => r.toJSON());
      })
      : Promise.resolve(undefined),

    // Expense vouchers awaiting admin approval
    me.role === 'admin'
      ? safe(async () => {
        const rows = await Expense.findAll({
          where: { status: 'chờ_duyệt' },
          attributes: ['id', 'code', 'amount', 'payee', 'description', 'createdAt'],
          include: [
            { model: Fund, as: 'fund', attributes: ['id', 'name'], required: false },
            { model: User, as: 'creator', attributes: ['id', 'username'], required: false, include: [{ model: Personnel, as: 'personnel', attributes: PERSON, required: false }] },
          ],
          order: [['createdAt', 'DESC']],
          limit: 30,
        });
        return rows.map(r => r.toJSON());
      })
      : Promise.resolve(undefined),

    // Recent comments from others on posts I wrote or commented on (last 7 days)
    safe(async () => {
      const myPosts = await Post.findAll({ where: { userId: me.id }, attributes: ['id'], raw: true });
      const commented = await Comment.findAll({ where: { userId: me.id }, attributes: ['postId'], group: ['postId'], raw: true });
      const postIds = [...new Set([...myPosts.map(p => p.id), ...commented.map(c => c.postId)])];
      if (!postIds.length) return [];
      const rows = await Comment.findAll({
        where: {
          postId: { [Op.in]: postIds },
          userId: { [Op.ne]: me.id },
          createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        attributes: ['id', 'postId', 'content', 'createdAt', 'replyToId'],
        include: [
          { model: Personnel, as: 'commentAuthor', attributes: PERSON, required: false },
          { model: User, as: 'commentUser', attributes: ['id', 'username'], required: false },
          { model: Post, as: 'post', attributes: ['id', 'title', 'userId'], required: true },
        ],
        order: [['createdAt', 'DESC']],
        limit: 20,
      });
      const targetIds = [...new Set(rows.map(c => c.replyToId).filter(Boolean))];
      const mine = targetIds.length
        ? new Set((await Comment.findAll({ where: { id: { [Op.in]: targetIds }, userId: me.id }, attributes: ['id'], raw: true })).map(c => c.id))
        : new Set();
      return rows.map(c => ({ ...c.toJSON(), onMyPost: c.post?.userId === me.id, replyToMe: mine.has(c.replyToId) }));
    }),
  ]);

  res.json({ today, overdueTasks, todayDuties, pendingPosts, pendingExpenses, comments });
});

module.exports = router;
