'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Shipment Dashboard  –  Comprehensive shipment tracking & payment overview
   Reads from the shared store (useShipments), so entries added, edited or
   deleted on the entry / history page show up here straight away.
───────────────────────────────────────────────────────────────────────────── */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  Package, Ship, AlertCircle, Clock, Search, Plus,
  ChevronLeft, ChevronRight, Anchor, Plane, FileText, X, Filter, PackageX, MoreVertical,
} from 'lucide-react';

import { Shipment, MaterialStatus, PaymentStatus, PAYMENT_STATUSES } from '@/types/shipment';
import {
  formatDMY,
  getDefaultPoDateRange,
  hasPoDate,
  getDaysUntilDue,
  getPaymentDueDate,
  getPaymentPeriod,
  getPaymentTermsLabel,
  isPaymentCalendarEligible,
  isPaymentOverdue,
  poDateMatchesRange,
} from '@/data/shipmentData';
import { getFinancialYearRange } from '@/data/financialYear';
import { useShipments } from '@/hooks/useShipments';
import { FONT_SIZES } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationContext';

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
   Interactive Additional Parameters Dropdown Menu
═══════════════════════════════════════════════════════════════════════════ */
function ActionMenu({ shipment: s }: { shipment: Shipment }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          background: isOpen ? 'var(--bg-card)' : 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 6px',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Toggle additional shipment details"
        aria-expanded={isOpen}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '2.2rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            padding: '0.85rem',
            zIndex: 100,
            width: 280,
            textAlign: 'left',
            fontSize: 'var(--font-size-compact)',
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 800,
              marginBottom: 6,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 4,
              color: ACCENT.blue,
            }}
          >
            <span>Additional Parameters</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                display: 'flex',
              }}
              title="Close parameter list"
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
            <div><strong>Material ID:</strong> {s.materialId || 'IC'}</div>
            <div><strong>Material:</strong> {s.material || '—'}</div>
            <div><strong>Mode of Shipment:</strong> {s.modeOfShipment}</div>
            {s.proformaInvoiceNo && (
              <>
                <div><strong>Proforma Invoice No:</strong> {s.proformaInvoiceNo}</div>
                <div><strong>Proforma Invoice Date:</strong> {s.proformaInvoiceDate ? formatDMY(s.proformaInvoiceDate) : '—'}</div>
              </>
            )}
            <div><strong>Port of Loading:</strong> {s.portOfLoading || '—'}</div>
            <div><strong>Port of Landing:</strong> {s.portOfLanding || '—'}</div>
            <div><strong>CHA Agent:</strong> {s.cha || '—'}</div>
            <div><strong>BOE No:</strong> {s.boeNo || '—'}</div>
            <div><strong>BOE Date:</strong> {s.boeDate ? formatDMY(s.boeDate) : '—'}</div>
            <div><strong>Warehouse:</strong> {s.warehouseName || '—'}</div>
            <div><strong>Bank Ref:</strong> {s.bankReferenceNo || '—'}</div>
            <div><strong>Lead Time:</strong> {s.leadTime} days</div>
            {s.docsFolderPath && <div><strong>Folder:</strong> {s.docsFolderPath}</div>}
            {s.link && (
              <div style={{ marginTop: 4 }}>
                <a
                  href={s.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: ACCENT.blue, fontWeight: 700, textDecoration: 'none' }}
                >
                  Open Document →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════════════════════ */

/* ── KPI Stat Card with Corrected Width Percentage ── */
function KpiCard({
  icon: Icon, label, value, total, color, delay, pulsing, onClick,
}: {
  icon: React.ElementType; label: string; value: number; total: number;
  color: string; delay: number; pulsing?: boolean; onClick?: () => void;
}) {
  const pct = Math.min((value / Math.max(total, 1)) * 100, 100);
  return (
    <div
      className="stat-card fade-up"
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

/* ── Generic Modal Dialog Box with Excel-Style Column Filters ── */
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
    shipmentId: '',
    supplierCountry: '',
    materialId: '',
    cha: '',
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
      const shipmentIdStr = s.id.toLowerCase();
      const supplierCountryStr = `${s.supplier || ''} ${s.country || ''} ${s.portOfLoading || ''}`.toLowerCase();
      const materialIdStr = `${s.material || ''} ${s.materialId || 'IC'}`.toLowerCase();
      const chaStr = (s.cha || '').toLowerCase();
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
        shipmentIdStr.includes(colFilters.shipmentId) &&
        supplierCountryStr.includes(colFilters.supplierCountry) &&
        materialIdStr.includes(colFilters.materialId) &&
        chaStr.includes(colFilters.cha) &&
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
    padding: '0.25rem 0.4rem',
    marginTop: '0.35rem',
    fontSize: 'var(--font-size-compact)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
    fontWeight: 400,
    textTransform: 'none',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }}>
      <div className="card fade-up" style={{
        width: '95vw', height: '90vh', display: 'flex', flexDirection: 'column',
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
                  shipmentId: '',
                  supplierCountry: '',
                  materialId: '',
                  cha: '',
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

        {/* Modal Body Table */}
        <div style={{ overflow: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-body-small)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 2 }}>
                {/* 1st Col -> Sh.No */}
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Sh. No
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.shipmentId}
                    onChange={e => handleFilterChange('shipmentId', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>

                {/* 2nd Col -> Supplier Name & Country [Port of Loading] */}
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Supplier & Country [Port]
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.supplierCountry}
                    onChange={e => handleFilterChange('supplierCountry', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>

                {/* 3rd Col -> Material Name & Material ID */}
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Material Name & ID
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.materialId}
                    onChange={e => handleFilterChange('materialId', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>

                {/* 4th Col -> CHA Name */}
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  CHA Clearance Agent
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.cha}
                    onChange={e => handleFilterChange('cha', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>

                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  PO & Date
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.poDate}
                    onChange={e => handleFilterChange('poDate', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Invoice & Date
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.invoiceDate}
                    onChange={e => handleFilterChange('invoiceDate', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  BL & Date
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.blDate}
                    onChange={e => handleFilterChange('blDate', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  ETD / ETA / Arrival
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.etdEta}
                    onChange={e => handleFilterChange('etdEta', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Payment Terms
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.paymentTerms}
                    onChange={e => handleFilterChange('paymentTerms', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Due Date
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.dueDate}
                    onChange={e => handleFilterChange('dueDate', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  PRW Status
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.paymentStatus}
                    onChange={e => handleFilterChange('paymentStatus', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Material Status
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters.materialStatus}
                    onChange={e => handleFilterChange('materialStatus', e.target.value)}
                    style={inputFilterStyle}
                  />
                </th>
                <th style={{ padding: '0.625rem 0.75rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--font-size-label)', textTransform: 'uppercase' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredModalShipments.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-body)' }}>
                    {shipments.length === 0
                      ? 'No shipments match this criteria.'
                      : 'No shipments match the applied column search filters.'}
                  </td>
                </tr>
              ) : (
                filteredModalShipments.map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 1 ? 'var(--bg-secondary)' : 'transparent' }}>
                    {/* 1st Col -> Sh.No */}
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                      {s.id}
                    </td>

                    {/* 2nd Col -> Supplier Name & Country [Port of Loading] */}
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <div>{s.supplier}</div>
                      <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {s.country || '—'} {s.portOfLoading ? `[${s.portOfLoading}]` : ''}
                      </div>
                    </td>

                    {/* 3rd Col -> Material Name & Material ID */}
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      <div>{s.material || '—'}</div>
                      <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>
                        ID: {s.materialId || 'IC'}
                      </div>
                    </td>

                    {/* 4th Col -> CHA Name */}
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {s.cha || '—'}
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
                    <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                      <ActionMenu shipment={s} />
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

/* ── Interactive Calendar View ── */
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

  const dayMap = useMemo(() => {
    const map = new Map<number, { dueShipments: Shipment[]; etaShipments: Shipment[] }>();

    data.forEach(s => {
      const due = getPaymentDueDate(s);
      if (isPaymentCalendarEligible(s) && due && due.getFullYear() === year && due.getMonth() === month) {
        const day = due.getDate();
        const existing = map.get(day) || { dueShipments: [], etaShipments: [] };
        existing.dueShipments.push(s);
        map.set(day, existing);
      }

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
    <div className="card fade-up delay-2" style={{ padding: '1.125rem', minWidth: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
      <div>
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
                  minHeight: 40,
                  borderRadius: 6,
                  padding: '4px 2px',
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

                {cellData?.etaShipments && cellData.etaShipments.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 10, right: 4,
                    display: 'flex', alignItems: 'center', gap: 2, zIndex: 1,
                  }}>
                    {cellData.etaShipments.map(s => {
                      const isArrived = s.materialStatus === 'Arrived';
                      return (
                        <span
                          key={`eta-dot-${s.id}`}
                          title={`ETA Shipment ${s.id}: ${s.materialStatus}`}
                          style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: isArrived ? ACCENT.green : ACCENT.red,
                            display: 'inline-block', flexShrink: 0,
                            boxShadow: '0 0 2px rgba(0,0,0,0.3)',
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {cellData?.dueShipments && cellData.dueShipments.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {cellData.dueShipments.map(s => (
                      <div
                        key={`due-${s.id}`}
                        title={`Payment Due: ${s.paymentStatus}`}
                        style={{
                          width: 10, height: 4, borderRadius: 1,
                          background: PAYMENT_STATUS_COLOR[s.paymentStatus],
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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

/* ── Selected Date Details Modal ── */
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
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem',
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
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: 'var(--font-size-body-small)',
                color: 'var(--text-primary)', fontWeight: 800, outline: 'none', width: 80,
              }}
            />
          </div>
        </div>

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
            <YAxis width={35} allowDecimals={false} tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
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
  const [supplierPage, setSupplierPage] = useState(0);
  const pageSize = 10;

  const fullSupplierData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(s => {
      map.set(s.supplier, (map.get(s.supplier) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([supplier, count]) => ({ supplier, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const totalPages = Math.ceil(fullSupplierData.length / pageSize) || 1;

  useEffect(() => {
    if (supplierPage >= totalPages) {
      setSupplierPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, supplierPage]);

  const supplierData = useMemo(() => {
    const start = supplierPage * pageSize;
    return fullSupplierData.slice(start, start + pageSize);
  }, [fullSupplierData, supplierPage, pageSize]);

  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const activeSupplier = selectedSupplier || supplierData[0]?.supplier || fullSupplierData[0]?.supplier || '';

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
      <div className="card fade-up delay-1" style={{ padding: '1.125rem', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="section-title" style={{ margin: 0 }}>Supplier-Wise Shipments</div>
            <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>
              ({fullSupplierData.length} total)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => setSupplierPage(p => Math.max(0, p - 1))}
              disabled={supplierPage === 0}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.25rem 0.5rem',
                cursor: supplierPage === 0 ? 'not-allowed' : 'pointer',
                opacity: supplierPage === 0 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-primary)',
              }}
              title="Previous 10 suppliers"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 'var(--font-size-compact)', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {supplierPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setSupplierPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={supplierPage >= totalPages - 1}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.25rem 0.5rem',
                cursor: supplierPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: supplierPage >= totalPages - 1 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-primary)',
              }}
              title="Next 10 suppliers"
            >
              <ChevronRight size={16} />
            </button>
          </div>
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
            <XAxis dataKey="supplier" tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} interval={0} angle={-20} textAnchor="end" />
            <YAxis width={35} allowDecimals={false} tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
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

      <div className="card fade-up delay-2" style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="section-title" style={{ margin: 0 }}>Product Breakdown</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)', fontWeight: 600 }}>Supplier:</label>
            <select
              value={activeSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6,
                padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-compact)', color: 'var(--text-primary)',
                fontWeight: 700, outline: 'none', cursor: 'pointer', maxWidth: 160,
              }}
            >
              {fullSupplierData.map(s => (
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
                cx="50%" cy="50%"
                innerRadius={45} outerRadius={75}
                paddingAngle={4} dataKey="value" stroke="none"
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

/* ── REQUIREMENT 4: Material ID-Wise Shipment Count Bar Chart Component ── */
function MaterialIdWiseShipments({ data }: { data: Shipment[] }) {
  const materialIdData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(s => {
      const matId = s.materialId || 'IC';
      map.set(matId, (map.get(matId) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([materialId, count]) => ({ materialId, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div className="card fade-up delay-1" style={{ padding: '1.125rem', minWidth: 0, width: '100%', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div className="section-title" style={{ margin: 0 }}>Material ID-Wise Shipments</div>
        <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>
          ({materialIdData.length} Material IDs)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart accessibilityLayer={false} data={materialIdData} barSize={28} margin={{ top: 10, right: 10, left: 0, bottom: 15 }} style={{ outline: 'none' }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="materialId" tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} interval={0} />
          <YAxis width={35} allowDecimals={false} tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Shipments" radius={[6, 6, 0, 0]}>
            {materialIdData.map((entry, index) => (
              <Cell key={entry.materialId} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
    <div className="card fade-up delay-1" style={{ padding: '1.125rem', minWidth: 0, width: '100%', height: '100%', boxSizing: 'border-box' }}>
      <div className="section-title">Country-Wise Shipments</div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart accessibilityLayer={false} data={countryData} barSize={28} margin={{ top: 10, right: 10, left: 0, bottom: 20 }} style={{ outline: 'none' }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="country" tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} interval={0} angle={-15} textAnchor="end" />
          <YAxis width={35} allowDecimals={false} tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
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
      alignItems: 'center', justifyContent: 'space-between', minWidth: 0, width: '100%', height: '100%', boxSizing: 'border-box',
    }}>
      <div className="section-title" style={{ alignSelf: 'flex-start' }}>PRW Status</div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart style={{ outline: 'none' }}>
          <Pie data={slices} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
            {slices.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' }}>
        {slices.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-body-small)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
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

/* ── Shipments by Mode ── */
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
    <div className="card fade-up delay-1" style={{ padding: '1.125rem', minWidth: 0, width: '100%', height: '100%', boxSizing: 'border-box' }}>
      <div className="section-title">Shipments by Mode</div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart accessibilityLayer={false} data={modeData} barSize={36} barCategoryGap="40%" margin={{ top: 10, right: 10, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="mode" tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
          <YAxis width={35} allowDecimals={false} tick={{ fontSize: FONT_SIZES.chartLabel, fill: 'var(--text-muted)' }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Shipments" radius={[6, 6, 0, 0]}>
            {modeData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {modeData.map(m => (
          <div key={m.mode} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {modeIcon(m.mode, m.color)}
            <span style={{ fontSize: 'var(--font-size-body-small)', fontWeight: 700, color: 'var(--text-primary)' }}>
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

/* ── Fixed Material Status Breakdown ── */
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
    const statuses: MaterialStatus[] = ['Pending Shipment', 'In Transit', 'At Port', 'Customs Clearance', 'Arrived'];
    return statuses.map(st => ({
      status: st,
      count: map[st] || 0,
      color: MATERIAL_STATUS_COLOR[st],
      shipments: data.filter(s => s.materialStatus === st),
    }));
  }, [data]);

  // FIX: Use total shipments count as denominator so 223/240 renders ~92.9% width instead of 100%
  const totalShipmentsCount = Math.max(data.length, 1);

  return (
    <div className="card fade-up delay-2" style={{ padding: '1.125rem', minWidth: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title" style={{ margin: 0 }}>Material Status</div>
        <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>Tap status to inspect</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.75rem', flex: 1, justifyContent: 'space-around' }}>
        {statusCounts.map(s => {
          const pct = ((s.count / totalShipmentsCount) * 100).toFixed(1);
          return (
            <div
              key={s.status}
              onClick={() => onSelectStatus(s.status, s.shipments)}
              style={{ cursor: 'pointer', borderRadius: 6, padding: '5px 4px', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
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
                  <span style={{ fontSize: 'var(--font-size-body-small)', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {s.count} <span style={{ fontSize: 'var(--font-size-compact)', fontWeight: 600, color: 'var(--text-muted)' }}>({pct}%)</span>
                  </span>
                  <span style={{ fontSize: 'var(--font-size-compact)', color: ACCENT.blue }}>→</span>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${(s.count / totalShipmentsCount) * 100}%`,
                  background: s.color, transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Upcoming & Overdue Payments Table with Full Search & Column Filters ── */
function DuePaymentsTable({ data }: { data: Shipment[] }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [colFilters, setColFilters] = useState({
    shipmentId: '',
    supplier: '',
    country: '',
    poDate: '',
    invoiceDate: '',
    blDate: '',
    paymentTerms: '',
    dueDate: '',
    paymentStatus: '',
    materialStatus: '',
  });

  const pageSize = 10;

  const handleFilterChange = (col: keyof typeof colFilters, val: string) => {
    setColFilters(prev => ({ ...prev, [col]: val.toLowerCase() }));
  };

  const allRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return data
      .map(s => ({
        shipment: s,
        dueDate: getPaymentDueDate(s),
        daysLeft: getDaysUntilDue(s),
        period: getPaymentPeriod(s),
      }))
      .filter(r => r.dueDate !== null && isPaymentCalendarEligible(r.shipment))
      .filter(r => {
        const s = r.shipment;
        const shipmentIdStr = s.id.toLowerCase();
        const supplierStr = (s.supplier || '').toLowerCase();
        const countryStr = (s.country || '').toLowerCase();
        const poDateStr = `${s.poNo} ${s.poDate ? formatDMY(s.poDate) : ''}`.toLowerCase();
        const invoiceDateStr = `${s.invoiceNo} ${s.invoiceDate ? formatDMY(s.invoiceDate) : ''}`.toLowerCase();
        const blDateStr = `${s.blNo || ''} ${s.blDate ? formatDMY(s.blDate) : ''}`.toLowerCase();
        const paymentTermsStr = getPaymentTermsLabel(s).toLowerCase();
        const dueDateStr = r.dueDate ? formatDMY(r.dueDate).toLowerCase() : '';
        const paymentStatusStr = s.paymentStatus.toLowerCase();
        const materialStatusStr = s.materialStatus.toLowerCase();

        // General search bar check
        const matchesGlobal = !q || (
          shipmentIdStr.includes(q) ||
          supplierStr.includes(q) ||
          countryStr.includes(q) ||
          poDateStr.includes(q) ||
          invoiceDateStr.includes(q) ||
          blDateStr.includes(q) ||
          paymentTermsStr.includes(q) ||
          dueDateStr.includes(q) ||
          paymentStatusStr.includes(q) ||
          materialStatusStr.includes(q)
        );

        // Column-wise Excel filter check
        const matchesCol =
          shipmentIdStr.includes(colFilters.shipmentId) &&
          supplierStr.includes(colFilters.supplier) &&
          countryStr.includes(colFilters.country) &&
          poDateStr.includes(colFilters.poDate) &&
          invoiceDateStr.includes(colFilters.invoiceDate) &&
          blDateStr.includes(colFilters.blDate) &&
          paymentTermsStr.includes(colFilters.paymentTerms) &&
          dueDateStr.includes(colFilters.dueDate) &&
          paymentStatusStr.includes(colFilters.paymentStatus) &&
          materialStatusStr.includes(colFilters.materialStatus);

        return matchesGlobal && matchesCol;
      })
      .sort((a, b) => {
        if (a.daysLeft === null) return 1;
        if (b.daysLeft === null) return -1;
        return a.daysLeft - b.daysLeft;
      });
  }, [data, searchTerm, colFilters]);

  const totalPages = Math.ceil(allRows.length / pageSize) || 1;

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, currentPage]);

  const rows = useMemo(() => {
    const start = currentPage * pageSize;
    return allRows.slice(start, start + pageSize);
  }, [allRows, currentPage, pageSize]);

  const cell: React.CSSProperties = { padding: '0.55rem 0.875rem' };

  const inputFilterStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.25rem 0.4rem',
    marginTop: '0.35rem',
    fontSize: 'var(--font-size-compact)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
    fontWeight: 400,
    textTransform: 'none',
  };

  return (
    <div className="card fade-up delay-1" style={{ padding: '1.125rem' }}>
      {/* Header & Main Search Input */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="section-title" style={{ margin: 0 }}>Upcoming Due Payments</div>
          <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>
            ({allRows.length} total)
          </span>

          {/* Quick Search Input */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '0.2rem 0.5rem', minWidth: 220,
          }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search due payments..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 'var(--font-size-compact)', color: 'var(--text-primary)', width: '100%',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Pagination Arrow Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '0.25rem 0.5rem',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 0 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-primary)',
            }}
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 'var(--font-size-compact)', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '0.25rem 0.5rem',
              cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage >= totalPages - 1 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-primary)',
            }}
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-body)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Shipment ID
                <input type="text" placeholder="Filter..." value={colFilters.shipmentId} onChange={e => handleFilterChange('shipmentId', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Supplier
                <input type="text" placeholder="Filter..." value={colFilters.supplier} onChange={e => handleFilterChange('supplier', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Country
                <input type="text" placeholder="Filter..." value={colFilters.country} onChange={e => handleFilterChange('country', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                PO & Date
                <input type="text" placeholder="Filter..." value={colFilters.poDate} onChange={e => handleFilterChange('poDate', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Invoice & Date
                <input type="text" placeholder="Filter..." value={colFilters.invoiceDate} onChange={e => handleFilterChange('invoiceDate', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                BL & Date
                <input type="text" placeholder="Filter..." value={colFilters.blDate} onChange={e => handleFilterChange('blDate', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Payment Terms
                <input type="text" placeholder="Filter..." value={colFilters.paymentTerms} onChange={e => handleFilterChange('paymentTerms', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Due Date
                <input type="text" placeholder="Filter..." value={colFilters.dueDate} onChange={e => handleFilterChange('dueDate', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                PRW Status
                <input type="text" placeholder="Filter..." value={colFilters.paymentStatus} onChange={e => handleFilterChange('paymentStatus', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'left', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Material Status
                <input type="text" placeholder="Filter..." value={colFilters.materialStatus} onChange={e => handleFilterChange('materialStatus', e.target.value)} style={inputFilterStyle} />
              </th>
              <th style={{ ...cell, textAlign: 'center', fontWeight: 700, fontSize: 'var(--font-size-small)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>More</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} style={{ ...cell, textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                  No payments found matching search criteria.
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
                  <td style={{ ...cell, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: 'var(--font-size-body-small)' }}>
                    {s.id}
                  </td>
                  <td style={{ ...cell, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: 'var(--font-size-body-small)' }}>
                    {s.supplier}
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-small)' }}>
                    {s.country || '—'}
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-small)' }}>
                    <div>{s.poNo}</div>
                    <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>{s.poDate ? formatDMY(s.poDate) : '—'}</div>
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-small)' }}>
                    <div>{s.invoiceNo}</div>
                    <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>{s.invoiceDate ? formatDMY(s.invoiceDate) : '—'}</div>
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-small)' }}>
                    <div>{s.blNo || '—'}</div>
                    <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>{s.blDate ? formatDMY(s.blDate) : '—'}</div>
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-body-small)' }}>
                      {getPaymentTermsLabel(s)}
                    </div>
                  </td>
                  <td style={{ ...cell, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-small)', whiteSpace: 'nowrap' }}>
                    <div>{r.dueDate ? formatDMY(r.dueDate) : '—'}</div>
                    <span style={{
                      display: 'inline-block', marginTop: 2, padding: '2px 8px', borderRadius: 8,
                      background: `${daysColor}18`, color: daysColor,
                      fontSize: 'var(--font-size-compact)', fontWeight: 700,
                    }}>
                      {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                    </span>
                  </td>
                  <td style={cell}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 8,
                      background: `${statusColor}18`, color: statusColor,
                      fontSize: 'var(--font-size-compact)', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {s.paymentStatus}
                    </span>
                  </td>
                  <td style={cell}>
                    <span style={{
                      display: 'inline-block', padding: '3px 8px', borderRadius: 8,
                      background: `${MATERIAL_STATUS_COLOR[s.materialStatus]}18`, color: MATERIAL_STATUS_COLOR[s.materialStatus],
                      fontWeight: 800, fontSize: 'var(--font-size-tiny)',
                    }}>
                      {s.materialStatus}
                    </span>
                  </td>
                  <td style={{ ...cell, textAlign: 'center' }}>
                    <ActionMenu shipment={s} />
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
  const { shipments, ready, error } = useShipments();
  const { setNotifications } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [showShipmentsWithoutPoDate, setShowShipmentsWithoutPoDate] = useState(false);
  const [dashboardPoDateRange, setDashboardPoDateRange] = useState(() => getDefaultPoDateRange('year'));
  const financialYear = useMemo(() => getFinancialYearRange(), []);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  const [activeModal, setActiveModal] = useState<{ title: string; color: string; data: Shipment[] } | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return shipments.filter(s => {
      const matchesPoDate = hasPoDate(s.poDate)
        ? poDateMatchesRange(s.poDate, dashboardPoDateRange.startDate, dashboardPoDateRange.endDate)
        : showShipmentsWithoutPoDate;
      return matchesPoDate &&
        (!searchTerm.trim() ||
          s.supplier.toLowerCase().includes(q) ||
          s.invoiceNo.toLowerCase().includes(q) ||
          s.material.toLowerCase().includes(q) ||
          (s.materialId ?? '').toLowerCase().includes(q) ||
          s.blNo.toLowerCase().includes(q) ||
          s.poNo.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q) ||
          s.modeOfShipment.toLowerCase().includes(q) ||
          (s.otherModeDetail ?? '').toLowerCase().includes(q));
    });
  }, [shipments, searchTerm, dashboardPoDateRange, showShipmentsWithoutPoDate]);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const kpis = useMemo(() => {
    const totalList = filtered;
    const inTransitList = filtered.filter(s => s.materialStatus === 'In Transit');
    const pendingPaymentsList = filtered.filter(s => s.paymentStatus === 'NOT PAID');
    const overduePaymentsList = filtered.filter(s => isPaymentOverdue(s));

    const etdSurpassedNotTransitList = filtered.filter(s => {
      if (s.materialStatus !== 'Pending Shipment') return false;
      const etd = s.etd ? toLocalDate(s.etd) : null;
      return etd ? etd < today : false;
    });

    const etaSurpassedNotArrivedList = filtered.filter(s => {
      if (s.materialStatus === 'Arrived') return false;
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

  useEffect(() => {
    setNotifications(kpis.overduePayments, kpis.etaSurpassedNotArrived);
  }, [kpis.overduePayments, kpis.etaSurpassedNotArrived, setNotifications]);

  if (!ready) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-body)' }}>
        Loading shipments…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={{ padding: '0.75rem 1rem', borderRadius: 8, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.12)' }}>
        Shipment data could not be loaded: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <h2 style={{
            fontSize: 'var(--font-size-section-heading)', fontWeight: 800,
            color: 'var(--text-primary)', margin: 0,
          }}>
            Shipment Dashboard
          </h2>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '0.25rem 0.6rem', boxShadow: 'var(--card-shadow)',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 'var(--font-size-compact)', fontWeight: 700 }}>
              From:
              <input
                type="date"
                aria-label="Dashboard PO date from"
                value={dashboardPoDateRange.startDate}
                max={dashboardPoDateRange.endDate || undefined}
                onChange={(event) => setDashboardPoDateRange((range) => ({ ...range, startDate: event.target.value }))}
                style={{ height: 28, padding: '0.15rem 0.4rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit', fontSize: 'var(--font-size-compact)' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 'var(--font-size-compact)', fontWeight: 700 }}>
              To:
              <input
                type="date"
                aria-label="Dashboard PO date to"
                value={dashboardPoDateRange.endDate}
                min={dashboardPoDateRange.startDate || undefined}
                onChange={(event) => setDashboardPoDateRange((range) => ({ ...range, endDate: event.target.value }))}
                style={{ height: 28, padding: '0.15rem 0.4rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit', fontSize: 'var(--font-size-compact)' }}
              />
            </label>
            <button
              type="button"
              onClick={() => setDashboardPoDateRange({ startDate: '', endDate: '' })}
              style={{ height: 28, padding: '0.15rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit', fontSize: 'var(--font-size-compact)', fontWeight: 700, cursor: 'pointer' }}
            >
              All dates
            </button>
            <button
              type="button"
              onClick={() => setDashboardPoDateRange(getDefaultPoDateRange('year'))}
              style={{ height: 28, padding: '0.15rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', font: 'inherit', fontSize: 'var(--font-size-compact)', fontWeight: 700, cursor: 'pointer' }}
            >
              This financial year
            </button>
            
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Link href="/shipments?tab=history" style={{ textDecoration: 'none' }}>
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
              History
            </button>
          </Link>
          <Link href="/shipments" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.5rem 1rem', borderRadius: 8,
              background: ACCENT.blue, color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: 'var(--font-size-body-small)', fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow: `0 2px 8px ${ACCENT.blue}40`,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}>
              <Plus size={15} />
              New Entry
            </button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="fade-up" style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '0.45rem 0.875rem',
        boxShadow: 'var(--card-shadow)', marginBottom: '0.25rem',
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
        <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* REQUIREMENT 1 FIX: KPI Cards using kpis.total.length as total denominator */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
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
          onClick={() => setActiveModal({ title: 'ETA Passed – Not Arrived', color: ACCENT.orange, data: kpis.etaSurpassedNotArrived })}
        />
      </div>

      {activeModal && (
        <ShipmentListModal
          title={activeModal.title}
          shipments={activeModal.data}
          color={activeModal.color}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Analytics Rows - Row 2 height-stretched cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem', alignItems: 'stretch' }}>
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

      {selectedCalendarDate && (
        <DatePaymentDetails
          selectedDate={selectedCalendarDate}
          data={filtered}
          onClose={() => setSelectedCalendarDate(null)}
        />
      )}

      <MonthlyPoAndPaymentAnalytics
        data={filtered}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
      />

      <SupplierAndProductAnalytics data={filtered} />

      {/* REQUIREMENT 4: 5th Row containing Material ID-Wise Shipment Count Bar Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
        <ShipmentsByMode data={filtered} />
        <MaterialIdWiseShipments data={filtered} />
        <ShipmentsByCountry data={filtered} />
      </div>

      <DuePaymentsTable data={filtered} />
    </div>
  );
}