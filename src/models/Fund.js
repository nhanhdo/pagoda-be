const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Fund = sequelize.define('Fund', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  targetAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
  color: { type: DataTypes.STRING(20), allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'funds',
  timestamps: true,
});

Fund.DEFAULTS = [
  { code: 'QUY_CHUNG', name: 'Quỹ chung',  color: '#c47f36', sortOrder: 1, description: 'Chi tiêu thường xuyên của chùa' },
  { code: 'XAY_DUNG',  name: 'Xây dựng',   color: '#4d8fc7', sortOrder: 2, description: 'Xây dựng, trùng tu, sửa chữa' },
  { code: 'TU_THIEN',  name: 'Từ thiện',   color: '#d9646c', sortOrder: 3, description: 'Công tác từ thiện xã hội' },
  { code: 'TRAI_TANG', name: 'Trai tăng',  color: '#4f9a72', sortOrder: 4, description: 'Cúng dường trai tăng' },
  { code: 'LE_HOI',    name: 'Lễ hội',     color: '#8b6fc9', sortOrder: 5, description: 'Tổ chức các đại lễ, lễ hội' },
];
Fund.DEFAULT_CODE = 'QUY_CHUNG';

module.exports = Fund;
