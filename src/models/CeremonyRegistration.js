const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const KINDS = ['cầu_an', 'cầu_siêu'];
const METHODS = ['tiền_mặt', 'chuyển_khoản', 'khác'];

const CeremonyRegistration = sequelize.define('CeremonyRegistration', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: true, unique: true },
  ceremonyId: { type: DataTypes.INTEGER, allowNull: false },
  kind: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [KINDS] } },
  registrantName: { type: DataTypes.STRING(150), allowNull: false },
  registrantPhone: { type: DataTypes.STRING(30), allowNull: true },
  registrantAddress: { type: DataTypes.STRING(255), allowNull: true },
  buddhistFollowerId: { type: DataTypes.INTEGER, allowNull: true },
  offeringAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  fundId: { type: DataTypes.INTEGER, allowNull: true },
  donationId: { type: DataTypes.INTEGER, allowNull: true },
  paymentMethod: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'tiền_mặt', validate: { isIn: [METHODS] } },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'ceremony_registrations',
  timestamps: true,
});

CeremonyRegistration.KINDS = KINDS;
CeremonyRegistration.METHODS = METHODS;
module.exports = CeremonyRegistration;
