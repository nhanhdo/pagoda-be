const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RewardDiscipline = sequelize.define('RewardDiscipline', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  personnelId: { type: DataTypes.INTEGER, allowNull: false },
  type: {
    type: DataTypes.ENUM('khen_thưởng', 'kỷ_luật'),
    allowNull: false,
  },
  subType: {
    type: DataTypes.ENUM(
      'giấy_khen', 'công_đức_xuất_sắc', 'bằng_khen',
      'khiển_trách', 'cảnh_cáo', 'tạm_đình_chỉ', 'đình_chỉ'
    ),
    allowNull: false,
  },
  title: { type: DataTypes.STRING(200), allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  issuedDate: { type: DataTypes.DATEONLY, allowNull: false },
  issuedBy: { type: DataTypes.STRING(100), allowNull: true },
  attachment: { type: DataTypes.STRING(255), allowNull: true },
  validUntil: { type: DataTypes.DATEONLY, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'reward_disciplines',
  timestamps: true,
});

module.exports = RewardDiscipline;
