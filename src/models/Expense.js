const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CATEGORIES = ['điện_nước', 'trai_phạn', 'xây_dựng_sửa_chữa', 'lễ_hội', 'từ_thiện', 'văn_phòng_phẩm', 'khác'];
const STATUSES = ['chờ_duyệt', 'đã_duyệt', 'từ_chối'];
const METHODS = ['tiền_mặt', 'chuyển_khoản', 'khác'];

// Plain strings + isIn (not ENUM) so values can evolve without dialect-specific enum migrations.
const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: true, unique: true },
  fundId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, validate: { min: 0.01 } },
  expenseDate: { type: DataTypes.DATEONLY, allowNull: false },
  category: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'khác', validate: { isIn: [CATEGORIES] } },
  payee: { type: DataTypes.STRING(150), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  paymentMethod: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'tiền_mặt', validate: { isIn: [METHODS] } },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'chờ_duyệt', validate: { isIn: [STATUSES] } },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  rejectReason: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'expenses',
  timestamps: true,
});

Expense.CATEGORIES = CATEGORIES;
Expense.STATUSES = STATUSES;
Expense.METHODS = METHODS;

module.exports = Expense;
