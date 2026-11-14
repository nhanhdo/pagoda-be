// Application-level backup: every table as JSON, independent of SQLite/PostgreSQL.
const models = require('../models');

const { sequelize } = models;
const FORMAT_VERSION = 1;

// Parents before children so foreign keys resolve on restore (reverse order for wiping).
const ORDER = [
  'Department',
  'Personnel',
  'User',
  'DutySchedule',
  'WorkAssignment',
  'Training',
  'TrainingParticipant',
  'RewardDiscipline',
  'BuddhistFollower',
  'Fund',
  'Donation',
  'Expense',
  'MemorialTablet',
  'Ceremony',
  'CeremonyRegistration',
  'CeremonyEntry',
  'Post',
  'Comment',
];

// Any model added later is appended automatically so it is never silently left out of backups.
for (const [name, value] of Object.entries(models)) {
  if (name !== 'sequelize' && value && typeof value.findAll === 'function' && !ORDER.includes(name)) ORDER.push(name);
}

const isPostgres = () => sequelize.getDialect() === 'postgres';

async function buildSnapshot() {
  const tables = {};
  const counts = {};
  for (const name of ORDER) {
    const model = models[name];
    if (!model) continue;
    const rows = await model.findAll({ raw: true, order: [['id', 'ASC']] });
    tables[name] = rows;
    counts[name] = rows.length;
  }
  return {
    app: 'quanlychua',
    formatVersion: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    dialect: sequelize.getDialect(),
    counts,
    tables,
  };
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.app !== 'quanlychua' || typeof snapshot.tables !== 'object') {
    throw new Error('File không phải bản sao lưu hợp lệ của hệ thống');
  }
  if (snapshot.formatVersion > FORMAT_VERSION) {
    throw new Error('Bản sao lưu được tạo bởi phiên bản mới hơn, không thể khôi phục');
  }
  const users = snapshot.tables.User || [];
  if (!users.some(u => u.role === 'admin' && u.isActive !== false && u.isActive !== 0)) {
    throw new Error('Bản sao lưu không có tài khoản quản trị đang hoạt động — từ chối khôi phục để tránh bị khóa ngoài');
  }
}

async function resetSequences(transaction) {
  if (!isPostgres()) return;
  for (const name of ORDER) {
    const model = models[name];
    if (!model) continue;
    const table = model.getTableName();
    const tableName = typeof table === 'object' ? table.tableName : table;
    await sequelize.query(
      `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 0) + 1, false)`,
      { transaction },
    );
  }
}

/** Replaces all data with the snapshot inside one transaction (all-or-nothing). */
async function restoreSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const restored = {};
  await sequelize.transaction(async (transaction) => {
    // Children are wiped before parents and parents inserted before children, so FKs stay valid.
    for (const name of [...ORDER].reverse()) {
      const model = models[name];
      if (model) await model.destroy({ where: {}, truncate: false, hooks: false, transaction });
    }
    for (const name of ORDER) {
      const model = models[name];
      const rows = snapshot.tables[name];
      if (!model || !Array.isArray(rows) || !rows.length) { restored[name] = 0; continue; }
      for (let i = 0; i < rows.length; i += 500) {
        await model.bulkCreate(rows.slice(i, i + 500), { hooks: false, validate: false, transaction });
      }
      restored[name] = rows.length;
    }
    await resetSequences(transaction);
  });
  await require('../config/migrate').runMigrations(sequelize);
  return restored;
}

/* ── Off-site copies on Cloudinary (optional; Render's disk is ephemeral) ───────── */
// Backups hold personal data and password hashes, so they are stored as *authenticated*
// assets (not publicly deliverable) and only handed out as short-lived signed URLs.
const CLOUD_FOLDER = 'quanlychua/backups';
const KEEP = {
  auto: parseInt(process.env.BACKUP_KEEP || '14', 10),
  manual: parseInt(process.env.BACKUP_KEEP_MANUAL || '20', 10),
  'before-restore': parseInt(process.env.BACKUP_KEEP_SAFETY || '10', 10),
};
const LINK_TTL_SECONDS = 10 * 60;
const AUTO_MIN_GAP_MS = 20 * 60 * 60 * 1000;

const cloudEnabled = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

function cloud() {
  return require('../config/cloudinary').cloudinary;
}

const kindOf = (publicId) => {
  if (publicId.includes('backup_before-restore_')) return 'before-restore';
  if (publicId.includes('backup_manual_')) return 'manual';
  return 'auto';
};

function signedUrl(publicId, deliveryType) {
  return cloud().utils.private_download_url(publicId, '', {
    resource_type: 'raw',
    type: deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
    attachment: true,
  });
}

async function uploadSnapshot(snapshot, label = 'auto') {
  if (!cloudEnabled()) throw new Error('Chưa cấu hình Cloudinary nên không thể lưu bản sao lên cloud');
  const stamp = snapshot.createdAt.replace(/[:.]/g, '-');
  const buffer = Buffer.from(JSON.stringify(snapshot));
  const result = await new Promise((resolve, reject) => {
    const stream = cloud().uploader.upload_stream(
      { resource_type: 'raw', type: 'authenticated', folder: CLOUD_FOLDER, public_id: `backup_${label}_${stamp}.json`, overwrite: false },
      (err, res) => (err ? reject(err) : resolve(res)),
    );
    stream.end(buffer);
  });
  await pruneCloud().catch((e) => console.error('[backup] Dọn bản cũ thất bại:', e.message));
  return { publicId: result.public_id, bytes: result.bytes, createdAt: snapshot.createdAt, kind: kindOf(result.public_id) };
}

async function listType(deliveryType) {
  const out = [];
  let cursor;
  do {
    const res = await cloud().api.resources({
      resource_type: 'raw', type: deliveryType, prefix: `${CLOUD_FOLDER}/`, max_results: 500, next_cursor: cursor,
    });
    (res.resources || []).forEach(r => out.push({ publicId: r.public_id, bytes: r.bytes, createdAt: r.created_at, deliveryType }));
    cursor = res.next_cursor;
  } while (cursor);
  return out;
}

/** All cloud copies, newest first. Includes legacy public uploads so they can be pruned. */
async function listCloud({ withLinks = false } = {}) {
  if (!cloudEnabled()) return [];
  const [secure, legacy] = await Promise.all([
    listType('authenticated'),
    listType('upload').catch(() => []),
  ]);
  return [...secure, ...legacy]
    .map(r => ({ ...r, kind: kindOf(r.publicId), url: withLinks ? signedUrl(r.publicId, r.deliveryType) : undefined }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function pruneCloud() {
  const all = await listCloud();
  for (const kind of Object.keys(KEEP)) {
    const ofKind = all.filter(r => r.kind === kind);
    for (const old of ofKind.slice(KEEP[kind])) {
      await cloud().uploader.destroy(old.publicId, { resource_type: 'raw', type: old.deliveryType }).catch(() => {});
    }
  }
}

let lastAuto = null;
function scheduleDailyBackups() {
  if (!cloudEnabled() || process.env.BACKUP_DISABLED === 'true') {
    console.log('[backup] Tự động sao lưu: tắt (chưa cấu hình Cloudinary hoặc BACKUP_DISABLED=true)');
    return;
  }
  const run = async () => {
    try {
      // Hosts that sleep/wake (e.g. Render free) restart often; don't let every boot create a copy.
      const newest = (await listCloud()).find(r => r.kind === 'auto');
      if (newest && Date.now() - new Date(newest.createdAt).getTime() < AUTO_MIN_GAP_MS) return;
      const snap = await buildSnapshot();
      lastAuto = await uploadSnapshot(snap, 'auto');
      console.log('[backup] Đã sao lưu tự động:', lastAuto.publicId);
    } catch (e) {
      console.error('[backup] Sao lưu tự động thất bại:', e.message);
    }
  };
  setTimeout(run, 2 * 60 * 1000);
  setInterval(run, 60 * 60 * 1000); // check hourly; the 20h gap keeps it to ~1 copy/day
  console.log('[backup] Tự động sao lưu: bật (khoảng mỗi 24 giờ, giữ', KEEP.auto, 'bản)');
}

module.exports = {
  buildSnapshot,
  restoreSnapshot,
  validateSnapshot,
  uploadSnapshot,
  listCloud,
  cloudEnabled,
  scheduleDailyBackups,
  getLastAuto: () => lastAuto,
};
