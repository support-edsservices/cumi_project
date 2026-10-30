/* ─────────────────────────────────────────────────────────────────────────────
   Shipment types
   NOTE: rebuilt from how the pages use them. If your existing types file has
   extra exports, merge them in rather than deleting them.
───────────────────────────────────────────────────────────────────────────── */

/** Sea, Air, or anything else (the actual mode is typed into `otherModeDetail`). */
export type ShipmentMode = 'Sea' | 'Air' | 'Others';

/** LC needs a bank reference number. Everything else does not. */
export type PaymentType = 'LC' | 'Others';

/** Which date the credit days are counted from. */
export type CreditDaysFrom = 'Invoice Date' | 'BL Date' | 'PO Date';

export type PaymentStatus = 'PAID' | 'NOT PAID' | 'PARTIAL';
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

  portOfLoading: string;
  blNo: string;
  blDate: string; // YYYY-MM-DD or ''
  blDocument?: ShipmentDocument;
  mawb: string;
  hawb: string;

  cha: string;
  documentStatus: DocumentStatus;

  modeOfShipment: ShipmentMode;
  /** Only used when modeOfShipment === 'Others'. */
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
  bankReferenceNo: string;

  /* Material status */
  materialStatus: MaterialStatus;
  /** Only used when materialStatus === 'Arrived'. */
  arrivedDate?: string;
  /** Expected to depart / arrive. Both optional; '' means unknown. */
  etd: string;
  eta: string;

  /** Link to the PDF / document folder for this shipment. NOT a tracking link. */
  link: string;

  leadTime: number;
  createdAt: string;
}