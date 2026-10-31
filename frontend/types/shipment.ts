/* ─────────────────────────────────────────────────────────────────────────────
   Shipment types
   NOTE: rebuilt from how the pages use them. If your existing types file has
   extra exports, merge them in rather than deleting them.
───────────────────────────────────────────────────────────────────────────── */

/** Shipment modes are maintained as master data. */
export type ShipmentMode = string;

/** LC needs a bank reference number. Everything else does not. */
export type PaymentType = 'LC' | 'Others';

/** Which date the credit days are counted from. */
export type CreditDaysFrom =
  | 'Invoice Date'
  | 'BL Date'
  | 'PO Date'
  | 'Receipt Date'
  | 'Proforma Invoice Date';

export type PaymentStatus = 'PAID' | 'NOT PAID' | 'PARTIAL' | 'ADVANCE' | '2 WAY' | 'SR DATE';
export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'PAID',
  'NOT PAID',
  'ADVANCE',
  '2 WAY',
  'PARTIAL',
  'SR DATE',
];
export type DocumentStatus = 'Pending' | 'Received' | 'In Process' | 'Completed';
export type MaterialStatus =
  | 'Pending Shipment'
  | 'In Transit'
  | 'At Port'
  | 'Customs Clearance'
  | 'Arrived';

export interface ShipmentDocument {
  name: string;
  url: string;
  type: string;
  id?: number;
}

export interface Shipment {
  id: string;

  supplier: string;
  poNo: string;
  poDate?: string; // YYYY-MM-DD
  poDocument?: ShipmentDocument;

  material: string;

  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD or ''
  invoiceDocument?: ShipmentDocument;
  proformaInvoiceNo?: string;
  proformaInvoiceDate?: string;

  portOfLoading: string;
  portOfLanding?: string;
  blNo: string;
  blDate: string; // YYYY-MM-DD or ''
  blDocument?: ShipmentDocument;
  mawb: string;
  mawbDocument?: ShipmentDocument;
  hawb: string;
  hawbDocument?: ShipmentDocument;

  cha: string;
  documentStatus: DocumentStatus;

  modeOfShipment: ShipmentMode;
  /** Retained for displaying legacy records. */
  otherModeDetail?: string;

  boeNo: string;
  boeDate: string;
  boeDocument?: ShipmentDocument;
  country: string;

  /* Payment */
  paymentType: PaymentType;
  /** Number of credit days, or null when the payment is not day-based. */
  creditDays: number | null;
  /** Date the credit days are counted from (null when creditDays is null). */
  creditDaysFrom: CreditDaysFrom | null;
  paymentStatus: PaymentStatus;
  /** Selected payment-term preset or customer-entered term. */
  paymentTerms?: string;
  receiptDate?: string;
  bankReferenceNo: string;

  /* Material status */
  materialStatus: MaterialStatus;
  /** Warehouse where the shipment arrived. */
  warehouseName?: string;
  /** Only used when materialStatus === 'Arrived'. */
  arrivedDate?: string;
  /** Expected to depart / arrive. Both optional; '' means unknown. */
  etd: string;
  eta: string;

  /** Link to the PDF / document folder for this shipment. NOT a tracking link. */
  link: string;
  /** Relative storage folder assigned by the backend. */
  docsFolderPath?: string;

  leadTime: number;
  createdAt: string;
}