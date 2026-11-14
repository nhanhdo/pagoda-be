const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One name on a registration: a living person (cầu an) or a departed spirit (cầu siêu).
const CeremonyEntry = sequelize.define('CeremonyEntry', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  registrationId: { type: DataTypes.INTEGER, allowNull: false },
  kind: { type: DataTypes.STRING(20), allowNull: false },
  fullName: { type: DataTypes.STRING(150), allowNull: false },
  birthYear: { type: DataTypes.INTEGER, allowNull: true },
  address: { type: DataTypes.STRING(255), allowNull: true },
  deathYear: { type: DataTypes.INTEGER, allowNull: true },
  deathLunarDay: { type: DataTypes.INTEGER, allowNull: true },
  deathLunarMonth: { type: DataTypes.INTEGER, allowNull: true },
  ageAtDeath: { type: DataTypes.INTEGER, allowNull: true },
  gender: { type: DataTypes.STRING(10), allowNull: true },
  memorialTabletId: { type: DataTypes.INTEGER, allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'ceremony_entries',
  timestamps: true,
});

module.exports = CeremonyEntry;
