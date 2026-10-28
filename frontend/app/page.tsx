'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   page.tsx  –  110kV Plant Overview Dashboard
   Uses: Sidebar (layout.tsx), Topbar (layout.tsx), mockData, navigation
───────────────────────────────────────────────────────────────────────────── */
import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Zap, DollarSign, Activity, Sun, Wind, Leaf,
  TrendingUp, TrendingDown, Download, Clock,
} from 'lucide-react';

import {
  kpiCards, co2Data, energyMixData, costMixData,
  plantLoadData, kpiTargets, alarmData, summaryTableRows,
  generateHourlyData, generateDailyData, generateMonthlyData,
} from '@/data/mockData';

/* ─── static data (stable across re-renders) ─── */
const hourlyData  = generateHourlyData();
const dailyData   = generateDailyData();
const monthlyData = generateMonthlyData();

/* ════════════════════════════════════════════════════════════════════════════
   Sub-components
════════════════════════════════════════════════════════════════════════════ */

/* ── Recharts tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '0.55rem 0.875rem',
      fontSize: 12, boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, lineHeight: 1.7 }}>
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ── SVG half-gauge ── */
function HalfGauge({
  value, max, color = '#f59e0b',
}: { value: number; max: number; color?: string }) {
  const pct = Math.min(value / max, 1);
  const R = 62, cx = 90, cy = 90;
  const startAngle = -180;
  const sweepAngle = 180;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcEnd = startAngle + pct * sweepAngle;

  const sx = cx + R * Math.cos(toRad(startAngle));
  const sy = cy + R * Math.sin(toRad(startAngle));
  const ex = cx + R * Math.cos(toRad(arcEnd));
  const ey = cy + R * Math.sin(toRad(arcEnd));
  const large = pct > 0.5 ? 1 : 0;

  /* coloured zone arcs (bg) */
  const zones = [
    { from: 0, to: 0.5,  c: '#10b981' },
    { from: 0.5, to: 0.75, c: '#f59e0b' },
    { from: 0.75, to: 1,  c: '#ef4444' },
  ];

  function zoneArc(from: number, to: number) {
    const a1 = -180 + from * 180, a2 = -180 + to * 180;
    const x1 = cx + R * Math.cos(toRad(a1)), y1 = cy + R * Math.sin(toRad(a1));
    const x2 = cx + R * Math.cos(toRad(a2)), y2 = cy + R * Math.sin(toRad(a2));
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  }

  return (
    <svg viewBox="0 0 180 110" style={{ width: '100%', maxWidth: 200 }}>
      {/* zone track */}
      {zones.map(z => (
        <path key={z.c} d={zoneArc(z.from, z.to)}
          fill="none" stroke={z.c} strokeOpacity={0.18} strokeWidth={12} strokeLinecap="butt" />
      ))}
      {/* filled arc */}
      {pct > 0 && (
        <path d={`M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`}
          fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
      )}
      {/* labels */}
      <text x={cx - R - 10} y={cy + 22} fontSize="9" fill="var(--text-muted)" textAnchor="middle">0</text>
      <text x={cx + R + 10} y={cy + 22} fontSize="9" fill="var(--text-muted)" textAnchor="middle">{max}</text>
      {/* value */}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text-primary)">
        {value}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9" fill="var(--text-muted)">kW</text>
    </svg>
  );
}

/* ── Donut chart (pure SVG, no Recharts needed) ── */
function DonutChart({
  data, centerLabel, centerSub,
}: {
  data: { name: string; value: number; color: string }[];
  centerLabel: string;
  centerSub: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let startAngle = -90;
  const R = 52, r = 32, cx = 72, cy = 72;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const slices = data.map(d => {
    const sweep = (d.value / total) * 360;
    const end = startAngle + sweep;
    const x1 = cx + R * Math.cos(toRad(startAngle));
    const y1 = cy + R * Math.sin(toRad(startAngle));
    const x2 = cx + R * Math.cos(toRad(end));
    const y2 = cy + R * Math.sin(toRad(end));
    const large = sweep > 180 ? 1 : 0;
    const ix1 = cx + r * Math.cos(toRad(end));
    const iy1 = cy + r * Math.sin(toRad(end));
    const ix2 = cx + r * Math.cos(toRad(startAngle));
    const iy2 = cy + r * Math.sin(toRad(startAngle));
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`;
    startAngle = end;
    return { ...d, path };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <svg viewBox="0 0 144 144" style={{ width: 130, flexShrink: 0 }}>
        {slices.map(s => (
          <path key={s.name} d={s.path} fill={s.color} opacity={0.9} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text-primary)">
          {centerLabel}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="var(--text-muted)">
          {centerSub}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{d.name}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI ring ── */
function KpiRing({
  pct, label, actual, target, color,
}: { pct: number; label: string; actual: string; target: string; color: string }) {
  const R = 26, circ = 2 * Math.PI * R;
  const over = pct > 100;
  const displayPct = Math.min(pct, 100);
  const dash = circ * (1 - displayPct / 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <svg width={68} height={68} style={{ flexShrink: 0 }}>
        <circle cx={34} cy={34} r={R} fill="none" stroke="var(--border)" strokeWidth={7} />
        <circle cx={34} cy={34} r={R} fill="none"
          stroke={over ? '#f59e0b' : color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round" transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={34} y={38} textAnchor="middle" fontSize="12" fontWeight="800"
          fill={over ? '#f59e0b' : color}>
          {pct}%
        </text>
      </svg>
      <div style={{ lineHeight: 1.5 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Actual: <b style={{ color: 'var(--text-secondary)' }}>{actual}</b></div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Target: <b style={{ color: 'var(--text-secondary)' }}>{target}</b></div>
      </div>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({
  label, sub, value, unit, color,
  trend, trendUp, highlighted, delay,
}: {
  label: string; sub: string; value: string; unit: string;
  color: string; trend?: string; trendUp?: boolean;
  highlighted?: boolean; delay?: number;
}) {
  const iconMap: Record<string, React.ElementType> = {
    kWh: Zap, INR: DollarSign,
  };
  const Icon = iconMap[unit] ?? Activity;

  return (
    <div className="stat-card fade-up" style={{
      animationDelay: `${delay ?? 0}s`,
      borderLeft: highlighted ? `3px solid ${color}` : '1px solid var(--border)',
      borderTop: highlighted ? `1px solid ${color}20` : undefined,
      background: highlighted
        ? `linear-gradient(135deg, var(--bg-card) 0%, ${color}10 100%)`
        : 'var(--bg-card)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35, maxWidth: '75%' }}>
          {label}
        </span>
        <div style={{
          width: 30, height: 30, borderRadius: 7, flexShrink: 0,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={color} />
        </div>
      </div>

      {/* Value */}
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {unit === 'INR' && (
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>₹</span>
        )}
        {value}
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 3 }}>
          {unit}
        </span>
      </div>

      {/* Sub */}
      <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>

      {/* Trend */}
      {trend && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3, marginTop: '0.45rem',
          fontSize: '0.7rem', fontWeight: 700,
          color: trendUp ? '#10b981' : '#ef4444',
        }}>
          {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {trend} vs last period
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Main Page
════════════════════════════════════════════════════════════════════════════ */
export default function PlantOverviewPage() {
  const [tab, setTab] = useState<'hourly' | 'daily' | 'monthly'>('hourly');

  const chartData = tab === 'hourly' ? hourlyData : tab === 'daily' ? dailyData : monthlyData;
  const xKey      = tab === 'hourly' ? 'time' : tab === 'daily' ? 'day' : 'month';

  /* split kpiCards into two rows of 5 */
  const row1 = kpiCards.slice(0, 5);
  const row2 = kpiCards.slice(5, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            110kV Plant Overview
          </h2>
        </div>
        
      </div>

      {/* ── Row 1 · KPI cards (5 cols) ── */}
      <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.875rem' }}>
        {row1.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.05} />
        ))}
      </div>

      {/* ── Row 2 · KPI cards (5 cols) ── */}
      <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.875rem' }}>
        {row2.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.05} />
        ))}
      </div>

      {/* ── Row 3 · CO₂ | Energy Mix | Cost Mix | Gauge ── */}
      <div className="dashboard-mix-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.875rem' }}>

        {/* CO₂ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {/* Emission */}
          <div className="stat-card fade-up delay-1">
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>CO₂ Emission</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={18} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {co2Data.emission.value}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{co2Data.emission.unit}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: '0.5rem', fontSize: '0.68rem', fontWeight: 700, color: '#10b981' }}>
              <TrendingDown size={10} /> {co2Data.emission.trend} vs last period
            </div>
          </div>

          {/* Saved */}
          <div className="stat-card fade-up delay-2" style={{ borderLeft: '3px solid #10b981', background: 'linear-gradient(135deg, var(--bg-card) 0%, #10b98110 100%)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>CO₂ Saved (Solar)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: '#10b98118', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Leaf size={18} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>
                  {co2Data.saved.value}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{co2Data.saved.unit}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: '0.5rem', fontSize: '0.68rem', fontWeight: 700, color: '#10b981' }}>
              <TrendingUp size={10} /> {co2Data.saved.trend} via solar generation
            </div>
          </div>
        </div>

        {/* Energy Mix Donut */}
        <div className="card fade-up delay-2" style={{ padding: '1.125rem' }}>
          <div className="section-title">Energy Used (kWh)</div>
          <DonutChart data={energyMixData} centerLabel="7,052" centerSub="kWh" />
        </div>

        {/* Cost Mix Donut */}
        <div className="card fade-up delay-3" style={{ padding: '1.125rem' }}>
          <div className="section-title">Energy Cost (INR)</div>
          <DonutChart data={costMixData} centerLabel="₹57K" centerSub="INR" />
        </div>

        {/* Plant Load Gauge */}
        <div className="card fade-up delay-4" style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="section-title" style={{ alignSelf: 'flex-start' }}>Total Plant Operational Load</div>
          <HalfGauge value={plantLoadData.current} max={plantLoadData.max} />
          <div style={{ textAlign: 'center', marginTop: '0.375rem' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>
              {plantLoadData.current} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>kW</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Max: {plantLoadData.max.toLocaleString()} kW
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4 · Trend chart | KPI targets ── */}
      <div className="dashboard-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '0.875rem' }}>

        {/* Trend Chart */}
        <div className="card fade-up delay-2" style={{ padding: '1.125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <div className="section-title" style={{ margin: 0 }}>Energy Consumption Trend</div>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {(['hourly', 'daily', 'monthly'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '0.28rem 0.7rem', borderRadius: 6,
                  fontSize: '0.7rem', fontWeight: 600,
                  border: '1px solid var(--border)',
                  cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit',
                  background: tab === t ? 'var(--accent-blue)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--text-muted)',
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={chartData as any[]}>
              <defs>
                {[['gridG','#3b82f6'], ['solarG','#10b981'], ['dgG','#f59e0b']].map(([id, c]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={c} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="grid"  name="Grid (kWh)"  stroke="#3b82f6" fill="url(#gridG)"  strokeWidth={1.8} />
              <Area type="monotone" dataKey="solar" name="Solar (kWh)" stroke="#10b981" fill="url(#solarG)" strokeWidth={1.8} />
              <Area type="monotone" dataKey="dg"    name="DG (kWh)"    stroke="#f59e0b" fill="url(#dgG)"    strokeWidth={1.8} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* KPI Targets */}
        <div className="card fade-up delay-3" style={{ padding: '1.125rem' }}>
          <div className="section-title">KPI Targets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {kpiTargets.map(k => (
              <KpiRing key={k.label} {...k} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 5 · Monthly bar | Alarms ── */}
      <div className="dashboard-dual-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>

        {/* Monthly Bar */}
        <div className="card fade-up delay-1" style={{ padding: '1.125rem' }}>
          <div className="section-title">Monthly Energy Comparison</div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={monthlyData} barSize={10} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="grid"  name="Grid"  fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="solar" name="Solar" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="dg"    name="DG"    fill="#f59e0b" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alarms */}
        <div className="card fade-up delay-2" style={{ padding: '1.125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="section-title" style={{ margin: 0 }}>Alarms & Events</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 600, cursor: 'pointer' }}>
              View All →
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alarmData.map((a, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '68px 1fr auto auto',
                alignItems: 'center', gap: '0.625rem',
                padding: '0.45rem 0.75rem', borderRadius: 8,
                background: 'var(--bg-secondary)',
              }}>
                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{a.time}</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.event}</div>
                  <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{a.meter}</div>
                </div>
                <SeverityBadge label={a.severity} />
                <StatusBadge  label={a.status}   />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 6 · Summary table ── */}
      <div className="card fade-up delay-1" style={{ padding: '1.125rem' }}>
        <div className="section-title">Plant Energy Summary Table</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Period', 'Grid (kWh)', 'DG (kWh)', 'Solar (kWh)', 'Total (kWh)', 'Cost (INR)', 'CO₂ (Kg)'].map(h => (
                  <th key={h} style={{
                    padding: '0.55rem 0.875rem', textAlign: 'left',
                    fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryTableRows.map((row, i) => (
                <tr key={row.period} style={{
                  borderBottom: '1px solid var(--border)',
                  background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent',
                }}>
                  <td style={{ padding: '0.55rem 0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{row.period}</td>
                  <td style={{ padding: '0.55rem 0.875rem', fontWeight: 600, color: '#3b82f6' }}>{row.grid}</td>
                  <td style={{ padding: '0.55rem 0.875rem', fontWeight: 600, color: '#f59e0b' }}>{row.dg}</td>
                  <td style={{ padding: '0.55rem 0.875rem', fontWeight: 600, color: '#10b981' }}>{row.solar}</td>
                  <td style={{ padding: '0.55rem 0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{row.total}</td>
                  <td style={{ padding: '0.55rem 0.875rem', fontWeight: 600, color: '#8b5cf6' }}>₹ {row.cost}</td>
                  <td style={{ padding: '0.55rem 0.875rem', fontWeight: 600, color: '#ef4444' }}>{row.co2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

/* ── Small badge helpers ── */
function SeverityBadge({ label }: { label: string }) {
  const map: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
  const c = map[label] ?? '#94a3b8';
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
      background: `${c}20`, color: c, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function StatusBadge({ label }: { label: string }) {
  const map: Record<string, string> = { Active: '#ef4444', Acknowledged: '#f59e0b', Resolved: '#10b981' };
  const c = map[label] ?? '#94a3b8';
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
      background: `${c}20`, color: c, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
