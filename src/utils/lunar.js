// Vietnamese lunar calendar (UTC+7): Hồ Ngọc Đức's month/leap-month structure with Meeus' full new-moon
// algorithm (the simplified one put some near-midnight new moons on the wrong day, e.g. Vu Lan 2026).
// Same maths as frontend/src/utils/lunarCalendar.ts, plus the lunar → solar direction for ceremonies.
const TZ = 7;
const DR = Math.PI / 180;
const INT = Math.floor;

function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

function jdToDate(jd) {
  let b; let c;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = b * 100 + d - 4800 + INT(m / 10);
  return [day, month, year];
}

/* ── New moon: Jean Meeus, Astronomical Algorithms (2nd ed.) ch. 49, full series ──
   k follows Hồ Ngọc Đức's numbering (k = 0 near 1900-01-01); Meeus' k = k − 1237.
   Returns the local (UTC+7) Julian day number of the new moon. */
function deltaTSeconds(y) {
  if (y < 1860) { const u = (y - 1820) / 100; return -20 + 32 * u * u; }
  if (y < 1900) { const t = y - 1860; return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174; }
  if (y < 1920) { const t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { const t = y - 1920; return 21.20 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t ** 3; }
  if (y < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (y < 2005) { const t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (y < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (y < 2150) { return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y); }
  const u = (y - 1820) / 100; return -20 + 32 * u * u;
}

/** Exact new-moon instant as a Julian Date in UT. */
function newMoonJDUT(kHo) {
  const k = kHo - 1237;
  const T = k / 1236.85;
  const T2 = T * T; const T3 = T2 * T; const T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3) * DR;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * DR;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * DR;
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * DR;
  const s = Math.sin;
  jde += -0.40720 * s(Mp)
    + 0.17241 * E * s(M)
    + 0.01608 * s(2 * Mp)
    + 0.01039 * s(2 * F)
    + 0.00739 * E * s(Mp - M)
    - 0.00514 * E * s(Mp + M)
    + 0.00208 * E * E * s(2 * M)
    - 0.00111 * s(Mp - 2 * F)
    - 0.00057 * s(Mp + 2 * F)
    + 0.00056 * E * s(2 * Mp + M)
    - 0.00042 * s(3 * Mp)
    + 0.00042 * E * s(M + 2 * F)
    + 0.00038 * E * s(M - 2 * F)
    - 0.00024 * E * s(2 * Mp - M)
    - 0.00017 * s(Om)
    - 0.00007 * s(Mp + 2 * M)
    + 0.00004 * s(2 * Mp - 2 * F)
    + 0.00004 * s(3 * M)
    + 0.00003 * s(Mp + M - 2 * F)
    + 0.00003 * s(2 * Mp + 2 * F)
    - 0.00003 * s(Mp + M + 2 * F)
    + 0.00003 * s(Mp - M + 2 * F)
    - 0.00002 * s(Mp - M - 2 * F)
    - 0.00002 * s(3 * Mp + M)
    + 0.00002 * s(4 * Mp);
  const A = [
    [299.77, 0.107408, -0.009173, 0.000325], [251.88, 0.016321, 0, 0.000165], [251.83, 26.651886, 0, 0.000164],
    [349.42, 36.412478, 0, 0.000126], [84.66, 18.206239, 0, 0.000110], [141.74, 53.303771, 0, 0.000062],
    [207.14, 2.453732, 0, 0.000060], [154.84, 7.30686, 0, 0.000056], [34.52, 27.261239, 0, 0.000047],
    [207.19, 0.121824, 0, 0.000042], [291.34, 1.844379, 0, 0.000040], [161.72, 24.198154, 0, 0.000037],
    [239.56, 25.513099, 0, 0.000035], [331.55, 3.592518, 0, 0.000023],
  ];
  for (const [a0, a1, a2, c] of A) jde += c * s((a0 + a1 * k + a2 * T2) * DR);
  const year = 2000 + (jde - 2451545) / 365.25;
  return jde - deltaTSeconds(year) / 86400;
}

function getNewMoonDay(k) {
  return INT(newMoonJDUT(k) + 0.5 + TZ / 24);
}

function getSunLongitude(jdn) {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525;
  const T2 = T * T;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(DR * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(DR * 2 * M) + 0.00029 * Math.sin(DR * 3 * M);
  const L = L0 + DL;
  const lNorm = ((L / 360) - INT(L / 360)) * 360;
  return INT(lNorm / 30);
}

function getLunarMonth11(yy) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k);
  if (getSunLongitude(nm) >= 9) nm = getNewMoonDay(k - 1);
  return nm;
}

function getLeapMonthOffset(a11) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i));
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Lunar date → solar { day, month, year } or null if the date doesn't exist (e.g. a leap month that isn't one). */
function lunarToSolar(lunarDay, lunarMonth, lunarYear, leap = false) {
  let a11; let b11;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1);
    b11 = getLunarMonth11(lunarYear);
  } else {
    a11 = getLunarMonth11(lunarYear);
    b11 = getLunarMonth11(lunarYear + 1);
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && lunarMonth !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) {
    return null;
  }
  const monthStart = getNewMoonDay(k + off);
  const [day, month, year] = jdToDate(monthStart + lunarDay - 1);
  return { day, month, year };
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Solar → lunar { day, month, year, leap }. */
function solarToLunar(dd, mm, yy) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
  let a11 = getLunarMonth11(yy);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1);
  }
  const day = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const leapOffset = getLeapMonthOffset(a11);
    if (diff >= leapOffset) {
      month = diff + 10;
      if (diff === leapOffset) leap = true;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) lunarYear -= 1;
  return { day, month, year: lunarYear, leap };
}

/**
 * Lunar → "YYYY-MM-DD", validated by converting back: rejects day 30 in a 29-day month
 * and leap months that don't exist. Returns { iso } or { err }.
 */
function lunarToSolarChecked(lunarDay, lunarMonth, lunarYear, leap = false) {
  const d = Number(lunarDay); const m = Number(lunarMonth); const y = Number(lunarYear);
  const r = lunarToSolar(d, m, y, leap);
  if (!r) return { err: leap ? `Năm ${y} âm lịch không có tháng ${m} nhuận` : 'Ngày âm lịch không tồn tại trong năm này' };
  const back = solarToLunar(r.day, r.month, r.year);
  if (back.day !== d || back.month !== m || back.year !== y || back.leap !== Boolean(leap)) {
    if (d === 30) return { err: `Tháng ${m}${leap ? ' nhuận' : ''} năm ${y} âm lịch chỉ có 29 ngày` };
    return { err: 'Ngày âm lịch không tồn tại trong năm này' };
  }
  return { iso: `${r.year}-${pad2(r.month)}-${pad2(r.day)}` };
}

/** "YYYY-MM-DD" solar date for a lunar day/month in a given lunar year, or null if it doesn't exist. */
function lunarToSolarISO(lunarDay, lunarMonth, lunarYear) {
  return lunarToSolarChecked(lunarDay, lunarMonth, lunarYear).iso || null;
}

module.exports = { lunarToSolar, lunarToSolarISO, lunarToSolarChecked, solarToLunar, jdFromDate, jdToDate, newMoonJDUT, getNewMoonDay };
