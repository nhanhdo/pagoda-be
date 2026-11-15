const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// JSON array stored in a TEXT column (works the same on SQLite and PostgreSQL)
const jsonArray = (field) => ({
  type: DataTypes.TEXT,
  allowNull: true,
  get() {
    const raw = this.getDataValue(field);
    if (!raw) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  },
  set(v) {
    // Accept already-serialised strings (e.g. raw rows restored from a backup)
    this.setDataValue(field, v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));
  },
});

// Thư viện chư Phật & Bồ Tát
const BuddhaFigure = sequelize.define('BuddhaFigure', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  seedKey: { type: DataTypes.STRING(40), allowNull: true },       // set on built-in entries
  name: { type: DataTypes.STRING(120), allowNull: false },
  kind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'phat' }, // phat | bo_tat | thanh_tang
  title: { type: DataTypes.STRING(200), allowNull: true },        // danh hiệu ngắn
  image: { type: DataTypes.STRING(500), allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  feastDays: jsonArray('feastDays'),                               // [{ day, month, label }] âm lịch

  // Tab "Tiểu sử"
  intro: { type: DataTypes.TEXT, allowNull: true },
  bioSections: jsonArray('bioSections'),                           // [{ heading, body }]
  // Tab "Đại nguyện"
  vowsIntro: { type: DataTypes.TEXT, allowNull: true },
  vows: jsonArray('vows'),                                         // [{ no, text }]
  // Tab "Thần chú"
  mantraText: { type: DataTypes.TEXT, allowNull: true },
  mantraPhonetic: { type: DataTypes.TEXT, allowNull: true },
  mantraMeaning: { type: DataTypes.TEXT, allowNull: true },

  // Legacy (first version of the library) — kept so old data isn't lost
  otherNames: { type: DataTypes.STRING(300), allowNull: true },
  realm: { type: DataTypes.STRING(200), allowNull: true },
  mantra: { type: DataTypes.STRING(300), allowNull: true },
  symbols: { type: DataTypes.TEXT, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },

  createdBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'buddha_figures',
  timestamps: true,
});

BuddhaFigure.KINDS = ['phat', 'bo_tat', 'thanh_tang'];

// Built-in entries; vows given as plain strings are numbered in order
BuddhaFigure.DEFAULTS = require('../seeds/buddhaLibrary').map(({ aliases, vows, ...d }) => ({
  ...d,
  vows: (vows || []).map((v, i) => (typeof v === 'string' ? { no: i + 1, text: v } : v)),
}));

module.exports = BuddhaFigure;
