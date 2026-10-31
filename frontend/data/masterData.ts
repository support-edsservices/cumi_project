export const MASTER_TYPES = [
  'suppliers',
  'ports',
  'chas',
  'modes',
  'countries',
  'payment-terms',
  'prw',
  'warehouses',
  'materials',
] as const;

export type MasterType = typeof MASTER_TYPES[number];

export interface MasterEntry {
  id: number;
  name: string;
  is_active: boolean | number;
  code?: string;
  payment_type?: string;
  credit_days?: number | null;
  credit_basis?: string | null;
  needs_review?: boolean | number;
}

export const MASTER_LABELS: Record<MasterType, string> = {
  suppliers: 'Suppliers',
  ports: 'Ports',
  chas: 'CHA Agents',
  modes: 'Shipment Modes',
  countries: 'Countries',
  'payment-terms': 'Payment Terms',
  prw: 'PRW / Payment Statuses',
  warehouses: 'Warehouses',
  materials: 'Materials',
};

export const MASTER_PATHS: Record<MasterType, string> = {
  suppliers: '/masters/suppliers',
  ports: '/masters/ports',
  chas: '/masters/chas',
  modes: '/masters/modes',
  countries: '/masters/countries',
  'payment-terms': '/masters/payment-terms',
  prw: '/masters/prw',
  warehouses: '/masters/warehouses',
  materials: '/masters/materials',
};
