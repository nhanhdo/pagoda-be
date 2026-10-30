const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Training = sequelize.define('Training', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  type: {
    type: DataTypes.ENUM('khóa_phật_học', 'an_cư_kiết_hạ', 'giới_đàn', 'bồi_dưỡng', 'khác'),
    allowNull: false,
  },
  description: { type: DataTypes.TEXT, allowNull: true },
  location: { type: DataTypes.STRING(200), allowNull: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  instructor: { type: DataTypes.STRING(100), allowNull: true },
  maxParticipants: { type: DataTypes.INTEGER, allowNull: true },
  status: {
    type: DataTypes.ENUM('sắp_diễn_ra', 'đang_diễn_ra', 'hoàn_thành', 'hủy'),
    defaultValue: 'sắp_diễn_ra',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'trainings',
  timestamps: true,
});

module.exports = Training;
