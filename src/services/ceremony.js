// Ceremony registrations (cầu an / cầu siêu): validation, numbering, and the linked offering donation.
const { Op } = require('sequelize');
const {
  sequelize, Fund, Donation, BuddhistFollower, Ceremony, CeremonyRegistration, CeremonyEntry, MemorialTablet,
} = require('../models');
const { num, ymd, nextCode, nextReceiptNo, withRetry } = require('./finance');
const { lunarToSolarChecked } = require('../utils/lunar');

// Roles allowed to reduce or remove money already recorded as a donation (same as deleting a donation).
const FINANCE_OVERRIDE = ['admin', 'truotri'];

const KIND_LABEL = { 'cầu_an': 'Cầu an', 'cầu_siêu': 'Cầu siêu' };
const THIS_YEAR = () => new Date().getFullYear();

const intOrNull = (v) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10));

function yearOk(y, { allowFuture = false } = {}) {
  if (y === null || y === undefined) return true;
  return Number.isInteger(y) && y >= 1850 && y <= THIS_YEAR() + (allowFuture ? 5 : 0);
}

/* ── Ceremonies ─────────────────────────────────────────────────────── */
async function festivalFundId(transaction) {
  const f = await Fund.findOne({ where: { code: 'LE_HOI' }, transaction });
  return f ? f.id : null;
}

function validateCeremony(d) {
  if (!d.name || !String(d.name).trim()) return 'Nhập tên đàn lễ';
  if (d.ceremonyType && !Ceremony.TYPES.includes(d.ceremonyType)) return 'Loại đàn lễ không hợp lệ';
  if (!Number.isInteger(d.year) || d.year < 2000 || d.year > 2100) return 'Năm không hợp lệ';
  if (!Number.isInteger(d.lunarDay) || d.lunarDay < 1 || d.lunarDay > 30) return 'Ngày âm lịch phải từ 1 đến 30';
  if (!Number.isInteger(d.lunarMonth) || d.lunarMonth < 1 || d.lunarMonth > 12) return 'Tháng âm lịch phải từ 1 đến 12';
  return null;
}

/** Normalises a ceremony payload; computes the solar date from the lunar date unless one is given. */
async function ceremonyPayload(body, existing = null) {
  const pick = (k) => (body[k] !== undefined ? body[k] : existing?.[k]);
  const data = {
    name: pick('name'),
    ceremonyType: pick('ceremonyType') || 'cả_hai',
    year: intOrNull(pick('year')),
    lunarDay: intOrNull(pick('lunarDay')),
    lunarMonth: intOrNull(pick('lunarMonth')),
    registrationOpen: pick('registrationOpen') !== undefined ? Boolean(pick('registrationOpen')) : true,
    location: pick('location') || null,
    notes: pick('notes') || null,
    defaultFundId: pick('defaultFundId') || null,
    sortOrder: intOrNull(pick('sortOrder')) || 0,
  };
  const err = validateCeremony(data);
  if (err) return { err };
  const lunarChanged = !existing || ['year', 'lunarDay', 'lunarMonth'].some(k => body[k] !== undefined && intOrNull(body[k]) !== existing[k]);
  // Validate the lunar date itself (e.g. day 30 in a 29-day month) even when a solar date is given manually
  if (!existing || lunarChanged) {
    const conv = lunarToSolarChecked(data.lunarDay, data.lunarMonth, data.year);
    if (conv.err) return { err: conv.err };
    if (!body.solarDate) data.solarDate = conv.iso;
  }
  if (body.solarDate) data.solarDate = body.solarDate;
  if (!data.solarDate) data.solarDate = existing?.solarDate || null;
  if (!data.solarDate) return { err: 'Ngày âm lịch không tồn tại trong năm này' };
  if (!data.defaultFundId) data.defaultFundId = await festivalFundId();
  return { data };
}

async function ceremonyStats(ids) {
  if (!ids.length) return {};
  const regs = await CeremonyRegistration.findAll({
    where: { ceremonyId: { [Op.in]: ids } },
    attributes: ['ceremonyId', 'kind', [sequelize.fn('COUNT', sequelize.col('id')), 'count'], [sequelize.fn('SUM', sequelize.col('offeringAmount')), 'offering']],
    group: ['ceremonyId', 'kind'], raw: true,
  });
  const entries = await CeremonyEntry.findAll({
    attributes: ['kind', [sequelize.fn('COUNT', sequelize.col('CeremonyEntry.id')), 'count']],
    include: [{ model: CeremonyRegistration, as: 'registration', attributes: ['ceremonyId'], where: { ceremonyId: { [Op.in]: ids } } }],
    group: ['registration.ceremonyId', 'CeremonyEntry.kind'], raw: true,
  });
  const out = {};
  const get = (id) => (out[id] = out[id] || {
    registrations: { 'cầu_an': 0, 'cầu_siêu': 0 }, names: { 'cầu_an': 0, 'cầu_siêu': 0 }, offering: 0,
  });
  regs.forEach(r => { const s = get(r.ceremonyId); s.registrations[r.kind] = num(r.count); s.offering += num(r.offering); });
  entries.forEach(r => { const s = get(r['registration.ceremonyId']); s.names[r.kind] = num(r.count); });
  return out;
}

/* ── Registrations ──────────────────────────────────────────────────── */
function cleanEntries(kind, entries) {
  if (!Array.isArray(entries)) return { err: 'Danh sách tên không hợp lệ' };
  const list = entries
    .map((e, i) => ({
      kind,
      fullName: String(e.fullName || '').trim(),
      birthYear: intOrNull(e.birthYear),
      address: kind === 'cầu_an' ? (e.address || null) : null,
      deathYear: kind === 'cầu_siêu' ? intOrNull(e.deathYear) : null,
      deathLunarDay: kind === 'cầu_siêu' ? intOrNull(e.deathLunarDay) : null,
      deathLunarMonth: kind === 'cầu_siêu' ? intOrNull(e.deathLunarMonth) : null,
      ageAtDeath: kind === 'cầu_siêu' ? intOrNull(e.ageAtDeath) : null,
      gender: e.gender || null,
      memorialTabletId: kind === 'cầu_siêu' ? (intOrNull(e.memorialTabletId) || null) : null,
      sortOrder: i,
    }))
    .filter(e => e.fullName);
  if (!list.length) return { err: 'Cần ít nhất một tên trong đăng ký' };
  for (const e of list) {
    if (!yearOk(e.birthYear)) return { err: `Năm sinh không hợp lệ: ${e.fullName}` };
    if (!yearOk(e.deathYear)) return { err: `Năm mất không hợp lệ: ${e.fullName}` };
    if (e.birthYear && e.deathYear && e.deathYear < e.birthYear) return { err: `Năm mất trước năm sinh: ${e.fullName}` };
    if (e.deathLunarDay !== null && (e.deathLunarDay < 1 || e.deathLunarDay > 30)) return { err: `Ngày mất âm lịch phải từ 1 đến 30: ${e.fullName}` };
    if (e.deathLunarMonth !== null && (e.deathLunarMonth < 1 || e.deathLunarMonth > 12)) return { err: `Tháng mất âm lịch phải từ 1 đến 12: ${e.fullName}` };
    if (e.ageAtDeath !== null && (e.ageAtDeath < 0 || e.ageAtDeath > 130)) return { err: `Hưởng thọ không hợp lệ: ${e.fullName}` };
  }
  return { list };
}

async function syncFollowerContribution(buddhistFollowerId, transaction) {
  if (!buddhistFollowerId) return;
  const total = num(await Donation.sum('amount', { where: { buddhistFollowerId }, transaction }));
  await BuddhistFollower.update({ contributionAmount: total }, { where: { id: buddhistFollowerId }, transaction });
}

/** Creates/updates/removes the offering donation that mirrors a registration. */
async function syncDonation(reg, ceremony, transaction) {
  const amount = num(reg.offeringAmount);
  const purpose = `${KIND_LABEL[reg.kind]} – ${ceremony.name}`;
  let donation = reg.donationId ? await Donation.findByPk(reg.donationId, { transaction }) : null;
  const followerIds = new Set([donation?.buddhistFollowerId, reg.buddhistFollowerId].filter(Boolean));

  if (amount <= 0) {
    if (donation) await donation.destroy({ transaction });
    if (reg.donationId) await reg.update({ donationId: null }, { transaction });
  } else {
    const fields = {
      amount,
      fundId: reg.fundId,
      buddhistFollowerId: reg.buddhistFollowerId || null,
      donorName: reg.buddhistFollowerId ? null : reg.registrantName,
      purpose,
      paymentMethod: reg.paymentMethod,
      notes: `Đăng ký ${reg.code}`,
    };
    if (donation) {
      await donation.update(fields, { transaction });
    } else {
      const donationDate = ymd(new Date());
      donation = await Donation.create({
        ...fields, donationDate, receiptNo: await nextReceiptNo(donationDate, transaction),
      }, { transaction });
      await reg.update({ donationId: donation.id }, { transaction });
    }
  }
  for (const id of followerIds) await syncFollowerContribution(id, transaction);
  return donation;
}

const regInclude = [
  { model: CeremonyEntry, as: 'entries', separate: true, order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    include: [{ model: MemorialTablet, as: 'tablet', attributes: ['id', 'code', 'area', 'rowNo', 'slotNo'] }] },
  { model: Fund, as: 'fund', attributes: ['id', 'code', 'name', 'color'] },
  { model: Donation, as: 'donation', attributes: ['id', 'receiptNo', 'amount', 'donationDate', 'paymentMethod', 'purpose', 'donorName', 'buddhistFollowerId'] },
  { model: BuddhistFollower, as: 'buddhistFollower', attributes: ['id', 'fullName', 'dharmName', 'code'] },
];

async function saveRegistration({ body, user, existing = null }) {
  const ceremonyId = intOrNull(body.ceremonyId ?? existing?.ceremonyId);
  const ceremony = ceremonyId ? await Ceremony.findByPk(ceremonyId) : null;
  if (!ceremony) return { status: 400, err: 'Đàn lễ không tồn tại' };
  // Closed ceremonies take no new names — neither new registrations nor ones moved in from another ceremony
  const joiningCeremony = !existing || existing.ceremonyId !== ceremonyId;
  if (joiningCeremony && !ceremony.registrationOpen && user.role !== 'admin') {
    return { status: 400, err: 'Đàn lễ đã khóa đăng ký' };
  }
  const kind = body.kind ?? existing?.kind;
  if (!CeremonyRegistration.KINDS.includes(kind)) return { status: 400, err: 'Loại đăng ký không hợp lệ' };
  if (ceremony.ceremonyType !== 'cả_hai' && ceremony.ceremonyType !== kind) {
    return { status: 400, err: `Đàn lễ này chỉ nhận ${KIND_LABEL[ceremony.ceremonyType].toLowerCase()}` };
  }
  const registrantName = String(body.registrantName ?? existing?.registrantName ?? '').trim();
  if (!registrantName) return { status: 400, err: 'Nhập tên người đăng ký' };
  const offeringAmount = num(body.offeringAmount ?? existing?.offeringAmount);
  if (offeringAmount < 0) return { status: 400, err: 'Số tiền cúng dường không hợp lệ' };
  // Lowering/removing an offering that already has a receipt deletes or changes recorded money
  if (existing?.donationId && offeringAmount < num(existing.offeringAmount) && !FINANCE_OVERRIDE.includes(user.role)) {
    return { status: 403, err: 'Chỉ admin hoặc trụ trì được giảm hoặc hủy khoản cúng dường đã ghi phiếu thu' };
  }
  const paymentMethod = body.paymentMethod ?? existing?.paymentMethod ?? 'tiền_mặt';
  if (!CeremonyRegistration.METHODS.includes(paymentMethod)) return { status: 400, err: 'Hình thức không hợp lệ' };

  let entries = null;
  if (body.entries !== undefined || !existing) {
    const r = cleanEntries(kind, body.entries || []);
    if (r.err) return { status: 400, err: r.err };
    entries = r.list;
  }

  // Retry regenerates registration/receipt numbers if a concurrent request took them first
  const result = await withRetry(() => sequelize.transaction(async (transaction) => {
    const fundId = intOrNull(body.fundId) || existing?.fundId || ceremony.defaultFundId || await festivalFundId(transaction);
    const fields = {
      ceremonyId, kind, registrantName,
      registrantPhone: body.registrantPhone ?? existing?.registrantPhone ?? null,
      registrantAddress: body.registrantAddress ?? existing?.registrantAddress ?? null,
      buddhistFollowerId: intOrNull(body.buddhistFollowerId !== undefined ? body.buddhistFollowerId : existing?.buddhistFollowerId) || null,
      offeringAmount, fundId, paymentMethod,
      notes: body.notes ?? existing?.notes ?? null,
    };
    let reg;
    if (existing) {
      reg = await existing.update(fields, { transaction });
    } else {
      const code = await nextCode(CeremonyRegistration, 'code', 'DK', ymd(new Date()), transaction);
      reg = await CeremonyRegistration.create({ ...fields, code, createdBy: user.id }, { transaction });
    }
    if (entries) {
      await CeremonyEntry.destroy({ where: { registrationId: reg.id }, transaction });
      await CeremonyEntry.bulkCreate(entries.map(e => ({ ...e, registrationId: reg.id })), { transaction });
    } else if (existing && body.kind && body.kind !== existing.kind) {
      await CeremonyEntry.update({ kind }, { where: { registrationId: reg.id }, transaction });
    }
    await syncDonation(reg, ceremony, transaction);
    return reg;
  }));
  return { reg: await CeremonyRegistration.findByPk(result.id, { include: regInclude }) };
}

async function deleteRegistration(reg) {
  await sequelize.transaction(async (transaction) => {
    const donation = reg.donationId ? await Donation.findByPk(reg.donationId, { transaction }) : null;
    const followerId = donation?.buddhistFollowerId;
    if (donation) await donation.destroy({ transaction });
    await CeremonyEntry.destroy({ where: { registrationId: reg.id }, transaction });
    await reg.destroy({ transaction });
    await syncFollowerContribution(followerId, transaction);
  });
}

module.exports = {
  KIND_LABEL, FINANCE_OVERRIDE, ceremonyPayload, ceremonyStats, regInclude, saveRegistration, deleteRegistration, intOrNull, yearOk,
};
