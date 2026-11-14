const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BuddhistFollower = sequelize.define('BuddhistFollower', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  fullName: { type: DataTypes.STRING(100), allowNull: false },
  dharmName: { type: DataTypes.STRING(100), allowNull: true, comment: 'Pháp danh' },
  gender: { type: DataTypes.ENUM('nam', 'nữ'), allowNull: true },
  dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true },
  phone: { type: DataTypes.STRING(15), allowNull: true },
  email: { type: DataTypes.STRING(100), allowNull: true },
  address: { type: DataTypes.TEXT, allowNull: true },
  occupation: { type: DataTypes.STRING(100), allowNull: true, comment: 'Nghề nghiệp' },
  region: { type: DataTypes.STRING(100), allowNull: true, comment: 'Khu vực sinh hoạt' },
  preceptDate: { type: DataTypes.DATEONLY, allowNull: true, comment: 'Ngày quy y' },
  preceptorName: { type: DataTypes.STRING(100), allowNull: true },
  type: {
    type: DataTypes.ENUM('phật_tử', 'tình_nguyện_viên', 'cả_hai'),
    defaultValue: 'phật_tử',
  },
  publicServiceHours: { type: DataTypes.FLOAT, defaultValue: 0, comment: 'Giờ công quả' },
  contributionAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, comment: 'Đóng góp' },
  status: {
    type: DataTypes.ENUM('đang_sinh_hoạt', 'tạm_ngưng', 'đã_rời'),
    defaultValue: 'đang_sinh_hoạt',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  photo: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'buddhist_followers',
  timestamps: true,
});

module.exports = BuddhistFollower;
