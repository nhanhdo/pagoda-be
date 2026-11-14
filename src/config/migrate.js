// Idempotent schema upgrades that sequelize.sync() can't do (it never adds columns to existing tables).
// Uses queryInterface so it runs on both SQLite and PostgreSQL.
const { DataTypes, Op } = require('sequelize');

async function addColumnIfMissing(qi, table, column, spec) {
  const desc = await qi.describeTable(table);
  if (!desc[column]) {
    await qi.addColumn(table, column, spec);
    console.log(`[migrate] Added ${table}.${column}`);
  }
}

async function hasUniqueIndexOn(qi, table, column) {
  const indexes = await qi.showIndex(table);
  return indexes.some(i => i.unique && Array.isArray(i.fields) && i.fields.length === 1
    && (i.fields[0].attribute === column || i.fields[0].name === column));
}

/**
 * Ensures a unique index on a document-number column. Existing duplicates (possible before the
 * index existed, e.g. two concurrent creates) keep the oldest row's number; the others are renumbered.
 */
async function ensureUniqueCode(sequelize, model, column, nextNumber) {
  const qi = sequelize.getQueryInterface();
  const table = model.getTableName();
  const tableName = typeof table === 'object' ? table.tableName : table;
  if (await hasUniqueIndexOn(qi, tableName, column)) return;
  const dupes = await model.findAll({
    attributes: [column, [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    where: { [column]: { [Op.ne]: null } },
    group: [column],
    having: sequelize.where(sequelize.fn('COUNT', sequelize.col('id')), '>', 1),
    raw: true,
  });
  for (const d of dupes) {
    const rows = await model.findAll({ where: { [column]: d[column] }, order: [['id', 'ASC']] });
    for (const row of rows.slice(1)) {
      await row.update({ [column]: await nextNumber(row) }, { hooks: false });
    }
    console.log(`[migrate] Renumbered ${rows.length - 1} duplicate ${tableName}.${column} "${d[column]}"`);
  }
  await qi.addIndex(tableName, [column], { unique: true, name: `${tableName}_${column}_unique` });
  console.log(`[migrate] Added unique index on ${tableName}.${column}`);
}

/** One active linh vị per (area, row, slot); area compared case-insensitively. Partial index works on SQLite and PostgreSQL. */
async function ensureActiveSlotIndex(sequelize) {
  const qi = sequelize.getQueryInterface();
  const name = 'memorial_tablets_active_slot';
  const indexes = await qi.showIndex('memorial_tablets');
  if (indexes.some(i => i.name === name)) return;
  const [dupes] = await sequelize.query(
    'SELECT lower(area) AS a, "rowNo", "slotNo", COUNT(*) AS n FROM memorial_tablets WHERE status = \'đang_thờ\' GROUP BY lower(area), "rowNo", "slotNo" HAVING COUNT(*) > 1',
  );
  if (dupes.length) {
    console.warn(`[migrate] ${dupes.length} vị trí linh vị đang bị trùng — chưa thể thêm ràng buộc duy nhất, cần xử lý thủ công`);
    return;
  }
  await sequelize.query(`CREATE UNIQUE INDEX ${name} ON memorial_tablets (lower(area), "rowNo", "slotNo") WHERE status = 'đang_thờ'`);
  console.log('[migrate] Added unique index on active memorial tablet slots');
}

async function runMigrations(sequelize) {
  const qi = sequelize.getQueryInterface();
  const { Fund, Donation } = require('../models');

  // 1. Donations → fund + receipt number
  await addColumnIfMissing(qi, 'donations', 'fundId', { type: DataTypes.INTEGER, allowNull: true });
  await addColumnIfMissing(qi, 'donations', 'receiptNo', { type: DataTypes.STRING(20), allowNull: true });

  // 2. Default funds
  if ((await Fund.count()) === 0) {
    await Fund.bulkCreate(Fund.DEFAULTS);
    console.log('[migrate] Seeded default funds');
  }
  const general = await Fund.findOne({ where: { code: Fund.DEFAULT_CODE } });

  // 3. Backfill donations without a fund / receipt number
  if (general) {
    const [n] = await Donation.update({ fundId: general.id }, { where: { fundId: null } });
    if (n) console.log(`[migrate] Assigned ${n} donation(s) to ${general.name}`);
  }
  const missing = await Donation.findAll({
    where: { [Op.or]: [{ receiptNo: null }, { receiptNo: '' }] },
    order: [['donationDate', 'ASC'], ['id', 'ASC']],
  });
  if (missing.length) {
    const existing = await Donation.findAll({ where: { receiptNo: { [Op.like]: 'PT-%' } }, attributes: ['receiptNo'], raw: true });
    const maxByYear = {};
    existing.forEach(r => {
      const [, y, seq] = String(r.receiptNo).split('-');
      maxByYear[y] = Math.max(maxByYear[y] || 0, parseInt(seq, 10) || 0);
    });
    for (const d of missing) {
      const y = String(d.donationDate).slice(0, 4);
      maxByYear[y] = (maxByYear[y] || 0) + 1;
      await d.update({ receiptNo: `PT-${y}-${String(maxByYear[y]).padStart(4, '0')}` }, { hooks: false });
    }
    console.log(`[migrate] Numbered ${missing.length} receipt(s)`);
  }

  // 4. Unique document numbers + active tablet slots (guards against concurrent creates)
  const { nextCode, ymd } = require('../services/finance');
  const { Expense, CeremonyRegistration, MemorialTablet } = require('../models');
  await ensureUniqueCode(sequelize, Donation, 'receiptNo', (r) => nextCode(Donation, 'receiptNo', 'PT', r.donationDate));
  await ensureUniqueCode(sequelize, Expense, 'code', (r) => nextCode(Expense, 'code', 'PC', r.expenseDate));
  await ensureUniqueCode(sequelize, CeremonyRegistration, 'code', (r) => nextCode(CeremonyRegistration, 'code', 'DK', ymd(new Date(r.createdAt || Date.now()))));
  await ensureUniqueCode(sequelize, MemorialTablet, 'code', async () => {
    const codes = await MemorialTablet.findAll({ where: { code: { [Op.like]: 'LV-%' } }, attributes: ['code'], raw: true });
    const max = codes.reduce((m, c) => Math.max(m, parseInt(String(c.code).split('-').pop(), 10) || 0), 0);
    return `LV-${String(max + 1).padStart(4, '0')}`;
  });
  await ensureActiveSlotIndex(sequelize);
}

module.exports = { runMigrations };
