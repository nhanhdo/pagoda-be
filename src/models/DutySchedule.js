const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DutySchedule = sequelize.define('DutySchedule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  personnelId: { type: DataTypes.INTEGER, allowNull: false },
  dutyType: {
    type: DataTypes.ENUM('trực_cổng', 'trực_điện_phật', 'trực_văn_phòng', 'trực_lễ_hội', 'công_phu_sáng', 'công_phu_chiều', 'khác'),
    allowNull: false,
  },
  dutyDate: { type: DataTypes.DATEONLY, allowNull: false },
  shift: {
    type: DataTypes.ENUM('sáng', 'chiều', 'tối', 'cả_ngày'),
    allowNull: false,
    defaultValue: 'cả_ngày',
  },
  startTime: { type: DataTypes.STRING(5), allowNull: true },
  endTime: { type: DataTypes.STRING(5), allowNull: true },
  status: {
    type: DataTypes.ENUM('chờ', 'hoàn_thành', 'vắng', 'đổi_ca'),
    defaultValue: 'chờ',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'duty_schedules',
  timestamps: true,
});

module.exports = DutySchedule;
