const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TYPES = ['cầu_an', 'cầu_siêu', 'cả_hai'];

const Ceremony = sequelize.define('Ceremony', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  ceremonyType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'cả_hai', validate: { isIn: [TYPES] } },
  year: { type: DataTypes.INTEGER, allowNull: false },
  lunarDay: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 30 } },
  lunarMonth: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 12 } },
  solarDate: { type: DataTypes.DATEONLY, allowNull: true },
  registrationOpen: { type: DataTypes.BOOLEAN, defaultValue: true },
  location: { type: DataTypes.STRING(200), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  defaultFundId: { type: DataTypes.INTEGER, allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'ceremonies',
  timestamps: true,
});

Ceremony.TYPES = TYPES;
module.exports = Ceremony;
