const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Donation = sequelize.define('Donation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  buddhistFollowerId: { type: DataTypes.INTEGER, allowNull: true },
  donorName: { type: DataTypes.STRING(100), allowNull: true, comment: 'Tên người cúng nếu không có trong danh sách' },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  donationDate: { type: DataTypes.DATEONLY, allowNull: false },
  purpose: { type: DataTypes.TEXT, allowNull: true, comment: 'Mục đích cúng dường' },
  paymentMethod: {
    type: DataTypes.ENUM('tiền_mặt', 'chuyển_khoản', 'khác'),
    defaultValue: 'tiền_mặt',
  },
  receivedBy: { type: DataTypes.STRING(100), allowNull: true, comment: 'Người nhận' },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'donations',
  timestamps: true,
});

module.exports = Donation;
