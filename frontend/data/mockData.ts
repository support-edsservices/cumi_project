/* ─────────────────────────────────────────────────────────────────────────────
   mockData.ts  –  All random / placeholder data for the dashboard.
   Replace individual exports with real API calls once the backend is ready.
───────────────────────────────────────────────────────────────────────────── */

/* ── Top KPI cards ── */
export const kpiCards = [
  {
    label: 'Total Plant Electrical Energy',
    sub:   'Total plant energy consumption',
    value: '7,052.96', unit: 'kWh',
    color: '#3b82f6', trend: '+12.5%', trendUp: true, highlighted: true,
  },
  {
    label: 'Total Plant Electrical Energy Cost',
    sub:   'Total plant energy cost',
    value: '57,066.56', unit: 'INR',
    color: '#8b5cf6', trend: '+9.6%', trendUp: true, highlighted: true,
  },
  {
    label: 'Grid Electricity Consumption',
    sub:   'Energy consumption from utility',
    value: '4,381.70', unit: 'kWh',
    color: '#06b6d4', trend: '-3.2%', trendUp: false, highlighted: false,
  },
  {
    label: 'Grid Electricity Cost',
    sub:   'Utility cost · INR 12/Unit',
    value: '52,580.35', unit: 'INR',
    color: '#f59e0b', trend: '+5.1%', trendUp: true, highlighted: false,
  },
  {
    label: 'Energy Used (EB + DG + Solar)',
    sub:   'Fixed Date: 06/14/2023',
    value: '7,052.96', unit: 'kWh',
    color: '#10b981', trend: undefined, trendUp: undefined, highlighted: false,
  },
  {
    label: 'DG Consumption',
    sub:   'Diesel energy produced',
    value: '98.78', unit: 'kWh',
    color: '#f59e0b', trend: '-18.4%', trendUp: false, highlighted: false,
  },
  {
    label: 'DG Energy Cost',
    sub:   'Cost · INR 30/Unit',
    value: '3,457.21', unit: 'INR',
    color: '#ef4444', trend: '-12.2%', trendUp: false, highlighted: false,
  },
  {
    label: 'Solar Generation',
    sub:   'Solar power generation',
    value: '2,572.49', unit: 'kWh',
    color: '#10b981', trend: '+22.1%', trendUp: true, highlighted: true,
  },
  {
    label: 'Solar Energy Cost',
    sub:   'Cost · INR 0.30/Unit',
    value: '1,029.00', unit: 'INR',
    color: '#10b981', trend: '+18.7%', trendUp: true, highlighted: false,
  },
  {
    label: 'Energy Cost – Last 2 Hours',
    sub:   'Rolling 2-hour window',
    value: '4,820.00', unit: 'INR',
    color: '#6366f1', trend: undefined, trendUp: undefined, highlighted: false,
  },
] as const;

/* ── CO₂ section ── */
export const co2Data = {
  emission: { value: '3,724.44', unit: 'Kg/kWh', trend: '-8.3%',  trendUp: false },
  saved:    { value: '1,800.74', unit: 'Kg/kWh', trend: '+22.1%', trendUp: true  },
};

/* ── Donut charts ── */
export const energyMixData = [
  { name: 'EB (Grid)', value: 42, color: '#3b82f6' },
  { name: 'DG',        value: 16, color: '#f59e0b' },
  { name: 'Solar',     value: 42, color: '#10b981' },
];

export const costMixData = [
  { name: 'EB (INR)',    value: 89, color: '#3b82f6' },
  { name: 'DG (INR)',    value: 11, color: '#f59e0b' },
  { name: 'Solar (INR)', value:  0, color: '#10b981' },
];

/* ── Plant load gauge ── */
export const plantLoadData = { current: 773.4, max: 2000 };

/* ── KPI target rings ── */
export const kpiTargets = [
  { label: 'Today',      pct: 49,  actual: '59,276',   target: '120,968',   color: '#3b82f6' },
  { label: 'Yesterday',  pct: 109, actual: '131,915',  target: '120,968',   color: '#f59e0b' },
  { label: 'This Month', pct: 91,  actual: '3,422,320',target: '3,750,000', color: '#10b981' },
  { label: 'Last Month', pct: 96,  actual: '3,595,253',target: '3,750,000', color: '#8b5cf6' },
];

/* ── Hourly trend ── */
export function generateHourlyData() {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    grid:  Math.round(150 + Math.random() * 260),
    solar: i >= 6 && i <= 18 ? Math.round(60 + Math.random() * 200) : 0,
    dg:    Math.round(Math.random() * 28),
  }));
}

/* ── Daily trend (30 days) ── */
export function generateDailyData() {
  return Array.from({ length: 30 }, (_, i) => ({
    day:   `${i + 1}`,
    grid:  Math.round(3800 + Math.random() * 1600),
    solar: Math.round(1600 + Math.random() * 1300),
    dg:    Math.round(60   + Math.random() * 80),
  }));
}

/* ── Monthly trend ── */
export function generateMonthlyData() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months.map(month => ({
    month,
    grid:  Math.round(4000 + Math.random() * 2200),
    solar: Math.round(1800 + Math.random() * 1400),
    dg:    Math.round(50   + Math.random() * 160),
  }));
}

/* ── Alarms ── */
export const alarmData = [
  { time: '10:15 AM', event: 'Voltage High',    meter: 'Incomer',    severity: 'High',   status: 'Active'       },
  { time: '09:47 AM', event: 'Power Factor Low', meter: 'Assembly-3', severity: 'Medium', status: 'Active'       },
  { time: '08:35 AM', event: 'Demand Exceeded',  meter: 'Main Incomer',severity:'High',   status: 'Acknowledged' },
  { time: '07:10 AM', event: 'Voltage Low',      meter: 'Assembly-1', severity: 'Medium', status: 'Resolved'     },
  { time: '06:20 AM', event: 'Power Restored',   meter: 'DG Set',     severity: 'Low',    status: 'Resolved'     },
];

/* ── Summary table ── */
export const summaryTableRows = [
  { period: 'Today',      grid: '4,381.70',  dg: '98.78',  solar: '2,572.49', total: '7,052.96',  cost: '57,066.56',  co2: '3,724.44' },
  { period: 'This Week',  grid: '28,450',    dg: '620',    solar: '16,200',   total: '45,270',    cost: '3,68,000',   co2: '23,940'   },
  { period: 'This Month', grid: '1,12,400',  dg: '2,480',  solar: '64,800',   total: '1,79,680',  cost: '14,56,000',  co2: '94,920'   },
  { period: 'Last Month', grid: '1,08,900',  dg: '2,100',  solar: '61,200',   total: '1,72,200',  cost: '13,94,000',  co2: '91,140'   },
];
