'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Shipment Dashboard  –  Comprehensive shipment tracking & payment overview
   Reads from the shared store (useShipments), so entries added, edited or
   deleted on the entry / history page show up here straight away.
───────────────────────────────────────────────────────────────────────────── */
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  Package, Ship, AlertCircle, Clock, Search, Plus,
  ChevronLeft, ChevronRight, Anchor, Plane, FileText,
} from 'lucide-react';

import { Shipment, MaterialStatus, PaymentStatus } from '@/types/shipment';
import {
  formatDMY,
  formatEtdEta,
  getDaysUntilDue,
  getModeLabel,
  getPaymentDueDate,
  getPaymentPeriod,
  getPaymentTermsLabel,
  isPaymentOverdue,
} from '@/data/shipmentData';
import { useShipments } from '@/hooks/useShipments';
import { FONT_SIZES } from '@/context/ThemeContext';

/* ═══════════════════════════════════════════════════════════════════════════
   Helper constants
═══════════════════════════════════════════════════════════════════════════ */
const ACCENT = {
  blue: '#3b82f6',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  teal: '#06b6d4',
} as const;

const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  PAID: ACCENT.green,
  'NOT PAID': ACCENT.red,
  PARTIAL: ACCENT.orange,
};

const MATERIAL_STATUS_COLOR: Record<MaterialStatus, string> = {
  'In Transit': ACCENT.blue,
  'At Port': ACCENT.orange,
  'Customs Clearance': ACCENT.purple,
  Delivered: ACCENT.green,
  'Pending Shipment': ACCENT.teal,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Recharts custom tooltip
═══════════════════════════════════════════════════════════════════════════ */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '0.55rem 0.875rem',
      fontSize: FONT_SIZES.chartTooltip, boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color || p.fill, display: 'flex', gap: 8, lineHeight: 1.7 }}>
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Date helpers
═══════════════════════════════════════════════════════════════════════════ */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════════════════════ */

/* ── KPI Stat Card ── */
function KpiCard({
  icon: Icon, label, value, total, color, delay, pulsing,
}: {
  icon: React.ElementType; label: string; value: number; total: number;
  color: string; delay: number; pulsing?: boolean;
}) {
  const pct = Math.min((value / Math.max(total, 1)) * 100, 100);
  return (
    <div className={`stat-card fade-up`} style={{ animationDelay: `${delay}s` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} className={pulsing ? 'pulse' : ''} />
        </div>
        <span style={{
          fontSize: 'var(--font-size-label)', fontWeight: 600,
          color: 'var(--text-muted)', lineHeight: 1.35, textAlign: 'right',
          maxWidth: '60%',
        }}>
          {label}
        </span>
      </div>
      <div className={pulsing ? 'pulse' : ''} style={{
        fontSize: 'var(--font-size-display)', fontWeight: 800,
        color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1,
      }}>
        {value}
      </div>
      {/* Progress bar */}
      <div style={{
        marginTop: '0.625rem', height: 4, borderRadius: 2,
        background: 'var(--bg-secondary)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2, width: `${pct}%`,
          background: color, transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{
        marginTop: '0.25rem', fontSize: 'var(--font-size-compact)',
        color: 'var(--text-muted)',
      }}>
        {pct.toFixed(0)}% of total
      </div>
    </div>
  );
}

/* ── Payment Calendar ── */
function PaymentCalendar({ data }: { data: Shipment[] }) {
  const [calDate, setCalDate] = useState(() => new Date());
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  /* Build a map: day → shipments due on that day */
  const dayMap = useMemo(() => {
    const map = new Map<number, { shipment: Shipment; dueDate: Date }[]>();
    data.forEach(s => {
      const due = getPaymentDueDate(s);
      if (!due) return;
      if (due.getFullYear() === year && due.getMonth() === month) {
        const day = due.getDate();
        const existing = map.get(day) || [];
        existing.push({ shipment: s, dueDate: due });
        map.set(day, existing);
      }
    });
    return map;
  }, [data, year, month]);

  const prevMonth = () => setCalDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalDate(new Date(year, month + 1, 1));

  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card fade-up delay-2" style={{ padding: '1.125rem', flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.75rem',
      }}>
        <div className="section-title" style={{ margin: 0 }}>Payment Calendar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={prevMonth} aria-label="Previous month" style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, cursor: 'pointer', padding: '0.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{
            fontSize: 'var(--font-size-body)', fontWeight: 700,
            color: 'var(--text-primary)', minWidth: 120, textAlign: 'center',
          }}>
            {calDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={nextMonth} aria-label="Next month" style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, cursor: 'pointer', padding: '0.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {weekDays.map(w => (
          <div key={w} style={{
            textAlign: 'center', fontSize: 'var(--font-size-compact)',
            fontWeight: 700, color: 'var(--text-muted)', padding: '0.25rem 0',
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;

          const entries = dayMap.get(day);
          const isToday = isSameDay(today, new Date(year, month, day));
          const hovered = hoveredDay === day && !!entries;

          return (
            <div
              key={day}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                position: 'relative',
                minHeight: 36,
                borderRadius: 6,
                border: isToday ? `2px solid ${ACCENT.blue}` : '1px solid transparent',
                background: entries ? 'var(--bg-secondary)' : 'transparent',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: entries ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              <span style={{
                fontSize: 'var(--font-size-compact)', fontWeight: isToday ? 800 : 500,
                color: isToday ? ACCENT.blue : 'var(--text-secondary)',
              }}>
                {day}
              </span>

              {/* Mini colored blocks for shipments on this day */}
              {entries && (
                <div style={{
                  display: 'flex', gap: 2, marginTop: 2,
                  flexWrap: 'wrap', justifyContent: 'center',
                }}>
                  {entries.map(({ shipment: s }) => (
                    <div key={s.id} style={{
                      width: 8, height: 4, borderRadius: 1,
                      background: PAYMENT_STATUS_COLOR[s.paymentStatus],
                    }} />
                  ))}
                </div>
              )}

              {/* Tooltip on hover */}
              {hovered && entries && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%',
                  transform: 'translateX(-50%)', marginBottom: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '0.5rem 0.75rem',
                  boxShadow: 'var(--card-shadow)', zIndex: 20,
                  minWidth: 200, whiteSpace: 'nowrap',
                }}>
                  <div style={{
                    fontSize: 'var(--font-size-compact)', fontWeight: 700,
                    color: 'var(--text-primary)', marginBottom: 4,
                  }}>
                    Due: {formatDMY(new Date(year, month, day))}
                  </div>
                  {entries.map(({ shipment: s }) => (
                    <div key={s.id} style={{ lineHeight: 1.5, marginBottom: 2 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 'var(--font-size-compact)',
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: PAYMENT_STATUS_COLOR[s.paymentStatus], flexShrink: 0,
                        }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{s.supplier}</span>
                        <span style={{
                          marginLeft: 'auto', fontWeight: 700,
                          fontSize: 'var(--font-size-tiny)',
                          color: PAYMENT_STATUS_COLOR[s.paymentStatus],
                        }}>
                          {s.paymentStatus}
                        </span>
                      </div>
                      <div style={{
                        paddingLeft: 12, fontSize: 'var(--font-size-tiny)',
                        color: 'var(--text-muted)',
                      }}>
                        {getPaymentTermsLabel(s)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '0.875rem', marginTop: '0.75rem',
        fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)',
      }}>
        {([['PAID', ACCENT.green], ['NOT PAID', ACCENT.red], ['PARTIAL', ACCENT.orange]] as const).map(([label, c]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 4, borderRadius: 1, background: c }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Payment Status Donut (pure SVG) ── */
function PaymentDonut({ data }: { data: Shipment[] }) {
  const counts = useMemo(() => {
    const map: Record<PaymentStatus, number> = { PAID: 0, 'NOT PAID': 0, PARTIAL: 0 };
    data.forEach(s => { map[s.paymentStatus]++; });
    return map;
  }, [data]);

  const total = data.length;
  const slices: { name: string; value: number; color: string }[] = [
    { name: 'Paid', value: counts.PAID, color: ACCENT.green },
    { name: 'Not Paid', value: counts['NOT PAID'], color: ACCENT.red },
    { name: 'Partial', value: counts.PARTIAL, color: ACCENT.orange },
  ];

  let startAngle = -90;
  const R = 56, r = 36, cx = 80, cy = 80;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const paths = slices.filter(s => s.value > 0).map(s => {
    // A single full slice cannot be drawn as one arc (start == end), so cap it just under 360.
    const sweep = Math.min((s.value / total) * 360, 359.99);
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
    return { ...s, path };
  });

  return (
    <div className="card fade-up delay-3" style={{
      padding: '1.125rem', display: 'flex', flexDirection: 'column',
      alignItems: 'center', minWidth: 260,
    }}>
      <div className="section-title" style={{ alignSelf: 'flex-start' }}>Payment Status</div>
      <svg viewBox="0 0 160 160" style={{ width: 150, margin: '0.5rem 0' }}>
        {paths.map(s => (
          <path key={s.name} d={s.path} fill={s.color} opacity={0.88} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={FONT_SIZES.svgMetric}
          fontWeight="800" fill="var(--text-primary)">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={FONT_SIZES.svgSmall}
          fill="var(--text-muted)">
          Shipments
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' }}>
        {slices.map(s => (
          <div key={s.name} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: 'var(--font-size-body-small)',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0,
            }} />
            <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{s.name}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-compact)' }}>
              ({total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Shipments by Mode (Recharts Bar): Sea / Air / Others ── */
function ShipmentsByMode({ data }: { data: Shipment[] }) {
  const modeData = useMemo(() => {
    let sea = 0, air = 0, others = 0;
    data.forEach(s => {
      if (s.modeOfShipment === 'Sea') sea++;
      else if (s.modeOfShipment === 'Air') air++;
      else others++;
    });
    return [
      { mode: 'Sea', count: sea, color: ACCENT.blue },
      { mode: 'Air', count: air, color: ACCENT.teal },
      { mode: 'Others', count: others, color: ACCENT.purple },
    ];
  }, [data]);

  const modeIcon = (mode: string, color: string) =>
    mode === 'Sea' ? <Anchor size={14} color={color} />
    : mode === 'Air' ? <Plane size={14} color={color} />
    : <Package size={14} color={color} />;

  return (
    <div className="card fade-up delay-1" style={{ padding: '1.125rem' }}>
      <div className="section-title">Shipments by Mode</div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={modeData} barSize={48} barCategoryGap="40%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="mode" tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Shipments" radius={[6, 6, 0, 0]}>
            {modeData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Icon summary below chart */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '0.5rem', flexWrap: 'wrap',
      }}>
        {modeData.map(m => (
          <div key={m.mode} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {modeIcon(m.mode, m.color)}
            <span style={{
              fontSize: 'var(--font-size-body-small)', fontWeight: 700,
              color: 'var(--text-primary)',
            }}>
              {m.count}
            </span>
            <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>
              {m.mode}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Material Status Breakdown ── */
function MaterialStatusBreakdown({ data }: { data: Shipment[] }) {
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(s => {
      map[s.materialStatus] = (map[s.materialStatus] || 0) + 1;
    });
    const statuses: MaterialStatus[] = ['In Transit', 'At Port', 'Customs Clearance', 'Delivered', 'Pending Shipment'];
    return statuses.map(st => ({
      status: st,
      count: map[st] || 0,
      color: MATERIAL_STATUS_COLOR[st],
    }));
  }, [data]);

  const maxCount = Math.max(...statusCounts.map(s => s.count), 1);

  return (
    <div className="card fade-up delay-2" style={{ padding: '1.125rem' }}>
      <div className="section-title">Material Status</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.5rem' }}>
        {statusCounts.map(s => (
          <div key={s.status}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                  background: `${s.color}18`, color: s.color,
                  fontSize: 'var(--font-size-compact)', fontWeight: 700,
                }}>
                  {s.status}
                </span>
              </div>
              <span style={{
                fontSize: 'var(--font-size-body-small)', fontWeight: 800,
                color: 'var(--text-primary)',
              }}>
                {s.count}
              </span>
            </div>
            <div style={{
              height: 6, borderRadius: 3, background: 'var(--bg-secondary)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${(s.count / maxCount) * 100}%`,
                background: s.color, transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Upcoming Due Payments Table ── */
function DuePaymentsTable({ data }: { data: Shipment[] }) {
  const rows = useMemo(() => {
    return data
      .map(s => ({
        shipment: s,
        dueDate: getPaymentDueDate(s),
        daysLeft: getDaysUntilDue(s),
        period: getPaymentPeriod(s),
      }))
      .filter(r => r.dueDate !== null)
      .sort((a, b) => {
        if (a.daysLeft === null) return 1;
        if (b.daysLeft === null) return -1;
        return a.daysLeft - b.daysLeft;
      })
      .slice(0, 10);
  }, [data]);

  const cell: React.CSSProperties = { padding: '0.55rem 0.875rem' };

  return (
    <div className="card fade-up delay-1" style={{ padding: '1.125rem' }}>
      <div className="section-title">Upcoming Due Payments</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-body)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Supplier', 'Invoice No', 'Payment Terms', 'Due Date', 'Days Left', 'Status', 'Documents'].map(h => (
                <th key={h} style={{
                  padding: '0.55rem 0.875rem', textAlign: 'left',
                  fontWeight: 700, fontSize: 'var(--font-size-small)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--text-muted)', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...cell, textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                  No payments with a due date yet.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const s = r.shipment;
              const daysLeft = r.daysLeft ?? 0;
              const overdue = daysLeft < 0;
              const urgent = daysLeft >= 0 && daysLeft <= 7;

              const daysColor = overdue ? ACCENT.red : urgent ? ACCENT.orange : ACCENT.green;
              const statusColor = PAYMENT_STATUS_COLOR[s.paymentStatus];

              return (
                <tr key={s.id} style={{
                  borderBottom: '1px solid var(--border)',
                  background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent',
                }}>
                  <td style={{ ...cell, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {s.supplier}
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-small)' }}>
                    {s.invoiceNo}
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-body-small)' }}>
                      {getPaymentTermsLabel(s)}
                    </div>
                    {r.period && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-compact)' }}>
                        {formatDMY(r.period.from)} → {formatDMY(r.period.to)}
                      </div>
                    )}
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-small)', whiteSpace: 'nowrap' }}>
                    {r.dueDate ? formatDMY(r.dueDate) : '—'}
                  </td>
                  <td style={cell}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                      background: `${daysColor}18`, color: daysColor,
                      fontSize: 'var(--font-size-compact)', fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                    </span>
                  </td>
                  <td style={cell}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                      background: `${statusColor}18`, color: statusColor,
                      fontSize: 'var(--font-size-compact)', fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      {s.paymentStatus}
                    </span>
                  </td>
                  <td style={cell}>
                    {s.link ? (
                      <a href={s.link} target="_blank" rel="noopener noreferrer" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        color: ACCENT.blue, fontSize: 'var(--font-size-compact)',
                        fontWeight: 600, textDecoration: 'none',
                      }}>
                        <FileText size={12} /> View PDF
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-compact)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Recent Shipments Timeline ── */
function RecentTimeline({ data }: { data: Shipment[] }) {
  const recent = useMemo(() => {
    // createdAt is YYYY-MM-DD, so a string compare sorts correctly. Ties: newest id first.
    return [...data]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id, undefined, { numeric: true }))
      .slice(0, 5);
  }, [data]);

  return (
    <div className="card fade-up delay-2" style={{ padding: '1.125rem' }}>
      <div className="section-title">Recent Shipments</div>
      {recent.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-body-small)', padding: '0.5rem 0' }}>
          No shipments to show.
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 0,
        position: 'relative', overflowX: 'auto', paddingBottom: '0.5rem',
      }}>
        {recent.map((s, i) => {
          const statusColor = MATERIAL_STATUS_COLOR[s.materialStatus];
          const isLast = i === recent.length - 1;

          return (
            <div key={s.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flex: 1, minWidth: 170, position: 'relative',
            }}>
              {/* Connecting line */}
              {!isLast && (
                <div style={{
                  position: 'absolute', top: 18, left: '50%', width: '100%',
                  height: 2, background: 'var(--border)', zIndex: 0,
                }} />
              )}

              {/* Dot */}
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: statusColor, border: '3px solid var(--bg-card)',
                boxShadow: `0 0 0 2px ${statusColor}40`,
                zIndex: 1, marginBottom: '0.5rem', flexShrink: 0,
              }} />

              {/* Date */}
              <div style={{
                fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)',
                fontWeight: 600, marginBottom: 2,
              }}>
                {formatDMY(s.createdAt)}
              </div>

              {/* Supplier */}
              <div style={{
                fontSize: 'var(--font-size-body-small)', fontWeight: 700,
                color: 'var(--text-primary)', textAlign: 'center',
                lineHeight: 1.3, marginBottom: 4,
              }}>
                {s.supplier}
              </div>

              {/* Material status badge */}
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                background: `${statusColor}18`, color: statusColor,
                fontSize: 'var(--font-size-tiny)', fontWeight: 700,
                whiteSpace: 'nowrap',
              }}>
                {s.materialStatus}
              </span>

              {/* Delivered date, or ETD / ETA */}
              <div style={{
                marginTop: 4, textAlign: 'center', padding: '0 0.5rem',
                fontSize: 'var(--font-size-tiny)', color: 'var(--text-secondary)', lineHeight: 1.4,
              }}>
                {s.materialStatus === 'Delivered'
                  ? `Delivered : ${formatDMY(s.deliveredDate) || '?'}`
                  : formatEtdEta(s)}
              </div>

              {/* Mode icon + label */}
              <div style={{
                marginTop: 4, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 'var(--font-size-tiny)',
              }}>
                {s.modeOfShipment === 'Sea' ? <Ship size={12} />
                  : s.modeOfShipment === 'Air' ? <Plane size={12} />
                  : <Package size={12} />}
                <span>{getModeLabel(s)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Dashboard Page
═══════════════════════════════════════════════════════════════════════════ */
export default function ShipmentDashboardPage() {
  const { shipments, ready } = useShipments();
  const [searchTerm, setSearchTerm] = useState('');

  /* Filtered data */
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return shipments;
    const q = searchTerm.toLowerCase();
    return shipments.filter(s =>
      s.supplier.toLowerCase().includes(q) ||
      s.invoiceNo.toLowerCase().includes(q) ||
      s.material.toLowerCase().includes(q) ||
      s.blNo.toLowerCase().includes(q) ||
      s.poNo.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q) ||
      (s.otherModeDetail ?? '').toLowerCase().includes(q)
    );
  }, [shipments, searchTerm]);

  /* KPI computations */
  const kpis = useMemo(() => {
    const totalShipments = filtered.length;
    const inTransit = filtered.filter(s => s.materialStatus === 'In Transit').length;
    const pendingPayments = filtered.filter(s => s.paymentStatus === 'NOT PAID').length;
    const overduePayments = filtered.filter(s => isPaymentOverdue(s)).length;
    return { totalShipments, inTransit, pendingPayments, overduePayments };
  }, [filtered]);

  // Wait for the saved data so the page doesn't flash the starting records first.
  if (!ready) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-body)' }}>
        Loading shipments…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div>
          <h2 style={{
            fontSize: 'var(--font-size-section-heading)', fontWeight: 800,
            color: 'var(--text-primary)', margin: 0,
          }}>
            Shipment Dashboard
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Link href="/shipments/entry?tab=history" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.5rem 1rem', borderRadius: 8,
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontSize: 'var(--font-size-body-small)', fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow: 'var(--card-shadow)',
              transition: 'transform 0.15s',
            }}>
              History & Export
            </button>
          </Link>
          <Link href="/shipments/entry" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.5rem 1rem', borderRadius: 8,
              background: ACCENT.blue, color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 'var(--font-size-body-small)', fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow: `0 2px 8px ${ACCENT.blue}40`,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${ACCENT.blue}50`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${ACCENT.blue}40`;
            }}
            >
              <Plus size={15} />
              New Entry
            </button>
          </Link>
        </div>
      </div>

      {/* ── Search / Filter bar ── */}
      <div className="fade-up" style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '0.45rem 0.875rem',
        boxShadow: 'var(--card-shadow)',
      }}>
        <Search size={15} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search by supplier, invoice, material, BL, PO, country…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent',
            fontSize: 'var(--font-size-body-small)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '0.2rem 0.5rem', cursor: 'pointer',
            fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)',
            fontFamily: 'inherit',
          }}>
            Clear
          </button>
        )}
        <span style={{
          fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}>
          {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── ROW 1: KPI Summary Cards ── */}
      <div className="dashboard-kpi-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem',
      }}>
        <KpiCard icon={Package} label="Total Shipments" value={kpis.totalShipments} total={kpis.totalShipments} color={ACCENT.blue} delay={0.05} />
        <KpiCard icon={Ship} label="In Transit" value={kpis.inTransit} total={kpis.totalShipments} color={ACCENT.orange} delay={0.1} />
        <KpiCard icon={AlertCircle} label="Pending Payments" value={kpis.pendingPayments} total={kpis.totalShipments} color={ACCENT.red} delay={0.15} />
        <KpiCard icon={Clock} label="Overdue Payments" value={kpis.overduePayments} total={kpis.totalShipments} color={ACCENT.red} delay={0.2} pulsing />
      </div>

      {/* ── ROW 2: Payment Calendar + Payment Status Donut ── */}
      <div className="dashboard-dual-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr 300px', gap: '0.875rem',
      }}>
        <PaymentCalendar data={filtered} />
        <PaymentDonut data={filtered} />
      </div>

      {/* ── ROW 3: Shipments by Mode + Material Status ── */}
      <div className="dashboard-dual-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem',
      }}>
        <ShipmentsByMode data={filtered} />
        <MaterialStatusBreakdown data={filtered} />
      </div>

      {/* ── ROW 4: Upcoming Due Payments Table ── */}
      <DuePaymentsTable data={filtered} />

      {/* ── ROW 5: Recent Shipments Timeline ── */}
      <RecentTimeline data={filtered} />
    </div>
  );
}