const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const STATUSES = ['đang_thờ', 'đã_thỉnh_về'];

// Slot uniqueness (area,rowNo,slotNo) is enforced in the route for active tablets only,
// so a tablet taken home keeps its history without blocking the slot.
const MemorialTablet = sequelize.define('MemorialTablet', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: true, unique: true },
  spiritName: { type: DataTypes.STRING(150), allowNull: false },
  birthYear: { type: DataTypes.INTEGER, allowNull: true },
  deathYear: { type: DataTypes.INTEGER, allowNull: true },
  deathLunarDay: { type: DataTypes.INTEGER, allowNull: true },
  deathLunarMonth: { type: DataTypes.INTEGER, allowNull: true },
  ageAtDeath: { type: DataTypes.INTEGER, allowNull: true },
  gender: { type: DataTypes.STRING(10), allowNull: true },
  area: { type: DataTypes.STRING(60), allowNull: false },
  rowNo: { type: DataTypes.INTEGER, allowNull: false },
  slotNo: { type: DataTypes.INTEGER, allowNull: false },
  worshipperName: { type: DataTypes.STRING(150), allowNull: true },
  worshipperPhone: { type: DataTypes.STRING(30), allowNull: true },
  buddhistFollowerId: { type: DataTypes.INTEGER, allowNull: true },
  installedDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'đang_thờ', validate: { isIn: [STATUSES] } },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'memorial_tablets',
  timestamps: true,
});

MemorialTablet.STATUSES = STATUSES;
module.exports = MemorialTablet;
