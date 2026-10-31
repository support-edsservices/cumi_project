/* ─────────────────────────────────────────────────────────────────────────────
   shipmentData.ts – Seed data and helper functions for import shipments.
   Fully supports:
   - Mode of Shipment: selected from shipment mode master data
   - Payment Types: LC (bank ref mandatory) vs Others (credit days from Invoice/BL/PO date)
   - Dynamic due date calculation from custom credit days & base date
   - Material statuses with Arrived date or ETD/ETA
   - Helpers: formatDMY, formatEtdEta, getPaymentDueDate, getDaysUntilDue,
              getModeLabel, getPaymentPeriod, getPaymentTermsLabel, isPaymentOverdue,
              addDaysToISO, getPaymentBaseISO, getDocumentRemark, nextShipmentId, toISODate
───────────────────────────────────────────────────────────────────────────── */

import { Shipment, ShipmentMode, DocumentStatus, MaterialStatus, PaymentStatus } from '../types/shipment';

export const PAYMENT_TERM_OPTIONS = [
  '2 Way',
  '15 Days from Date of Invoice',
  '20% Advance Against PI & Balance 80% Against Documents Through Bank 30 Days from Bill of Lading',
  '30 Days from Date of Invoice',
  '30 Days from BL',
  '50% Advance Against Proforma Invoice and 50% Before Dispatch',
  '50% Advance + 40% Before Shipment + 10% T/T within 1 Month after Delivery',
  '60 Days from BL',
  '90 Days from BL',
  '90 Days from Invoice Date',
  '100% Against PI',
  '100% Against Proforma Invoice',
  '100% Against Your Proforma Invoice',
  '100% Against Delivery',
  '100% Against Dispatch Documents',
  '100% Proforma Invoice',
  '100% Advance',
  '100% In Advance',
  '100% Payment in Advance',
  '30% Advance Payment by T/T, 70% T/T Before Loading',
  'LC',
  'No Payment',
  'Service',
  'Sample',
  'Free Sample',
] as const;

/* ─── Seed Data ─── */
export const shipmentData: Shipment[] = [
  {
    id: 'SHP-001',
    supplier: 'Bosch GmbH',
    poNo: 'PO/2026/04-0187',
    poDate: '2026-06-05',
    poDocument: { name: 'PO_04_0187_Signed.pdf', url: '#', type: 'pdf' },
    material: 'Hydraulic Actuators',
    invoiceNo: 'INV-BOSCH-2026-0412',
    invoiceDate: '2026-06-10',
    invoiceDocument: { name: 'INV_BOSCH_0412.pdf', url: '#', type: 'pdf' },
    portOfLoading: 'Hamburg, Germany',
    blNo: 'MAEU726491835',
    blDate: '2026-06-15',
    blDocument: { name: 'BL_MAEU726491835.pdf', url: '#', type: 'pdf' },
    mawb: '',
    hawb: '',
    cha: 'Kuehne + Nagel India',
    documentStatus: 'Completed',
    modeOfShipment: 'Sea',
    boeNo: 'BOE/2026/3847291',
    boeDate: '2026-07-22',
    boeDocument: { name: 'BOE_3847291_Stamped.pdf', url: '#', type: 'pdf' },
    country: 'Germany',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'BL Date',
    paymentStatus: 'PAID',
    bankReferenceNo: 'ICICI/FX/2026/08142',
    materialStatus: 'Arrived',
    arrivedDate: '2026-07-20',
    etd: '2026-06-15',
    eta: '2026-07-18',
    link: 'https://docs.cumi.internal/shipments/SHP-001.pdf',
    leadTime: 45,
    createdAt: '2026-06-05',
  },
  {
    id: 'SHP-002',
    supplier: 'Siemens AG',
    poNo: 'PO/2026/05-0203',
    poDate: '2026-06-25',
    material: 'PLC Controllers S7-1500',
    invoiceNo: 'INV-SIE-2026-07831',
    invoiceDate: '2026-07-01',
    portOfLoading: 'Bremerhaven, Germany',
    blNo: 'HLCU835720194',
    blDate: '2026-07-05',
    mawb: '',
    hawb: '',
    cha: 'DHL Global Forwarding',
    documentStatus: 'Completed',
    modeOfShipment: 'Sea',
    boeNo: 'BOE/2026/4012836',
    boeDate: '2026-08-12',
    country: 'Germany',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'BL Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'Arrived',
    arrivedDate: '2026-08-10',
    etd: '2026-07-05',
    eta: '2026-08-08',
    link: 'https://docs.cumi.internal/shipments/SHP-002.pdf',
    leadTime: 38,
    createdAt: '2026-06-25',
  },
  {
    id: 'SHP-003',
    supplier: 'ABB Ltd',
    poNo: 'PO/2026/05-0219',
    poDate: '2026-07-10',
    material: 'Variable Frequency Drives',
    invoiceNo: 'INV-ABB-2026-5521',
    invoiceDate: '2026-07-15',
    portOfLoading: 'Zurich Airport, Switzerland',
    blNo: '',
    blDate: '',
    mawb: '724-48291056',
    hawb: 'HWB-2026-003',
    cha: 'Expeditors India',
    documentStatus: 'Completed',
    modeOfShipment: 'Air',
    boeNo: 'BOE/2026/4185723',
    boeDate: '2026-07-23',
    country: 'Switzerland',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'Invoice Date',
    paymentStatus: 'PAID',
    bankReferenceNo: 'SBI/FX/2026/09285',
    materialStatus: 'Arrived',
    arrivedDate: '2026-07-24',
    etd: '2026-07-18',
    eta: '2026-07-22',
    link: 'https://docs.cumi.internal/shipments/SHP-003.pdf',
    leadTime: 30,
    createdAt: '2026-07-10',
  },
  {
    id: 'SHP-004',
    supplier: 'Schneider Electric',
    poNo: 'PO/2026/06-0241',
    poDate: '2026-07-14',
    material: 'Circuit Breakers & Switchgear',
    invoiceNo: 'INV-SCH-2026-3345',
    invoiceDate: '2026-07-20',
    portOfLoading: 'Le Havre, France',
    blNo: 'CMAU491028376',
    blDate: '2026-07-25',
    mawb: '',
    hawb: '',
    cha: 'DB Schenker India',
    documentStatus: 'Completed',
    modeOfShipment: 'Sea',
    boeNo: 'BOE/2026/4293018',
    boeDate: '2026-08-30',
    country: 'France',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'BL Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'Arrived',
    arrivedDate: '2026-08-28',
    etd: '2026-07-25',
    eta: '2026-08-27',
    link: 'https://docs.cumi.internal/shipments/SHP-004.pdf',
    leadTime: 40,
    createdAt: '2026-07-14',
  },
  {
    id: 'SHP-005',
    supplier: 'Mitsubishi Electric',
    poNo: 'PO/2026/06-0258',
    poDate: '2026-07-28',
    material: 'Servo Motors & Amplifiers',
    invoiceNo: 'INV-MIT-2026-8812',
    invoiceDate: '2026-08-01',
    portOfLoading: 'Yokohama, Japan',
    blNo: 'ONEU582047193',
    blDate: '2026-08-05',
    mawb: '',
    hawb: '',
    cha: 'Nippon Express India',
    documentStatus: 'Completed',
    modeOfShipment: 'Sea',
    boeNo: 'BOE/2026/4510294',
    boeDate: '2026-09-08',
    country: 'Japan',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'BL Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'Arrived',
    arrivedDate: '2026-09-06',
    etd: '2026-08-05',
    eta: '2026-09-05',
    link: 'https://docs.cumi.internal/shipments/SHP-005.pdf',
    leadTime: 35,
    createdAt: '2026-07-28',
  },
  {
    id: 'SHP-006',
    supplier: 'Honeywell International',
    poNo: 'PO/2026/07-0275',
    poDate: '2026-08-03',
    material: 'Industrial Sensors & Transmitters',
    invoiceNo: 'INV-HON-2026-4490',
    invoiceDate: '2026-08-10',
    portOfLoading: 'JFK Airport, USA',
    blNo: '',
    blDate: '',
    mawb: '176-93021487',
    hawb: 'HWB-2026-006',
    cha: 'FedEx Trade Networks',
    documentStatus: 'Completed',
    modeOfShipment: 'Air',
    boeNo: 'BOE/2026/4628501',
    boeDate: '2026-08-18',
    country: 'United States',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'Invoice Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'Arrived',
    arrivedDate: '2026-08-19',
    etd: '2026-08-13',
    eta: '2026-08-17',
    link: 'https://docs.cumi.internal/shipments/SHP-006.pdf',
    leadTime: 32,
    createdAt: '2026-08-03',
  },
  {
    id: 'SHP-007',
    supplier: 'Fanuc Corporation',
    poNo: 'PO/2026/07-0289',
    poDate: '2026-08-15',
    material: 'CNC Controller Units',
    invoiceNo: 'INV-FAN-2026-1184',
    invoiceDate: '2026-08-20',
    portOfLoading: 'Tokyo Port, Japan',
    blNo: 'NYKU891024653',
    blDate: '2026-08-25',
    mawb: '',
    hawb: '',
    cha: 'Kintetsu World Express',
    documentStatus: 'In Process',
    modeOfShipment: 'Sea',
    boeNo: 'BOE/2026/4789123',
    boeDate: '2026-09-28',
    country: 'Japan',
    paymentType: 'LC',
    creditDays: null,
    creditDaysFrom: null,
    paymentStatus: 'PAID',
    bankReferenceNo: 'HDFC/LC/2026/07231',
    materialStatus: 'Arrived',
    arrivedDate: '2026-09-26',
    etd: '2026-08-25',
    eta: '2026-09-25',
    link: 'https://docs.cumi.internal/shipments/SHP-007.pdf',
    leadTime: 42,
    createdAt: '2026-08-15',
  },
  {
    id: 'SHP-008',
    supplier: 'Emerson Electric Co.',
    poNo: 'PO/2026/08-0302',
    poDate: '2026-08-22',
    material: 'Flowmeters & Control Valves',
    invoiceNo: 'INV-EME-2026-7723',
    invoiceDate: '2026-08-28',
    portOfLoading: 'Houston, USA',
    blNo: 'MSCU719304825',
    blDate: '2026-09-02',
    mawb: '',
    hawb: '',
    cha: 'Panalpina World Transport',
    documentStatus: 'In Process',
    modeOfShipment: 'Sea',
    boeNo: 'BOE/2026/4901234',
    boeDate: '2026-10-10',
    country: 'United States',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'BL Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'At Port',
    arrivedDate: undefined,
    etd: '2026-09-02',
    eta: '2026-10-08',
    link: 'https://docs.cumi.internal/shipments/SHP-008.pdf',
    leadTime: 48,
    createdAt: '2026-08-22',
  },
  {
    id: 'SHP-009',
    supplier: 'Rockwell Automation',
    poNo: 'PO/2026/08-0318',
    poDate: '2026-08-28',
    material: 'Allen-Bradley I/O Modules',
    invoiceNo: 'INV-ROC-2026-9201',
    invoiceDate: '2026-09-05',
    portOfLoading: 'Chicago, USA',
    blNo: 'OOCU481920375',
    blDate: '2026-09-10',
    mawb: '',
    hawb: '',
    cha: 'Ceva Logistics India',
    documentStatus: 'In Process',
    modeOfShipment: 'Multimodal Rail-Sea',
    boeNo: 'BOE/2026/5012345',
    boeDate: '2026-10-14',
    country: 'United States',
    paymentType: 'Others',
    creditDays: 45,
    creditDaysFrom: 'PO Date',
    paymentStatus: 'PARTIAL',
    bankReferenceNo: '',
    materialStatus: 'Customs Clearance',
    arrivedDate: undefined,
    etd: '2026-09-10',
    eta: '2026-10-12',
    link: 'https://docs.cumi.internal/shipments/SHP-009.pdf',
    leadTime: 50,
    createdAt: '2026-08-28',
  },
  {
    id: 'SHP-010',
    supplier: 'KUKA Robotics GmbH',
    poNo: 'PO/2026/08-0335',
    poDate: '2026-09-02',
    material: 'Industrial Robot Arm Components',
    invoiceNo: 'INV-KUK-2026-6641',
    invoiceDate: '2026-09-12',
    portOfLoading: 'Munich Airport, Germany',
    blNo: '',
    blDate: '',
    mawb: '020-49102847',
    hawb: 'HWB-2026-010',
    cha: 'DHL Global Forwarding',
    documentStatus: 'Received',
    modeOfShipment: 'Air',
    boeNo: 'BOE/2026/5123456',
    boeDate: '2026-09-22',
    country: 'Germany',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'Invoice Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'At Port',
    arrivedDate: undefined,
    etd: '2026-09-15',
    eta: '2026-09-20',
    link: 'https://docs.cumi.internal/shipments/SHP-010.pdf',
    leadTime: 28,
    createdAt: '2026-09-02',
  },
  {
    id: 'SHP-011',
    supplier: 'Yokogawa Electric Corp',
    poNo: 'PO/2026/09-0349',
    poDate: '2026-09-10',
    material: 'DCS Controller Modules',
    invoiceNo: 'INV-YOK-2026-3829',
    invoiceDate: '2026-09-18',
    portOfLoading: 'Kobe, Japan',
    blNo: 'EGLV920184736',
    blDate: '2026-09-25',
    mawb: '',
    hawb: '',
    cha: 'Yusen Logistics India',
    documentStatus: 'Received',
    modeOfShipment: 'Sea',
    boeNo: '',
    boeDate: '',
    country: 'Japan',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'BL Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'In Transit',
    arrivedDate: undefined,
    etd: '2026-09-25',
    eta: '2026-10-28',
    link: 'https://docs.cumi.internal/shipments/SHP-011.pdf',
    leadTime: 40,
    createdAt: '2026-09-10',
  },
  {
    id: 'SHP-012',
    supplier: 'Endress+Hauser AG',
    poNo: 'PO/2026/09-0362',
    poDate: '2026-09-18',
    material: 'Level & Pressure Transmitters',
    invoiceNo: 'INV-EH-2026-5102',
    invoiceDate: '2026-09-25',
    portOfLoading: 'Zurich Airport, Switzerland',
    blNo: '',
    blDate: '',
    mawb: '724-67834921',
    hawb: 'HWB-2026-012',
    cha: 'Expeditors India',
    documentStatus: 'Received',
    modeOfShipment: 'Air',
    boeNo: '',
    boeDate: '',
    country: 'Switzerland',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'Invoice Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'Customs Clearance',
    arrivedDate: undefined,
    etd: '2026-09-28',
    eta: '2026-10-02',
    link: 'https://docs.cumi.internal/shipments/SHP-012.pdf',
    leadTime: 35,
    createdAt: '2026-09-18',
  },
  {
    id: 'SHP-013',
    supplier: 'Festo SE',
    poNo: 'PO/2026/09-0378',
    poDate: '2026-09-25',
    material: 'Pneumatic Cylinders & Valves',
    invoiceNo: 'INV-FES-2026-3389',
    invoiceDate: '2026-10-01',
    portOfLoading: 'Rotterdam, Netherlands',
    blNo: 'MAEU918240563',
    blDate: '2026-10-05',
    mawb: '',
    hawb: '',
    cha: 'DB Schenker India',
    documentStatus: 'Pending',
    modeOfShipment: 'Sea',
    boeNo: '',
    boeDate: '',
    country: 'Germany',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'BL Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'In Transit',
    arrivedDate: undefined,
    etd: '2026-10-05',
    eta: '2026-11-08',
    link: 'https://docs.cumi.internal/shipments/SHP-013.pdf',
    leadTime: 55,
    createdAt: '2026-09-25',
  },
  {
    id: 'SHP-014',
    supplier: 'Phoenix Contact',
    poNo: 'PO/2026/10-0395',
    poDate: '2026-10-05',
    material: 'Terminal Blocks & Connectors',
    invoiceNo: 'INV-PHX-2026-9047',
    invoiceDate: '2026-10-10',
    portOfLoading: 'Frankfurt Airport, Germany',
    blNo: '',
    blDate: '',
    mawb: '020-85192734',
    hawb: 'HWB-2026-014',
    cha: 'DHL Global Forwarding',
    documentStatus: 'Pending',
    modeOfShipment: 'Air',
    boeNo: '',
    boeDate: '',
    country: 'Germany',
    paymentType: 'LC',
    creditDays: null,
    creditDaysFrom: null,
    paymentStatus: 'PAID',
    bankReferenceNo: 'HDFC/LC/2026/14521',
    materialStatus: 'Pending Shipment',
    arrivedDate: undefined,
    etd: '2026-10-20',
    eta: '2026-10-25',
    link: 'https://docs.cumi.internal/shipments/SHP-014.pdf',
    leadTime: 30,
    createdAt: '2026-10-05',
  },
  {
    id: 'SHP-015',
    supplier: 'Danfoss A/S',
    poNo: 'PO/2026/10-0412',
    poDate: '2026-10-08',
    material: 'Hydraulic Power Units',
    invoiceNo: 'INV-DAN-2026-6215',
    invoiceDate: '2026-10-15',
    portOfLoading: 'Aarhus, Denmark',
    blNo: 'MAEU204859173',
    blDate: '2026-10-20',
    mawb: '',
    hawb: '',
    cha: 'Kuehne + Nagel India',
    documentStatus: 'Pending',
    modeOfShipment: 'Sea',
    boeNo: '',
    boeDate: '',
    country: 'Denmark',
    paymentType: 'Others',
    creditDays: 60,
    creditDaysFrom: 'BL Date',
    paymentStatus: 'NOT PAID',
    bankReferenceNo: '',
    materialStatus: 'Pending Shipment',
    arrivedDate: undefined,
    etd: '2026-10-20',
    eta: '2026-11-22',
    link: 'https://docs.cumi.internal/shipments/SHP-015.pdf',
    leadTime: 55,
    createdAt: '2026-10-08',
  },
];

/* ─── Date and Label Helpers ─── */

/** Formats ISO string (YYYY-MM-DD) or Date object into DD/MM/YYYY */
export function formatDMY(d: string | Date | undefined | null): string {
  if (!d) return '';
  if (typeof d === 'string') {
    if (d.includes('_')) {
      return d.split('_').map((part) => part ? formatDMY(part) : '?').join('_');
    }
    // If it's already an ISO string YYYY-MM-DD
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Formats Date object into YYYY-MM-DD string */
export function toISODate(d: Date | string | undefined | null): string {
  if (!d) return '';
  if (typeof d === 'string') return d.split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultPoDateRange(period: 'month' | 'year'): { startDate: string; endDate: string } {
  const now = new Date();
  const start = period === 'month'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), 0, 1);
  return { startDate: toISODate(start), endDate: toISODate(now) };
}

export function poDateMatchesRange(
  poDate: string | null | undefined,
  startDate: string,
  endDate: string,
): boolean {
  if (!startDate && !endDate) return true;
  if (!poDate) return false;

  return poDate.split('_').some((value) => {
    const raw = value.trim();
    const isoDate = /^(\d{4}-\d{2}-\d{2})/.exec(raw)?.[1]
      ?? (/^(\d{2})-(\d{2})-(\d{4})$/.exec(raw)
        ? `${raw.slice(6, 10)}-${raw.slice(3, 5)}-${raw.slice(0, 2)}`
        : '');
    return Boolean(isoDate) && (!startDate || isoDate >= startDate) && (!endDate || isoDate <= endDate);
  });
}

/** Adds N days to an ISO date string (YYYY-MM-DD) and returns new YYYY-MM-DD */
export function addDaysToISO(isoDate: string | undefined | null, days: number): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Returns the display label for Mode of Shipment */
export function getModeLabel(s: { modeOfShipment: ShipmentMode; otherModeDetail?: string }): string {
  return s.modeOfShipment;
}

/**
 * Returns the base ISO date string used for credit-day calculations.
 */
export function getPaymentBaseISO(s: {
  creditDaysFrom?: string | null;
  paymentTerms?: string;
  invoiceDate?: string;
  proformaInvoiceDate?: string;
  blDate?: string;
  poDate?: string;
}): string {
  const creditDaysFrom = s.creditDaysFrom ?? getPaymentTermRule(s.paymentTerms)?.from;
  if (!creditDaysFrom) return '';
  if (creditDaysFrom === 'Invoice Date') return s.invoiceDate?.split('_')[0] || '';
  if (creditDaysFrom === 'Proforma Invoice Date') return s.proformaInvoiceDate?.split('_')[0] || '';
  if (creditDaysFrom === 'BL Date') return s.blDate?.split('_')[0] || '';
  if (creditDaysFrom === 'PO Date') return s.poDate?.split('_')[0] || '';
  return '';
}

type PaymentDateBasis = 'BL Date' | 'Invoice Date' | 'PO Date' | 'Proforma Invoice Date';

function getPaymentTermRule(terms?: string): { days: number; from: PaymentDateBasis } | null {
  const proformaDays = terms?.match(
    /\b(\d+)\s*days?\s+(?:from|after)\s+(?:the\s+)?(?:pro\s*forma|per\s*forma)\s+invoice\b/i,
  );
  if (proformaDays) {
    return { days: Number(proformaDays[1]), from: 'Proforma Invoice Date' };
  }
  if (/\b(?:pro\s*forma|per\s*forma)\s+invoice\b/i.test(terms ?? '')) {
    return { days: 0, from: 'Proforma Invoice Date' };
  }

  const match = terms?.match(/\b(\d+)\s*days?\s+from\s+(?:the\s+)?(?:(?:date\s+of\s+)?(invoice)|(bill\s+of\s+lading|bl)|(po))\b/i);
  if (!match) return null;
  const days = Number(match[1]);
  if (!Number.isInteger(days) || days <= 0) return null;
  const dateBasis = match[2]?.toLowerCase();
  const from = dateBasis
    ? 'Invoice Date'
    : match[3]
      ? 'BL Date'
      : 'PO Date';
  return { days, from };
}

export function getPaymentTermDateBasis(terms?: string): PaymentDateBasis | null {
  return getPaymentTermRule(terms)?.from ?? null;
}

/**
 * Calculates the payment due date as a Date object.
 * If paymentType is 'LC', there is no credit-day calculation (returns null).
 * If creditDays and creditDaysFrom are set, computes: baseDate + creditDays.
 * Date-based payment-term presets are also calculated from their named date.
 * Supports backward-compatibility for legacy records if present.
 */
export function getPaymentDueDate(s: any): Date | null {
  if (!s) return null;

  // New schema: paymentType 'LC' has no due date
  if (s.paymentType === 'LC') return null;

  // Day-based payment terms:
  if (s.creditDays != null && s.creditDaysFrom) {
    const baseISO = getPaymentBaseISO(s);
    if (!baseISO) return null;
    const dueISO = addDaysToISO(baseISO, Number(s.creditDays));
    return dueISO ? new Date(dueISO) : null;
  }

  const termRule = getPaymentTermRule(s.paymentTerms);
  if (termRule) {
    const baseISO = getPaymentBaseISO({ ...s, creditDaysFrom: termRule.from });
    const dueISO = baseISO ? addDaysToISO(baseISO, termRule.days) : null;
    return dueISO ? new Date(dueISO) : null;
  }

  // Legacy fallback if old paymentTerms property exists
  if (typeof s.paymentTerms === 'string') {
    if (s.paymentTerms === '60 Days from BL' && s.blDate) {
      return new Date(addDaysToISO(s.blDate, 60) || '');
    }
    if (s.paymentTerms === '60 Days from Invoice' && s.invoiceDate) {
      return new Date(addDaysToISO(s.invoiceDate, 60) || '');
    }
  }

  return null;
}

/**
 * Returns the payment period range ({ from: Date, to: Date })
 * E.g., from PO Date to Due Date, or BL Date to Due Date.
 */
export function getPaymentPeriod(s: any): { from: Date; to: Date } | null {
  const due = getPaymentDueDate(s);
  if (!due) return null;
  const baseISO = getPaymentBaseISO(s);
  if (!baseISO) return null;
  return {
    from: new Date(baseISO),
    to: due,
  };
}

/** Returns a clean user-facing label for the payment terms */
export function getPaymentTermsLabel(s: any): string {
  if (typeof s.paymentTerms === 'string' && s.paymentTerms.trim()) {
    return s.paymentTerms;
  }
  if (s.paymentType === 'LC') {
    return 'LC (Letter of Credit)';
  }
  if (s.creditDays != null && s.creditDaysFrom) {
    return `${s.creditDays} days from ${s.creditDaysFrom}`;
  }
  if (typeof s.paymentTerms === 'string') {
    return s.paymentTerms;
  }
  return 'Standard Payment';
}

/** Checks if a shipment's payment is overdue */
export function isPaymentOverdue(s: any): boolean {
  if (s.paymentStatus !== 'NOT PAID') return false;
  const due = getPaymentDueDate(s);
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export function isPaymentCalendarEligible(s: Pick<Shipment, 'paymentStatus'>): boolean {
  return s.paymentStatus === 'PAID' || s.paymentStatus === 'NOT PAID';
}

/** Returns the number of days until due (negative if overdue) */
export function getDaysUntilDue(s: any): number | null {
  const due = getPaymentDueDate(s);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Formats ETD vs ETA string (e.g. "ETD : 03/07/2026 - ETA : 02/08/2026" or "ETD : 17/07/2026 - ETA : ?") */
export function formatEtdEta(s: { etd?: string; eta?: string }): string {
  const etdStr = s.etd ? formatDMY(s.etd) : '?';
  const etaStr = s.eta ? formatDMY(s.eta) : '?';
  return `ETD : ${etdStr} - ETA : ${etaStr}`;
}

/** Returns document remark note for ETD/ETA */
export function getDocumentRemark(status?: DocumentStatus): string {
  if (status === 'Pending') return 'Yet to receive documents';
  if (status === 'In Process') return 'Documents in process';
  if (status === 'Received') return 'Documents received';
  if (status === 'Completed') return 'Clearance completed';
  return '';
}

/** Generates the next sequential shipment ID based on existing records */
export function nextShipmentId(records: Shipment[]): string {
  let maxNum = 0;
  for (const r of records) {
    const m = r.id.match(/SHP-(\d+)/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `SHP-${String(maxNum + 1).padStart(3, '0')}`;
}

/** Groups shipments by due date string (YYYY-MM-DD) */
export function getShipmentsByDueDate(): Map<string, Shipment[]> {
  const map = new Map<string, Shipment[]>();
  for (const shipment of shipmentData) {
    const dueDate = getPaymentDueDate(shipment);
    if (!dueDate) continue;
    const key = toISODate(dueDate);
    const existing = map.get(key) || [];
    existing.push(shipment);
    map.set(key, existing);
  }
  return map;
}
