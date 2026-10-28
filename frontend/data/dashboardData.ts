// Dummy data for the Energy Dashboard. Deterministic (seeded) so SSR and client match.
import { METER_STATUS } from "./ENUM";

export function seeded(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function makeSeries(n: number, base: number, amp: number, seed: number) {
  const r = seeded(seed);
  return Array.from({ length: n }, (_, i) =>
    +(base + Math.sin(i / 2) * amp * 0.6 + (r() - 0.5) * amp).toFixed(2)
  );
}

export const METERS = ["101", "102", "103", "104", "105"];

export function buildRealtime(meterId: string, tick: number) {
  const seed = Number(meterId) * 7 + tick * 13;
  const r = seeded(seed);
  const j = (v: number, a: number, d = 2) => +(v + (r() - 0.5) * a).toFixed(d);
  const first = tick === 0 && meterId === "101";
  return {
    voltage: { value: first ? 230.4 : j(230.4, 3, 1), series: makeSeries(16, 230, 4, seed + 1) },
    current: { value: first ? 12.45 : j(12.45, 1), series: makeSeries(16, 12, 2, seed + 2) },
    power: { value: first ? 2.85 : j(2.85, 0.3), series: makeSeries(16, 2.8, 0.5, seed + 3) },
    pf: { value: first ? 0.98 : j(0.98, 0.04), series: makeSeries(16, 0.97, 0.05, seed + 4) },
    freq: { value: first ? 50.02 : j(50.02, 0.08), series: makeSeries(16, 50, 0.1, seed + 5) },
    currentPowerSeries: makeSeries(24, 70, 14, seed + 6),
    currentPower: first ? 75.6 : j(75.6, 6, 1),
  };
}

export const SUMMARY = {
  totalConsumption: { value: 12540, change: 12.5 },
  today: { value: 420, date: "May 26, 2026", change: 8.4 },
  peakDemand: { value: 152, at: "May 21, 2026 02:15 PM" },
  cost: { value: 18765.4, change: 9.6 },
  activeMeters: 124,
  totalInstalled: 128,
  offlineMeters: 4,
};

export const METER_HEALTH = [
  { label: METER_STATUS.ONLINE, value: 120, color: "var(--success)" },
  { label: METER_STATUS.OFFLINE, value: 4, color: "var(--danger)" },
  { label: METER_STATUS.COMM_LOST, value: 2, color: "var(--warning)" },
  { label: METER_STATUS.MAINTENANCE, value: 2, color: "var(--primary)" },
];

const hourLabel = (h: number) => `${h % 12 || 12} ${h % 24 < 12 ? "AM" : "PM"}`;
const hourFull = (h: number) => `${String(h % 12 || 12).padStart(2, "0")}:00 ${h % 24 < 12 ? "AM" : "PM"}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const TREND = {
  daily: {
    labels: Array.from({ length: 25 }, (_, h) => hourLabel(h)),
    titles: Array.from({ length: 25 }, (_, h) => `26 May 2026 - ${hourFull(h)}`),
    values: [40, 65, 95, 160, 225, 315, 295, 250, 275, 185, 170, 235, 275, 195, 160, 145, 215, 300, 255, 370, 265, 185, 150, 130, 128],
  },
  monthly: {
    labels: Array.from({ length: 31 }, (_, i) => `${i + 1}`),
    titles: Array.from({ length: 31 }, (_, i) => `${i + 1} May 2026`),
    values: makeSeries(31, 405, 120, 42),
  },
  yearly: {
    labels: MONTHS,
    titles: MONTHS.map((m) => `${m} 2026`),
    values: [5600, 8800, 10200, 11150, 12540, 10400, 8800, 10300, 11600, 14300, 12800, 11500],
  },
};

export const MONTHLY = { labels: MONTHS, values: TREND.yearly.values, highlight: 4 };

export const YEARLY = {
  labels: ["2020", "2021", "2022", "2023", "2024", "2025", "2026"],
  values: [41200, 48900, 52300, 60100, 66400, 71800, 75420],
};
