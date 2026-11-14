const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TrainingParticipant = sequelize.define('TrainingParticipant', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  trainingId: { type: DataTypes.INTEGER, allowNull: false },
  personnelId: { type: DataTypes.INTEGER, allowNull: false },
  registrationDate: { type: DataTypes.DATEONLY, allowNull: true },
  attendance: { type: DataTypes.FLOAT, allowNull: true, comment: 'Tỷ lệ tham dự %' },
  result: {
    type: DataTypes.ENUM('đạt', 'không_đạt', 'chưa_đánh_giá'),
    defaultValue: 'chưa_đánh_giá',
  },
  grade: { type: DataTypes.STRING(20), allowNull: true, comment: 'Điểm/Xếp loại' },
  certificate: { type: DataTypes.STRING(255), allowNull: true, comment: 'File chứng nhận' },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'training_participants',
  timestamps: true,
});

module.exports = TrainingParticipant;
