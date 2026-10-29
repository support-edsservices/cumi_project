export type ShipmentMode = 'Sea' | 'Air';
export type PaymentTermType = '60 Days from BL' | '60 Days from Invoice' | 'LC' | 'PO';
export type PaymentStatus = 'PAID' | 'NOT PAID' | 'PARTIAL';
export type DocumentStatus = 'Pending' | 'Received' | 'In Process' | 'Completed';
export type MaterialStatus = 'In Transit' | 'At Port' | 'Customs Clearance' | 'Delivered' | 'Pending Shipment';

export interface Attachment {
  name: string;
  url: string;
  type: string; // 'pdf' | 'image' | 'doc'
}

export interface Shipment {
  id: string;
  supplier: string;
  poNo: string;
  poDocument?: Attachment;
  material: string;
  invoiceNo: string;
  invoiceDate: string; // ISO date
  invoiceDocument?: Attachment;
  portOfLoading: string;
  blNo: string;
  blDate: string; // ISO date
  blDocument?: Attachment;
  mawb: string;
  hawb: string;
  cha: string;
  documentStatus: DocumentStatus;
  modeOfShipment: ShipmentMode;
  boeNo: string;
  boeDate: string; // ISO date
  boeDocument?: Attachment;
  country: string;
  paymentTerms: PaymentTermType;
  paymentStatus: PaymentStatus;
  materialStatus: MaterialStatus;
  etd: string; // ISO date
  eta: string; // ISO date
  link: string;
  bankReferenceNo: string;
  leadTime: number; // in days
  createdAt: string; // ISO date
}
