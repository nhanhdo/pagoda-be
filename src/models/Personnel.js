const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Personnel = sequelize.define('Personnel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },

  // Hồ sơ cá nhân
  fullName: { type: DataTypes.STRING(100), allowNull: false },
  dharmName: { type: DataTypes.STRING(100), allowNull: true, comment: 'Pháp danh' },
  gender: { type: DataTypes.ENUM('nam', 'nữ'), allowNull: false },
  dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true },
  idCard: { type: DataTypes.STRING(20), allowNull: true, comment: 'CCCD' },
  address: { type: DataTypes.TEXT, allowNull: true },
  phone: { type: DataTypes.STRING(15), allowNull: true },
  email: { type: DataTypes.STRING(100), allowNull: true },
  photo: { type: DataTypes.STRING(255), allowNull: true },
  emergencyContact: { type: DataTypes.STRING(100), allowNull: true, comment: 'Liên lạc khẩn cấp' },
  emergencyPhone: { type: DataTypes.STRING(15), allowNull: true },

  // Thông tin tu học
  type: {
    type: DataTypes.ENUM('tang_ni', 'cu_si', 'phat_tu', 'tinh_nguyen_vien', 'nhan_vien'),
    allowNull: false,
    defaultValue: 'phat_tu',
    comment: 'Loại: tăng ni, cư sĩ, phật tử, TNV, nhân viên',
  },
  ordinationDate: { type: DataTypes.DATEONLY, allowNull: true, comment: 'Ngày xuất gia' },
  preceptorName: { type: DataTypes.STRING(100), allowNull: true, comment: 'Bổn sư' },
  precept: { type: DataTypes.STRING(100), allowNull: true, comment: 'Giới phẩm' },
  buddhismEducation: { type: DataTypes.STRING(100), allowNull: true, comment: 'Trình độ Phật học' },
  secularEducation: { type: DataTypes.STRING(100), allowNull: true, comment: 'Trình độ thế học' },

  // Chức vụ
  position: {
    type: DataTypes.ENUM(
      'trụ_trì', 'phó_trụ_trì', 'tri_khách', 'thủ_quỹ', 'thư_ký',
      'ban_hộ_tự', 'trưởng_ban', 'phó_ban', 'thành_viên', 'tình_nguyện_viên'
    ),
    allowNull: true,
  },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  joinDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM('đang_hoạt_động', 'tạm_nghỉ', 'đã_rời'),
    defaultValue: 'đang_hoạt_động',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'personnel',
  timestamps: true,
});

module.exports = Personnel;
