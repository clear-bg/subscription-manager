// 日付は "YYYY-MM-DD" の文字列（データベースの date 型と同じ形）で扱う。
// 時刻やタイムゾーンを持たない値なので、計算は UTC の Date で行い、環境の時差の影響を受けないようにする。
// 「今日」は必ず today.ts の todayInTokyo() から取る（設計書 9.2）。

export type DateString = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** その月の日数（month は 1〜12） */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function formatDate(year: number, month: number, day: number): DateString {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" を年・月・日に分ける。存在しない日付（2月30日など）はエラー */
export function parseDate(value: DateString): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error(`日付の形式が正しくありません: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`存在しない日付です: ${value}`);
  }
  return { year, month, day };
}

function toUtcMs(value: DateString): number {
  const { year, month, day } = parseDate(value);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): DateString {
  const date = new Date(ms);
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(value: DateString, days: number): DateString {
  return fromUtcMs(toUtcMs(value) + days * MS_PER_DAY);
}

/** from から to までの日数（to が後なら正） */
export function daysBetween(from: DateString, to: DateString): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** 曜日（0＝日曜〜6＝土曜） */
export function dayOfWeek(value: DateString): number {
  return new Date(toUtcMs(value)).getUTCDay();
}

/**
 * year 年 month 月の day 日。その月に該当日がなければ月末にする（設計書 3.11）。
 * month は 12 を超えても 1 未満でもよく、年をまたいで繰り上げ・繰り下げる。
 */
export function clampedDate(year: number, month: number, day: number): DateString {
  const monthIndex = year * 12 + (month - 1);
  const normalizedYear = Math.floor(monthIndex / 12);
  const normalizedMonth = monthIndex - normalizedYear * 12 + 1;
  const lastDay = daysInMonth(normalizedYear, normalizedMonth);
  return formatDate(normalizedYear, normalizedMonth, Math.min(day, lastDay));
}
