const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkAssignment = sequelize.define('WorkAssignment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  personnelId: { type: DataTypes.INTEGER, allowNull: false },
  assignedBy: { type: DataTypes.INTEGER, allowNull: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  priority: {
    type: DataTypes.ENUM('thấp', 'trung_bình', 'cao', 'khẩn_cấp'),
    defaultValue: 'trung_bình',
  },
  status: {
    type: DataTypes.ENUM('chưa_bắt_đầu', 'đang_thực_hiện', 'hoàn_thành', 'tạm_dừng', 'hủy'),
    defaultValue: 'chưa_bắt_đầu',
  },
  completedDate: { type: DataTypes.DATEONLY, allowNull: true },
  result: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'work_assignments',
  timestamps: true,
});

module.exports = WorkAssignment;
