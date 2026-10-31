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
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  Package, Ship, AlertCircle, Clock, Search, Plus,
  ChevronLeft, ChevronRight, Anchor, Plane, FileText, X, Calendar as CalendarIcon, Filter, Globe, AlertTriangle, PackageX, ExternalLink,
} from 'lucide-react';

import { Shipment, MaterialStatus, PaymentStatus, PAYMENT_STATUSES } from '@/types/shipment';
import {
  formatDMY,
  formatEtdEta,
  getDefaultPoDateRange,
  getDaysUntilDue,
  getModeLabel,
  getPaymentDueDate,
  getPaymentPeriod,
  getPaymentTermsLabel,
  isPaymentCalendarEligible,
  isPaymentOverdue,
  poDateMatchesRange,
  toISODate,
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

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  PAID: ACCENT.green,
  'NOT PAID': ACCENT.red,
  PARTIAL: ACCENT.orange,
  ADVANCE: ACCENT.blue,
  '2 WAY': ACCENT.purple,
  'SR DATE': ACCENT.teal,
};

const MATERIAL_STATUS_COLOR: Record<MaterialStatus, string> = {
  'In Transit': ACCENT.blue,
  'At Port': ACCENT.orange,
  'Customs Clearance': ACCENT.purple,
  Arrived: ACCENT.green,
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
      zIndex: 100,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{label || payload[0].name}</div>
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

/** Parses Date objects and 'yyyy-mm-dd' strings without timezone shifts. */
function toLocalDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════════════════════ */

/* ── KPI Stat Card with Click Handler ── */
function KpiCard({
  icon: Icon, label, value, total, color, delay, pulsing, onClick,
}: {
  icon: React.ElementType; label: string; value: number; total: number;
  color: string; delay: number; pulsing?: boolean; onClick?: () => void;
}) {
  const pct = Math.min((value / Math.max(total, 1)) * 100, 100);
  return (
    <div 
      className={`stat-card fade-up`} 
      onClick={onClick}
      style={{ 
        animationDelay: `${delay}s`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'var(--card-shadow)';
        }
      }}
    >
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
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: '0.25rem', fontSize: 'var(--font-size-compact)',
        color: 'var(--text-muted)',
      }}>
        <span>{pct.toFixed(0)}% of total</span>
        {onClick && <span style={{ color: ACCENT.blue, fontWeight: 700 }}>View details →</span>}
      </div>
    </div>
  );
}

/* ── Generic Modal Dialog Box (Dark Mode Suitable, 90% Width/Height, Fixed Header Search) ── */
function ShipmentListModal({
  title,
  shipments,
  onClose,
  color = ACCENT.blue,
}: {
  title: string;
  shipments: Shipment[];
  onClose: () => void;
  color?: string;
}) {
  const [colFilters, setColFilters] = useState({
    supplierCountry: '',
    poDate: '',
    invoiceDate: '',
    blDate: '',
    paymentTerms: '',
    etdEta: '',
    dueDate: '',
    paymentStatus: '',
    materialStatus: '',
  });

  const handleFilterChange = (col: keyof typeof colFilters, val: string) => {
    setColFilters(prev => ({ ...prev, [col]: val.toLowerCase() }));
  };

  const hasActiveFilter = Object.values(colFilters).some(v => v.trim().length > 0);

  const filteredModalShipments = useMemo(() => {
    return shipments.filter(s => {
      const supplierCountryStr = `${s.supplier} ${s.country || ''}`.toLowerCase();
      const poDateStr = `${s.poNo} ${s.poDate ? formatDMY(s.poDate) : ''}`.toLowerCase();
      const invoiceDateStr = (
        `${s.invoiceNo} ${s.invoiceDate ? formatDMY(s.invoiceDate) : ''} ` +
        `${s.proformaInvoiceNo ?? ''} ${s.proformaInvoiceDate ? formatDMY(s.proformaInvoiceDate) : ''}`
      ).toLowerCase();
      const blDateStr = `${s.blNo || ''} ${s.blDate ? formatDMY(s.blDate) : ''}`.toLowerCase();
      const paymentTermsStr = getPaymentTermsLabel(s).toLowerCase();
      const paymentStatusStr = s.paymentStatus.toLowerCase();
      const materialStatusStr = s.materialStatus.toLowerCase();
      const etdEtaStr = `${s.etd ? formatDMY(s.etd) : ''} ${s.eta ? formatDMY(s.eta) : ''} ${s.arrivedDate ? formatDMY(s.arrivedDate) : ''}`.toLowerCase();
      const dueDate = getPaymentDueDate(s);
      const dueDateStr = dueDate ? formatDMY(dueDate).toLowerCase() : '';

      return (
        supplierCountryStr.includes(colFilters.supplierCountry) &&
        poDateStr.includes(colFilters.poDate) &&
        invoiceDateStr.includes(colFilters.invoiceDate) &&
        blDateStr.includes(colFilters.blDate) &&
        paymentTermsStr.includes(colFilters.paymentTerms) &&
        etdEtaStr.includes(colFilters.etdEta) &&
        dueDateStr.includes(colFilters.dueDate) &&
        paymentStatusStr.includes(colFilters.paymentStatus) &&
        materialStatusStr.includes(colFilters.materialStatus)
      );
    });
  }, [shipments, colFilters]);

  const inputFilterStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.35rem 0.5rem',
    marginTop: '0.35rem',
    fontSize: 'var(--font-size-compact)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }}>
      <div className="card fade-up" style={{
        width: '90vw', height: '90vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)', borderLeft: `6px solid ${color}`,
        border: '1px solid var(--border)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', padding: '1.25rem',
        borderRadius: 12,
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <span style={{
              fontSize: 'var(--font-size-compact)', fontWeight: 800, padding: '3px 12px', borderRadius: 12,
              background: `${color}20`, color: color,
            }}>
              {filteredModalShipments.length} / {shipments.length} {shipments.length === 1 ? 'Shipment' : 'Shipments'}
            </span>
            {hasActiveFilter && (
              <button
                onClick={() => setColFilters({
                  supplierCountry: '',
                  poDate: '',
                  invoiceDate: '',
                  blDate: '',
                  paymentTerms: '',
                  etdEta: '',
                  dueDate: '',
                  paymentStatus: '',
                  materialStatus: '',
                })}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer',
                  fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                Reset Column Search
              </button>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', padding: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body Table with Always-Visible Header & Search Inputs */}
        <div style={{ overflow: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-body-small)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Supplier & Country
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.supplierCountry}
                    onChange={e => handleFilterChange('supplierCountry', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  PO & Date
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.poDate}
                    onChange={e => handleFilterChange('poDate', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Invoice & Date
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.invoiceDate}
                    onChange={e => handleFilterChange('invoiceDate', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  BL & Date
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.blDate}
                    onChange={e => handleFilterChange('blDate', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  ETD / ETA / Arrival
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.etdEta}
                    onChange={e => handleFilterChange('etdEta', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Payment Terms
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.paymentTerms}
                    onChange={e => handleFilterChange('paymentTerms', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Payment Due Date
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.dueDate}
                    onChange={e => handleFilterChange('dueDate', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  PRW Status
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.paymentStatus}
                    onChange={e => handleFilterChange('paymentStatus', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Status
                  <input
                    type="text"
                    placeholder="Search..."
                    value={colFilters.materialStatus}
                    onChange={e => handleFilterChange('materialStatus', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredModalShipments.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-body)' }}>
                    {shipments.length === 0 
                      ? 'No shipments match this criteria.' 
                      : 'No shipments match the applied column search filters.'}
                  </td>
                </tr>
              ) : (
                filteredModalShipments.map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 1 ? 'var(--bg-secondary)' : 'transparent' }}>
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <div>{s.supplier}</div>
                      <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)', fontWeight: 500 }}>{s.country || '—'}</div>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                      <div>{s.poNo}</div>
                      <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>{s.poDate ? formatDMY(s.poDate) : '—'}</div>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                      <div>{s.invoiceNo}</div>
                      <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>{s.invoiceDate ? formatDMY(s.invoiceDate) : '—'}</div>
                      {s.proformaInvoiceNo && (
                        <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>
                          Proforma: {s.proformaInvoiceNo} · {formatDMY(s.proformaInvoiceDate) || '—'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                      <div>{s.blNo || '—'}</div>
                      <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>{s.blDate ? formatDMY(s.blDate) : '—'}</div>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                      <div>ETD: {s.etd ? formatDMY(s.etd) : '—'}</div>
                      <div>ETA: {s.eta ? formatDMY(s.eta) : '—'}</div>
                      {s.arrivedDate && <div>Arrived: {formatDMY(s.arrivedDate)}</div>}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {getPaymentTermsLabel(s)}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                      {getPaymentDueDate(s) ? formatDMY(getPaymentDueDate(s)) : '—'}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 8px', borderRadius: 8,
                        background: `${PAYMENT_STATUS_COLOR[s.paymentStatus]}18`, color: PAYMENT_STATUS_COLOR[s.paymentStatus],
                        fontWeight: 800, fontSize: 'var(--font-size-tiny)',
                      }}>
                        {s.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 8px', borderRadius: 8,
                        background: `${MATERIAL_STATUS_COLOR[s.materialStatus]}18`, color: MATERIAL_STATUS_COLOR[s.materialStatus],
                        fontWeight: 800, fontSize: 'var(--font-size-tiny)',
                      }}>
                        {s.materialStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Interactive Calendar View (Due Payment Indicators + Side-by-Side Horizontal ETA Circles) ── */
function PaymentCalendar({
  data,
  selectedDate,
  onSelectDate,
}: {
  data: Shipment[];
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
}) {
  const [calDate, setCalDate] = useState(() => new Date());
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  /* Build map: day → due shipments & ETA shipments */
  const dayMap = useMemo(() => {
    const map = new Map<number, { dueShipments: Shipment[]; etaShipments: Shipment[] }>();

    data.forEach(s => {
      // Due payments
      const due = getPaymentDueDate(s);
      if (isPaymentCalendarEligible(s) && due && due.getFullYear() === year && due.getMonth() === month) {
        const day = due.getDate();
        const existing = map.get(day) || { dueShipments: [], etaShipments: [] };
        existing.dueShipments.push(s);
        map.set(day, existing);
      }

      // ETA (Estimated Time of Arrival)
      const etaDate = s.eta ? toLocalDate(s.eta) : null;
      if (etaDate && etaDate.getFullYear() === year && etaDate.getMonth() === month) {
        const day = etaDate.getDate();
        const existing = map.get(day) || { dueShipments: [], etaShipments: [] };
        existing.etaShipments.push(s);
        map.set(day, existing);
      }
    });

    return map;
  }, [data, year, month]);

  const prevMonth = () => setCalDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalDate(new Date(year, month + 1, 1));

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card fade-up delay-2" style={{ padding: '1.125rem', minWidth: 0, width: '100%' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.75rem',
      }}>
        <div className="section-title" style={{ margin: 0 }}>Calendar View (Payments & ETA)</div>
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
            color: 'var(--text-primary)', minWidth: 100, textAlign: 'center',
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

          const cellData = dayMap.get(day);
          const cellDate = new Date(year, month, day);
          const isToday = isSameDay(today, cellDate);
          const isSelected = selectedDate ? isSameDay(selectedDate, cellDate) : false;

          return (
            <div
              key={day}
              onClick={() => onSelectDate(cellDate)}
              style={{
                position: 'relative',
                minHeight: 46,
                borderRadius: 6,
                padding: '2px',
                border: isSelected
                  ? `2px solid ${ACCENT.purple}`
                  : isToday
                  ? `2px solid ${ACCENT.blue}`
                  : '1px solid transparent',
                background: isSelected
                  ? 'rgba(139, 92, 246, 0.15)'
                  : cellData
                  ? 'var(--bg-secondary)'
                  : 'transparent',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-start',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{
                fontSize: 'var(--font-size-compact)',
                fontWeight: isSelected || isToday ? 800 : 500,
                color: isSelected ? ACCENT.purple : isToday ? ACCENT.blue : 'var(--text-secondary)',
              }}>
                {day}
              </span>

              {/* Side-by-Side ETA Circles Container */}
              {cellData?.etaShipments && cellData.etaShipments.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  marginTop: 2,
                  flexWrap: 'nowrap',
                }}>
                  {cellData.etaShipments.map(s => {
                    const isArrived = s.materialStatus === 'Arrived';
                    return (
                      <span
                        key={`eta-dot-${s.id}`}
                        title={`ETA Shipment ${s.id}: ${s.materialStatus}`}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isArrived ? ACCENT.green : ACCENT.red,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Mini payment bars */}
              {cellData?.dueShipments && cellData.dueShipments.length > 0 && (
                <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {cellData.dueShipments.map(s => (
                    <div key={`due-${s.id}`} style={{
                      width: 8, height: 3, borderRadius: 1,
                      background: PAYMENT_STATUS_COLOR[s.paymentStatus],
                    }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem',
        fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {([['PAID', ACCENT.green], ['NOT PAID', ACCENT.red]] as const).map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 4, borderRadius: 1, background: color }} />
              {label}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT.green, display: 'inline-block' }} />
            ETA Arrived
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT.red, display: 'inline-block' }} />
            ETA Pending
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Selected Date Details Modal/Panel ── */
function DatePaymentDetails({
  selectedDate,
  data,
  onClose,
}: {
  selectedDate: Date;
  data: Shipment[];
  onClose: () => void;
}) {
  const matchingShipments = useMemo(() => {
    return data.filter(s => {
      const due = getPaymentDueDate(s);
      const dueMatches = isPaymentCalendarEligible(s) && due ? isSameDay(due, selectedDate) : false;
      const eta = s.eta ? toLocalDate(s.eta) : null;
      const etaMatches = eta ? isSameDay(eta, selectedDate) : false;
      return dueMatches || etaMatches;
    });
  }, [data, selectedDate]);

  return (
    <ShipmentListModal
      title={`Shipment & Payment Details for ${formatDMY(selectedDate)}`}
      shipments={matchingShipments}
      onClose={onClose}
      color={ACCENT.purple}
    />
  );
}

/* ── Month-Wise PO Raised vs Payment Status ── */
function MonthlyPoAndPaymentAnalytics({
  data,
  selectedYear,
  onYearChange,
}: {
  data: Shipment[];
  selectedYear: number;
  onYearChange: (y: number) => void;
}) {
  const [clickedMonthIndex, setClickedMonthIndex] = useState<number | null>(null);

  /* Aggregate month-wise PO Raised and Payment statuses */
  const monthlyData = useMemo(() => {
    const list = MONTH_NAMES.map((m, idx) => ({
      month: m,
      monthIndex: idx,
      poRaised: 0,
      paid: 0,
      unpaid: 0,
      partial: 0,
      advance: 0,
      twoWay: 0,
      srDate: 0,
    }));

    data.forEach(s => {
      const poDate = s.poDate ? toLocalDate(s.poDate) : null;
      if (poDate && poDate.getFullYear() === selectedYear) {
        const idx = poDate.getMonth();
        list[idx].poRaised += 1;
        if (s.paymentStatus === 'PAID') list[idx].paid += 1;
        else if (s.paymentStatus === 'NOT PAID') list[idx].unpaid += 1;
        else if (s.paymentStatus === 'PARTIAL') list[idx].partial += 1;
        else if (s.paymentStatus === 'ADVANCE') list[idx].advance += 1;
        else if (s.paymentStatus === '2 WAY') list[idx].twoWay += 1;
        else if (s.paymentStatus === 'SR DATE') list[idx].srDate += 1;
      }
    });

    return list;
  }, [data, selectedYear]);

  /* Get shipments for clicked month */
  const monthShipments = useMemo(() => {
    if (clickedMonthIndex === null) return [];
    return data.filter(s => {
      const poDate = s.poDate ? toLocalDate(s.poDate) : null;
      return poDate && poDate.getFullYear() === selectedYear && poDate.getMonth() === clickedMonthIndex;
    });
  }, [data, selectedYear, clickedMonthIndex]);

  return (
    <>
      <div className="card fade-up delay-1" style={{ padding: '1.125rem', minWidth: 0, width: '100%' }}>
        {/* Header with Title and Number Input Field for Year */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} color={ACCENT.purple} />
            <div className="section-title" style={{ margin: 0 }}>
              Month-Wise PO & Payment Breakdown ({selectedYear})
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: 'var(--font-size-compact)', fontWeight: 700, color: 'var(--text-muted)' }}>
              Enter Year:
            </label>
            <input
              type="number"
              value={selectedYear}
              onChange={e => onYearChange(Number(e.target.value) || new Date().getFullYear())}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.3rem 0.6rem',
                fontSize: 'var(--font-size-body-small)',
                color: 'var(--text-primary)',
                fontWeight: 800,
                outline: 'none',
                width: 80,
              }}
            />
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={260}>
          <BarChart 
            accessibilityLayer={false}
            data={monthlyData} 
            barSize={18}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            style={{ outline: 'none' }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length) {
                const monthIdx = state.activePayload[0].payload.monthIndex;
                setClickedMonthIndex(monthIdx);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
            <YAxis 
              width={35} 
              allowDecimals={false} 
              tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} 
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: FONT_SIZES.chartLabel, paddingTop: 10 }} />
            
            <Bar dataKey="poRaised" name="PO Raised" stackId="po" fill={ACCENT.blue} radius={[4, 4, 0, 0]} cursor="pointer" />
            <Bar dataKey="paid" name="Paid" stackId="payments" fill={ACCENT.green} radius={[0, 0, 0, 0]} cursor="pointer" />
            <Bar dataKey="partial" name="Partial" stackId="payments" fill={ACCENT.orange} radius={[0, 0, 0, 0]} cursor="pointer" />
            <Bar dataKey="advance" name="Advance" stackId="payments" fill={ACCENT.blue} radius={[0, 0, 0, 0]} cursor="pointer" />
            <Bar dataKey="twoWay" name="2 Way" stackId="payments" fill={ACCENT.purple} radius={[0, 0, 0, 0]} cursor="pointer" />
            <Bar dataKey="srDate" name="SR Date" stackId="payments" fill={ACCENT.teal} radius={[0, 0, 0, 0]} cursor="pointer" />
            <Bar dataKey="unpaid" name="Unpaid" stackId="payments" fill={ACCENT.red} radius={[4, 4, 0, 0]} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Modal Popup on Chart Click */}
      {clickedMonthIndex !== null && (
        <ShipmentListModal
          title={`Shipments for ${MONTH_NAMES[clickedMonthIndex]} ${selectedYear}`}
          shipments={monthShipments}
          onClose={() => setClickedMonthIndex(null)}
          color={ACCENT.blue}
        />
      )}
    </>
  );
}

/* ── Supplier-Wise Chart + Interactive Product Pie Chart ── */
function SupplierAndProductAnalytics({ data }: { data: Shipment[] }) {
  const supplierData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(s => {
      map.set(s.supplier, (map.get(s.supplier) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([supplier, count]) => ({ supplier, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const activeSupplier = selectedSupplier || supplierData[0]?.supplier || '';

  const productPieData = useMemo(() => {
    if (!activeSupplier) return [];
    const map = new Map<string, number>();
    data.filter(s => s.supplier === activeSupplier).forEach(s => {
      const prod = s.material || 'General Material';
      map.set(prod, (map.get(prod) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value], i) => ({
      name,
      value,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [data, activeSupplier]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.875rem' }}>
      {/* 1st Chart: Supplier Wise Shipments Bar Chart */}
      <div className="card fade-up delay-1" style={{ padding: '1.125rem', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div className="section-title" style={{ margin: 0 }}>Supplier-Wise Shipments</div>
          <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>Tap bar to choose supplier</div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart 
            accessibilityLayer={false}
            data={supplierData} 
            barSize={28} 
            margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
            style={{ outline: 'none' }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length) {
                setSelectedSupplier(state.activePayload[0].payload.supplier);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis 
              dataKey="supplier" 
              tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} 
              interval={0} 
              angle={-20} 
              textAnchor="end" 
            />
            <YAxis 
              width={35} 
              allowDecimals={false} 
              tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} 
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" name="Shipments" radius={[6, 6, 0, 0]} cursor="pointer">
              {supplierData.map((entry) => (
                <Cell
                  key={entry.supplier}
                  fill={entry.supplier === activeSupplier ? ACCENT.purple : ACCENT.blue}
                  opacity={entry.supplier === activeSupplier ? 1 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2nd Chart: Supplier Product Breakdown Pie Chart */}
      <div className="card fade-up delay-2" style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="section-title" style={{ margin: 0 }}>Product Breakdown</div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)', fontWeight: 600 }}>Supplier:</label>
            <select
              value={activeSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.25rem 0.5rem',
                fontSize: 'var(--font-size-compact)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                maxWidth: 160,
              }}
            >
              {supplierData.map(s => (
                <option key={s.supplier} value={s.supplier}>
                  {s.supplier} ({s.count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {productPieData.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No product data for selected supplier.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart style={{ outline: 'none' }}>
              <Pie
                data={productPieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {productPieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ── Country-Wise Shipments Chart Component ── */
function ShipmentsByCountry({ data }: { data: Shipment[] }) {
  const countryData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(s => {
      const country = s.country || 'Unknown';
      map.set(country, (map.get(country) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div className="card fade-up delay-1" style={{ padding: '1.125rem', minWidth: 0, width: '100%' }}>
      <div className="section-title">Country-Wise Shipments</div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart accessibilityLayer={false} data={countryData} barSize={28} margin={{ top: 10, right: 10, left: 0, bottom: 20 }} style={{ outline: 'none' }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis 
            dataKey="country" 
            tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} 
            interval={0} 
            angle={-15} 
            textAnchor="end" 
          />
          <YAxis 
            width={35} 
            allowDecimals={false} 
            tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} 
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Shipments" radius={[6, 6, 0, 0]}>
            {countryData.map((entry, index) => (
              <Cell key={entry.country} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Payment Status Donut ── */
function PaymentDonut({ data }: { data: Shipment[] }) {
  const counts = useMemo(() => {
    const map = Object.fromEntries(PAYMENT_STATUSES.map((status) => [status, 0])) as Record<PaymentStatus, number>;
    data.forEach(s => { map[s.paymentStatus] += 1; });
    return map;
  }, [data]);

  const total = data.length;
  const slices = PAYMENT_STATUSES.map((status) => ({
    name: status,
    value: counts[status],
    color: PAYMENT_STATUS_COLOR[status],
  }));

  return (
    <div className="card fade-up delay-3" style={{
      padding: '1.125rem', display: 'flex', flexDirection: 'column',
      alignItems: 'center', minWidth: 0, width: '100%',
    }}>
      <div className="section-title" style={{ alignSelf: 'flex-start' }}>PRW Status</div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart style={{ outline: 'none' }}>
          <Pie
            data={slices}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={65}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {slices.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
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

/* ── Shipments by Mode (Recharts Bar) ── */
function ShipmentsByMode({ data }: { data: Shipment[] }) {
  const modeData = useMemo(() => {
    const counts = new Map<string, number>();
    data.forEach((shipment) => {
      counts.set(shipment.modeOfShipment, (counts.get(shipment.modeOfShipment) ?? 0) + 1);
    });
    return Array.from(counts, ([mode, count], index) => ({
      mode,
      count,
      color: [ACCENT.blue, ACCENT.teal, ACCENT.purple][index % 3],
    }));
  }, [data]);

  const modeIcon = (mode: string, color: string) =>
    mode === 'Sea' ? <Anchor size={14} color={color} />
    : mode === 'Air' ? <Plane size={14} color={color} />
    : <Package size={14} color={color} />;

  return (
    <div className="card fade-up delay-1" style={{ padding: '1.125rem', minWidth: 0, width: '100%' }}>
      <div className="section-title">Shipments by Mode</div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart accessibilityLayer={false} data={modeData} barSize={36} barCategoryGap="40%" margin={{ top: 10, right: 10, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="mode" tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
          <YAxis 
            width={35} 
            allowDecimals={false} 
            tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} 
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Shipments" radius={[6, 6, 0, 0]}>
            {modeData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap',
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

/* ── Interactive Material Status Breakdown ── */
function MaterialStatusBreakdown({ 
  data, 
  onSelectStatus 
}: { 
  data: Shipment[]; 
  onSelectStatus: (status: MaterialStatus, shipments: Shipment[]) => void;
}) {
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(s => {
      map[s.materialStatus] = (map[s.materialStatus] || 0) + 1;
    });
    const statuses: MaterialStatus[] = ['Pending Shipment','In Transit', 'At Port', 'Customs Clearance', 'Arrived'];
    return statuses.map(st => ({
      status: st,
      count: map[st] || 0,
      color: MATERIAL_STATUS_COLOR[st],
      shipments: data.filter(s => s.materialStatus === st),
    }));
  }, [data]);

  const maxCount = Math.max(...statusCounts.map(s => s.count), 1);

  return (
    <div className="card fade-up delay-2" style={{ padding: '1.125rem', minWidth: 0, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title" style={{ margin: 0 }}>Material Status</div>
        <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>Tap status to inspect</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.75rem' }}>
        {statusCounts.map(s => (
          <div 
            key={s.status} 
            onClick={() => onSelectStatus(s.status, s.shipments)}
            style={{ cursor: 'pointer', borderRadius: 6, padding: '2px 4px', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 'var(--font-size-body-small)', fontWeight: 800,
                  color: 'var(--text-primary)',
                }}>
                  {s.count}
                </span>
                <span style={{ fontSize: 'var(--font-size-compact)', color: ACCENT.blue }}>→</span>
              </div>
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
      .filter(r => r.dueDate !== null && isPaymentCalendarEligible(r.shipment))
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
                    {s.proformaInvoiceNo && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-compact)' }}>
                        Proforma: {s.proformaInvoiceNo} · {formatDMY(s.proformaInvoiceDate) || '—'}
                      </div>
                    )}
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

/* ═══════════════════════════════════════════════════════════════════════════
   Main Dashboard Page
═══════════════════════════════════════════════════════════════════════════ */
export default function ShipmentDashboardPage() {
  const { shipments, ready } = useShipments();
  const [searchTerm, setSearchTerm] = useState('');
  const [dashboardPoDateRange, setDashboardPoDateRange] = useState(() => getDefaultPoDateRange('year'));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  /* Modal state for active KPI card click / Material Status click */
  const [activeModal, setActiveModal] = useState<{ title: string; color: string; data: Shipment[] } | null>(null);

  /* Default year set to current year (2026) */
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  /* Filtered data */
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return shipments.filter(s =>
      poDateMatchesRange(s.poDate, dashboardPoDateRange.startDate, dashboardPoDateRange.endDate) &&
      (!searchTerm.trim() ||
        s.supplier.toLowerCase().includes(q) ||
        s.invoiceNo.toLowerCase().includes(q) ||
        s.material.toLowerCase().includes(q) ||
        s.blNo.toLowerCase().includes(q) ||
        s.poNo.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.modeOfShipment.toLowerCase().includes(q) ||
        (s.otherModeDetail ?? '').toLowerCase().includes(q))
    );
  }, [shipments, searchTerm, dashboardPoDateRange]);

  /* Today date normalized */
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  /* KPI Groups */
  const kpis = useMemo(() => {
    const totalList = filtered;
    const inTransitList = filtered.filter(s => s.materialStatus === 'In Transit');
    const pendingPaymentsList = filtered.filter(s => s.paymentStatus === 'NOT PAID');
    const overduePaymentsList = filtered.filter(s => isPaymentOverdue(s));

    // Card 5: ETD date surpassed but still not in transit (Pending Shipment)
    const etdSurpassedNotTransitList = filtered.filter(s => {
      if (s.materialStatus !== 'Pending Shipment') return false;
      const etd = s.etd ? toLocalDate(s.etd) : null;
      return etd ? etd < today : false;
    });

    // Card 6: ETA date surpassed but not arrived (In Transit)
    const etaSurpassedNotArrivedList = filtered.filter(s => {
      if (s.materialStatus !== 'In Transit') return false;
      const eta = s.eta ? toLocalDate(s.eta) : null;
      return eta ? eta < today : false;
    });

    return {
      total: totalList,
      inTransit: inTransitList,
      pendingPayments: pendingPaymentsList,
      overduePayments: overduePaymentsList,
      etdSurpassedNotTransit: etdSurpassedNotTransitList,
      etaSurpassedNotArrived: etaSurpassedNotArrivedList,
    };
  }, [filtered, today]);

  if (!ready) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-body)' }}>
        Loading shipments…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

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

      <div className="fade-up" style={{
        display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: '0.75rem',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '0.65rem 0.875rem', boxShadow: 'var(--card-shadow)',
      }}>
        <label style={{ display: 'grid', gap: 4, color: 'var(--text-secondary)', fontSize: 'var(--font-size-label)', fontWeight: 700 }}>
          PO Date From
          <input
            type="date"
            aria-label="Dashboard PO date from"
            value={dashboardPoDateRange.startDate}
            max={dashboardPoDateRange.endDate || undefined}
            onChange={(event) => setDashboardPoDateRange((range) => ({ ...range, startDate: event.target.value }))}
            style={{ minHeight: 34, minWidth: 165, padding: '0.35rem 0.55rem', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, color: 'var(--text-secondary)', fontSize: 'var(--font-size-label)', fontWeight: 700 }}>
          PO Date To
          <input
            type="date"
            aria-label="Dashboard PO date to"
            value={dashboardPoDateRange.endDate}
            min={dashboardPoDateRange.startDate || undefined}
            onChange={(event) => setDashboardPoDateRange((range) => ({ ...range, endDate: event.target.value }))}
            style={{ minHeight: 34, minWidth: 165, padding: '0.35rem 0.55rem', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit' }}
          />
        </label>
        <button
          type="button"
          onClick={() => setDashboardPoDateRange(getDefaultPoDateRange('year'))}
          style={{ minHeight: 34, padding: '0.4rem 0.7rem', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit', fontSize: 'var(--font-size-compact)', fontWeight: 700, cursor: 'pointer' }}
        >
          This year
        </button>
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-compact)' }}>
          Dashboard is filtered by PO date
        </span>
      </div>

      {/* ── ROW 1: KPI Summary Cards (Mobile Responsive Grid & Interactive Modals) ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem',
      }}>
        <KpiCard 
          icon={Package} 
          label="Total Shipments" 
          value={kpis.total.length} 
          total={kpis.total.length} 
          color={ACCENT.blue} 
          delay={0.05} 
          onClick={() => setActiveModal({ title: 'Total Shipments', color: ACCENT.blue, data: kpis.total })}
        />
        <KpiCard 
          icon={Ship} 
          label="In Transit" 
          value={kpis.inTransit.length} 
          total={kpis.total.length} 
          color={ACCENT.orange} 
          delay={0.1} 
          onClick={() => setActiveModal({ title: 'In Transit Shipments', color: ACCENT.orange, data: kpis.inTransit })}
        />
        <KpiCard 
          icon={AlertCircle} 
          label="Pending Payments" 
          value={kpis.pendingPayments.length} 
          total={kpis.total.length} 
          color={ACCENT.red} 
          delay={0.15} 
          onClick={() => setActiveModal({ title: 'Pending Payments', color: ACCENT.red, data: kpis.pendingPayments })}
        />
        <KpiCard 
          icon={Clock} 
          label="Overdue Payments" 
          value={kpis.overduePayments.length} 
          total={kpis.total.length} 
          color={ACCENT.red} 
          delay={0.2} 
          pulsing={kpis.overduePayments.length > 0} 
          onClick={() => setActiveModal({ title: 'Overdue Payments', color: ACCENT.red, data: kpis.overduePayments })}
        />
        <KpiCard 
          icon={PackageX} 
          label="ETD Passed – Not In Transit" 
          value={kpis.etdSurpassedNotTransit.length} 
          total={kpis.total.length} 
          color={ACCENT.red} 
          delay={0.25} 
          pulsing={kpis.etdSurpassedNotTransit.length > 0} 
          onClick={() => setActiveModal({ title: 'ETD Surpassed – Still Pending Shipment', color: ACCENT.red, data: kpis.etdSurpassedNotTransit })}
        />
        <KpiCard 
          icon={Anchor} 
          label="ETA Passed – Not Arrived" 
          value={kpis.etaSurpassedNotArrived.length} 
          total={kpis.total.length} 
          color={ACCENT.orange} 
          delay={0.3} 
          pulsing={kpis.etaSurpassedNotArrived.length > 0} 
          onClick={() => setActiveModal({ title: 'ETA Surpassed – Still In Transit', color: ACCENT.orange, data: kpis.etaSurpassedNotArrived })}
        />
      </div>

      {/* KPI & Material Detail Dialog Popup */}
      {activeModal && (
        <ShipmentListModal
          title={activeModal.title}
          shipments={activeModal.data}
          color={activeModal.color}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* ── ROW 2: Payment Calendar + Payment Status Donut + Interactive Material Status ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem',
      }}>
        <PaymentCalendar
          data={filtered}
          selectedDate={selectedCalendarDate}
          onSelectDate={(d) => setSelectedCalendarDate(d)}
        />
        <PaymentDonut data={filtered} />
        <MaterialStatusBreakdown 
          data={filtered} 
          onSelectStatus={(status, items) => {
            setActiveModal({
              title: `Shipments in ${status}`,
              color: MATERIAL_STATUS_COLOR[status],
              data: items,
            });
          }}
        />
      </div>

      {/* Expanded Payment Details for selected date */}
      {selectedCalendarDate && (
        <DatePaymentDetails
          selectedDate={selectedCalendarDate}
          data={filtered}
          onClose={() => setSelectedCalendarDate(null)}
        />
      )}

      {/* ── ROW 3: Monthly PO Raised vs Payment Status Breakdown ── */}
      <MonthlyPoAndPaymentAnalytics
        data={filtered}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
      />

      {/* ── ROW 4: Supplier Wise Bar Chart + Supplier Product Breakdown Pie Chart ── */}
      <SupplierAndProductAnalytics data={filtered} />

      {/* ── ROW 5: Shipments by Mode + Country Breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
        <ShipmentsByMode data={filtered} />
        <ShipmentsByCountry data={filtered} />
      </div>

      {/* ── ROW 6: Upcoming Due Payments Table ── */}
      <DuePaymentsTable data={filtered} />
    </div>
  );
}