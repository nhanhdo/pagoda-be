const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Personnel, BuddhistFollower, Training, DutySchedule, WorkAssignment, Post } = require('../models');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalPersonnel, tangNi, cuSi, phatTu, tinhNguyenVien, nhanVien,
      totalFollowers, totalTrainings, dutyToday, pendingWork
    ] = await Promise.all([
      Personnel.count({ where: { status: 'đang_hoạt_động' } }),
      Personnel.count({ where: { type: 'tang_ni',         status: 'đang_hoạt_động' } }),
      Personnel.count({ where: { type: 'cu_si',           status: 'đang_hoạt_động' } }),
      Personnel.count({ where: { type: 'phat_tu',         status: 'đang_hoạt_động' } }),
      Personnel.count({ where: { type: 'tinh_nguyen_vien',status: 'đang_hoạt_động' } }),
      Personnel.count({ where: { type: 'nhan_vien',       status: 'đang_hoạt_động' } }),
      BuddhistFollower.count({ where: { status: 'đang_sinh_hoạt' } }),
      Training.count({ where: { status: { [Op.in]: ['sắp_diễn_ra', 'đang_diễn_ra'] } } }),
      DutySchedule.count({ where: { dutyDate: today } }),
      WorkAssignment.count({ where: { status: { [Op.in]: ['chưa_bắt_đầu', 'đang_thực_hiện'] } } }),
    ]);

    res.json({
      personnel: { total: totalPersonnel, tangNi, cuSi, phatTu, tinhNguyenVien, nhanVien },
      followers: totalFollowers,
      trainings: totalTrainings,
      dutyToday,
      pendingWork,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/duty-today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const duties = await DutySchedule.findAll({
      where: { dutyDate: today },
      include: [{ model: Personnel, as: 'personnel', attributes: ['id', 'fullName', 'dharmName', 'photo', 'phone'] }],
      order: [['shift', 'ASC']],
    });
    res.json(duties);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

router.get('/events-upcoming', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const events = await Post.findAll({
      where: {
        type: 'event',
        status: 'approved',
        isPublished: true,
        eventDate: { [Op.between]: [today, in30days] },
      },
      order: [['eventDate', 'ASC']],
      limit: 5,
      attributes: ['id', 'title', 'eventDate', 'eventTime', 'eventLocation', 'coverImage'],
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
