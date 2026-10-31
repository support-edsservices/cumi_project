'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Shipment } from '@/types/shipment';
import { formatDMY, getPaymentDueDate, getPaymentTermsLabel, getModeLabel } from '@/data/shipmentData';

const ACCENT = {
  blue: '#3b82f6',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  teal: '#06b6d4',
} as const;

const PAYMENT_STATUS_COLOR: Record<import('@/types/shipment').PaymentStatus, string> = {
  PAID: ACCENT.green,
  'NOT PAID': ACCENT.red,
  PARTIAL: ACCENT.orange,
  ADVANCE: ACCENT.blue,
  '2 WAY': ACCENT.purple,
  'SR DATE': ACCENT.teal,
};

const MATERIAL_STATUS_COLOR: Record<import('@/types/shipment').MaterialStatus, string> = {
  'In Transit': ACCENT.blue,
  'At Port': ACCENT.orange,
  'Customs Clearance': ACCENT.purple,
  Arrived: ACCENT.green,
  'Pending Shipment': ACCENT.teal,
};

interface ShipmentDetailModalProps {
  shipment: Shipment;
  onClose: () => void;
}

export default function ShipmentDetailModal({ shipment, onClose }: ShipmentDetailModalProps) {
  const dueDate = getPaymentDueDate(shipment);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }} onClick={onClose}>
      <div
        className="card fade-up"
        style={{
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          padding: '1.5rem',
          borderRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Shipment Details
            </h3>
            <span style={{ fontSize: 'var(--font-size-body-small)', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
              {shipment.id}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', padding: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Shipment Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Basic Info */}
          <div style={{
            padding: '1rem', background: 'var(--bg-secondary)',
            borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 'var(--font-size-label)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Basic Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: 'var(--font-size-body-small)' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Supplier:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.supplier}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Country:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.country}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>PO No:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.poNo}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>PO Date:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.poDate ? formatDMY(shipment.poDate) : 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Material:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.material}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Mode:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{getModeLabel(shipment)}</div>
              </div>
            </div>
          </div>

          {/* Invoice & BL Info */}
          <div style={{
            padding: '1rem', background: 'var(--bg-secondary)',
            borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 'var(--font-size-label)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Invoice & BL Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: 'var(--font-size-body-small)' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Invoice No:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.invoiceNo}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Invoice Date:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.invoiceDate ? formatDMY(shipment.invoiceDate) : 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>BL No:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.blNo}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>BL Date:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.blDate ? formatDMY(shipment.blDate) : 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Port of Loading:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.portOfLoading}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Port of Landing:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.portOfLanding || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div style={{
            padding: '1rem', background: 'var(--bg-secondary)',
            borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 'var(--font-size-label)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Payment Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: 'var(--font-size-body-small)' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Payment Status:</span>
                <div style={{
                  fontWeight: 600, color: PAYMENT_STATUS_COLOR[shipment.paymentStatus],
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                  background: `${PAYMENT_STATUS_COLOR[shipment.paymentStatus]}20`,
                }}>
                  {shipment.paymentStatus}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Payment Type:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.paymentType}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Payment Terms:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{getPaymentTermsLabel(shipment)}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Due Date:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dueDate ? formatDMY(dueDate) : 'N/A'}</div>
              </div>
              {shipment.paymentType === 'LC' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Bank Reference No:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.bankReferenceNo || 'N/A'}</div>
                </div>
              )}
            </div>
          </div>

          {/* Material Status */}
          <div style={{
            padding: '1rem', background: 'var(--bg-secondary)',
            borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 'var(--font-size-label)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Material Status
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: 'var(--font-size-body-small)' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <div style={{
                  fontWeight: 600, color: MATERIAL_STATUS_COLOR[shipment.materialStatus],
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                  background: `${MATERIAL_STATUS_COLOR[shipment.materialStatus]}20`,
                }}>
                  {shipment.materialStatus}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>ETD:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.etd ? formatDMY(shipment.etd) : 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>ETA:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.eta ? formatDMY(shipment.eta) : 'N/A'}</div>
              </div>
              {shipment.materialStatus === 'Arrived' && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Arrived Date:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.arrivedDate ? formatDMY(shipment.arrivedDate) : 'N/A'}</div>
                </div>
              )}
              {shipment.warehouseName && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Warehouse:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shipment.warehouseName}</div>
                </div>
              )}
            </div>
          </div>

          {/* Document Links */}
          <div style={{
            padding: '1rem', background: 'var(--bg-secondary)',
            borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 'var(--font-size-label)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Documents
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {shipment.poDocument && (
                <a
                  href={shipment.poDocument.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 'var(--font-size-body-small)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  PO
                </a>
              )}
              {shipment.invoiceDocument && (
                <a
                  href={shipment.invoiceDocument.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 'var(--font-size-body-small)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Invoice
                </a>
              )}
              {shipment.blDocument && (
                <a
                  href={shipment.blDocument.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 'var(--font-size-body-small)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  BL
                </a>
              )}
              {shipment.mawbDocument && (
                <a
                  href={shipment.mawbDocument.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 'var(--font-size-body-small)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  MAWB
                </a>
              )}
              {shipment.hawbDocument && (
                <a
                  href={shipment.hawbDocument.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 'var(--font-size-body-small)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  HAWB
                </a>
              )}
              {shipment.boeDocument && (
                <a
                  href={shipment.boeDocument.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 'var(--font-size-body-small)',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  BOE
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
