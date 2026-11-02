import * as XLSX from 'xlsx';
import type { MasterEntry, MasterType } from '@/data/masterData';
import type {
  CreditDaysFrom,
  DocumentStatus,
  MaterialStatus,
  PaymentStatus,
  PaymentType,
  Shipment,
} from '@/types/shipment';

export type ShipmentImportField =
  | 'supplier'
  | 'poNo'
  | 'poDate'
  | 'material'
  | 'invoiceNo'
  | 'invoiceDate'
  | 'portOfLoading'
  | 'portOfLanding'
  | 'blNo'
  | 'blDate'
  | 'mawb'
  | 'hawb'
  | 'cha'
  | 'documentStatus'
  | 'modeOfShipment'
  | 'boeNo'
  | 'boeDate'
  | 'country'
  | 'paymentTerms'
  | 'paymentStatus'
  | 'materialStatus'
  | 'link'
  | 'bankReferenceNo'
  | 'leadTime'
  | 'warehouseName'
  | 'etd'
  | 'eta'
  | 'arrivedDate';

export interface ShipmentImportRow {
  rowNumber: number;
  shipmentId: string;
  fields: Partial<Record<ShipmentImportField, string>>;
}

export interface ShipmentExcelPreview {
  sheetName: string;
  fiscalYearCode: string | null;
  headerRowNumber: number;
  matchedColumns: { field: ShipmentImportField | 'shipmentId'; header: string }[];
  missingRequiredColumns: string[];
  rows: ShipmentImportRow[];
}

export type ShipmentImportMasters = Partial<Record<MasterType, MasterEntry[]>>;

const HEADER_ALIASES: Record<ShipmentImportField, string[]> = {
  supplier: ['supplier', 'supplier name'],
  poNo: ['po no', 'po no.', 'purchase order', 'purchase order no', 'purchase order number'],
  poDate: ['po date', 'purchase order date'],
  material: ['material', 'material description', 'material product', 'product description'],
  invoiceNo: ['invoice no', 'invoice no.', 'invoice number'],
  invoiceDate: ['invoice date'],
  portOfLoading: ['port of loading', 'loading port'],
  portOfLanding: ['port of landing', 'landing port', 'destination port'],
  blNo: ['bl no', 'bl no.', 'bl number', 'bill of lading no'],
  blDate: ['bl date', 'bill of lading date'],
  mawb: ['mawb', 'mawb no'],
  hawb: ['hawb', 'hawb no'],
  cha: ['cha', 'custom house agent'],
  documentStatus: ['document status'],
  modeOfShipment: ['mode of shipment', 'shipment mode', 'mode'],
  boeNo: ['boe no', 'boe no.', 'boe number'],
  boeDate: ['boe date'],
  country: ['country', 'country of origin'],
  paymentTerms: ['payment terms', 'payment term'],
  paymentStatus: ['prw', 'prw status', 'payment status'],
  materialStatus: ['material status'],
  link: ['link', 'document link'],
  bankReferenceNo: ['bank reference no', 'bank reference number', 'bank reference'],
  leadTime: ['leadtime', 'lead time', 'lead time days'],
  warehouseName: ['warehouse name', 'warehouse'],
  etd: ['etd', 'estimated departure date'],
  eta: ['eta', 'estimated arrival date'],
  arrivedDate: ['arrival date', 'arrived date'],
};

const SHIPMENT_ID_ALIASES = ['sh no', 'sh no.', 'shipment no', 'shipment id'];
const REQUIRED_COLUMNS: { field: ShipmentImportField; label: string }[] = [
  { field: 'supplier', label: 'Supplier' },
  { field: 'poNo', label: 'PO No' },
  { field: 'invoiceNo', label: 'Invoice No' },
];

function normalizeHeader(value: unknown): string {
  return String(value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function excelDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }

  const text = String(value ?? '').trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (iso) {
    return `${iso[1]}-${String(Number(iso[2])).padStart(2, '0')}-${String(Number(iso[3])).padStart(2, '0')}`;
  }

  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (dmy) {
    return `${dmy[3]}-${String(Number(dmy[2])).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`;
  }

  return null;
}

function cellText(value: unknown, dateField: boolean): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date && !Number.isNaN(value.getTime())
    ? excelDate(value) ?? ''
    : String(value).trim();
  if (['-', '—', '?', 'n/a'].includes(text.toLocaleLowerCase())) return '';
  if (dateField) return excelDate(value) ?? text;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return excelDate(value) ?? '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return text;
}

function headerMatches(header: unknown): ShipmentImportField | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ShipmentImportField, string[]][]) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) return field;
  }
  return null;
}

export function parseShipmentExcel(buffer: ArrayBuffer): ShipmentExcelPreview {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  if (!workbook.SheetNames.length) throw new Error('The workbook contains no sheets.');

  let selected: {
    sheetName: string;
    headerIndex: number;
    values: unknown[][];
    columns: Map<ShipmentImportField, { index: number; header: string }>;
    shipmentIdColumn: { index: number; header: string } | null;
  } | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });

    for (let headerIndex = 0; headerIndex < Math.min(values.length, 20); headerIndex += 1) {
      const columns = new Map<ShipmentImportField, { index: number; header: string }>();
      let shipmentIdColumn: { index: number; header: string } | null = null;
      values[headerIndex].forEach((header, index) => {
        const field = headerMatches(header);
        if (field && !columns.has(field)) {
          columns.set(field, { index, header: String(header).trim() });
        }
        if (SHIPMENT_ID_ALIASES.some((alias) => normalizeHeader(alias) === normalizeHeader(header))) {
          shipmentIdColumn ??= { index, header: String(header).trim() };
        }
      });
      if (!selected || columns.size > selected.columns.size) {
        selected = { sheetName, headerIndex, values, columns, shipmentIdColumn };
      } else if (columns.size === selected.columns.size && shipmentIdColumn && !selected.shipmentIdColumn) {
        selected = { sheetName, headerIndex, values, columns, shipmentIdColumn };
      }
      if (shipmentIdColumn && REQUIRED_COLUMNS.every(({ field }) => columns.has(field))) break;
    }
    if (
      selected
      && selected.shipmentIdColumn
      && REQUIRED_COLUMNS.every(({ field }) => selected?.columns.has(field))
    ) break;
  }

  if (!selected || (selected.columns.size === 0 && !selected.shipmentIdColumn)) {
    throw new Error('Could not find a row with recognizable shipment column headings.');
  }

  const dateFields = new Set<ShipmentImportField>([
    'poDate',
    'invoiceDate',
    'blDate',
    'boeDate',
    'etd',
    'eta',
    'arrivedDate',
  ]);
  const rows: ShipmentImportRow[] = [];
  for (let index = selected.headerIndex + 1; index < selected.values.length; index += 1) {
    const row = selected.values[index];
    const fields: Partial<Record<ShipmentImportField, string>> = {};
    for (const [field, column] of selected.columns) {
      fields[field] = cellText(row[column.index], dateFields.has(field));
    }
    const shipmentId = selected.shipmentIdColumn
      ? cellText(row[selected.shipmentIdColumn.index], false)
      : '';
    if (Object.entries(fields).some(([field, value]) => field !== 'link' && Boolean(value?.trim()))) {
      rows.push({ rowNumber: index + 1, shipmentId, fields });
    }
  }

  const missingRequiredColumns = REQUIRED_COLUMNS
    .filter(({ field }) => !selected?.columns.has(field))
    .map(({ label }) => label);
  if (!selected.shipmentIdColumn) missingRequiredColumns.unshift('SH. No');
  const fiscalYearMatch = /\bFY\s*(\d{2})\s*[-–/]\s*(\d{2})\b/i.exec(selected.sheetName);

  return {
    sheetName: selected.sheetName,
    fiscalYearCode: fiscalYearMatch ? `FY${fiscalYearMatch[1]}T${fiscalYearMatch[2]}` : null,
    headerRowNumber: selected.headerIndex + 1,
    matchedColumns: [
      ...(selected.shipmentIdColumn
        ? [{ field: 'shipmentId' as const, header: selected.shipmentIdColumn.header }]
        : []),
      ...Array.from(selected.columns, ([field, column]) => ({ field, header: column.header })),
    ],
    missingRequiredColumns,
    rows,
  };
}

export function shipmentImportRowIssues(row: ShipmentImportRow): string[] {
  const issues: string[] = [];
  if (!row.shipmentId.trim()) issues.push('SH. No is missing');
  if (!row.fields.supplier?.trim()) issues.push('Supplier is missing');
  if (!row.fields.poNo?.trim()) issues.push('PO No is missing');
  if (!row.fields.invoiceNo?.trim()) issues.push('Invoice No is missing');
  return issues;
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function activeMasterName(
  masterType: MasterType,
  value: string,
  masters: ShipmentImportMasters,
): MasterEntry | undefined {
  const target = normalizedName(value);
  return (masters[masterType] ?? []).find((entry) => (
    Boolean(entry.is_active) && normalizedName(entry.name) === target
  ));
}

function requiredMasterName(
  masterType: MasterType,
  value: string,
  masters: ShipmentImportMasters,
): string {
  if (!value.trim()) return '';
  const entry = activeMasterName(masterType, value, masters);
  if (!entry) {
    const labels: Record<MasterType, string> = {
      suppliers: 'supplier',
      ports: 'port',
      chas: 'CHA agent',
      modes: 'shipment mode',
      countries: 'country',
      'payment-terms': 'payment term',
      prw: 'PRW status',
      warehouses: 'warehouse',
      materials: 'material',
    };
    throw new Error(`"${value}" is not an active ${labels[masterType]} master entry.`);
  }
  return entry.name;
}

function parseLooseDate(value: string): string | null {
  const text = value.trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  const dmy = /(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:$|[^\d])/.exec(text);
  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
    if (year < 100) year += 2000;
  } else {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    year < 1000
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function importDate(value: string | undefined, fieldLabel: string): string {
  if (!value?.trim()) return '';
  const parsed = parseLooseDate(value);
  if (!parsed) throw new Error(`${fieldLabel} "${value}" is not a valid date.`);
  return parsed;
}

function importedStatus(
  row: ShipmentImportRow,
): { materialStatus: MaterialStatus; etd: string; eta: string } {
  const source = row.fields.materialStatus?.trim() ?? '';
  const normalized = source.toLocaleLowerCase().replace(/\s+/g, ' ');
  const statusMap: Record<string, MaterialStatus> = {
    'pending shipment': 'Pending Shipment',
    'in transit': 'In Transit',
    'at port': 'At Port',
    'customs clearance': 'Customs Clearance',
    arrived: 'Arrived',
  };
  const explicitStatus = statusMap[normalized];
  const scheduleDate = String.raw`(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)`;
  const sourceEtd = source.match(new RegExp(String.raw`\bETD\s*[:\-]\s*${scheduleDate}`, 'i'))?.[1];
  const sourceEta = source.match(new RegExp(String.raw`\bETA\s*[:\-]\s*${scheduleDate}`, 'i'))?.[1];
  const inferredEtd = sourceEtd ? parseLooseDate(sourceEtd) ?? '' : '';
  const inferredEta = sourceEta ? parseLooseDate(sourceEta) ?? '' : parseLooseDate(source) ?? '';
  if (source && !explicitStatus && !/\b(?:ETD|ETA)\b/i.test(source) && !parseLooseDate(source)) {
    throw new Error(`Material status "${source}" is not recognized.`);
  }
  return {
    materialStatus: explicitStatus ?? 'In Transit',
    etd: importDate(row.fields.etd, 'ETD') || inferredEtd,
    eta: importDate(row.fields.eta, 'ETA') || inferredEta,
  };
}

function importedPaymentStatus(value: string | undefined): PaymentStatus {
  const normalized = (value ?? '').trim().toLocaleUpperCase().replace(/[_\s]+/g, ' ');
  if (!normalized || normalized === 'NOT PAID' || normalized === 'NO PAYMENT') return 'NOT PAID';
  if (normalized === 'PAID') return 'PAID';
  if (normalized === 'PARTIAL') return 'PARTIAL';
  if (normalized === 'ADVANCE') return 'ADVANCE';
  if (normalized === '2 WAY' || normalized === 'TWO WAY' || normalized === '2 PAY') return '2 WAY';
  if (normalized === 'SR DATE' || /^SR\s+\d/.test(normalized)) return 'SR DATE';
  if (normalized === 'LC' || normalized === 'SAMPLE' || normalized === 'FREE SAMPLE') return 'NOT PAID';
  throw new Error(`PRW value "${value}" is not supported.`);
}

function creditBasisLabel(value: string | null | undefined): CreditDaysFrom | null {
  const labels: Record<string, CreditDaysFrom> = {
    INVOICE_DATE: 'Invoice Date',
    BL_DATE: 'BL Date',
    PO_DATE: 'PO Date',
    PROFORMA_INVOICE_DATE: 'Proforma Invoice Date',
  };
  return value ? labels[value] ?? null : null;
}

export function buildShipmentImportRecord(
  row: ShipmentImportRow,
  masters: ShipmentImportMasters,
): Shipment {
  const fields = row.fields;
  const supplier = requiredMasterName('suppliers', fields.supplier ?? '', masters);
  if (!supplier) throw new Error('Supplier is missing.');

  const modeName = requiredMasterName('modes', fields.modeOfShipment ?? '', masters);
  if (!modeName) throw new Error('Mode of Shipment is missing.');
  const paymentTerm = fields.paymentTerms?.trim()
    ? activeMasterName('payment-terms', fields.paymentTerms, masters)
    : undefined;
  if (fields.paymentTerms?.trim() && !paymentTerm) {
    throw new Error(`"${fields.paymentTerms}" is not an active payment term master entry.`);
  }

  const paymentStatus = importedPaymentStatus(fields.paymentStatus);
  const normalizedStatus = (fields.documentStatus ?? '').trim().toLocaleLowerCase();
  let documentStatus: DocumentStatus;
  if (['provided', 'completed', 'received'].includes(normalizedStatus)) {
    documentStatus = 'Provided';
  } else if (!normalizedStatus || ['not provided', 'not_provided', 'pending'].includes(normalizedStatus)) {
    documentStatus = 'Not Provided';
  } else {
    throw new Error(`Document Status "${fields.documentStatus}" is not supported.`);
  }

  const schedule = importedStatus(row);
  const statusSource = fields.materialStatus?.trim().toLocaleLowerCase();
  if (
    statusSource === 'arrived'
    && !fields.arrivedDate?.trim()
  ) throw new Error('Arrival Date is required for shipments marked Arrived.');

  const paymentType: PaymentType = paymentTerm?.payment_type?.toUpperCase() === 'LC' ? 'LC' : 'Others';
  const leadTimeText = fields.leadTime?.trim();
  const leadTime = leadTimeText ? Number(leadTimeText) : 45;
  if (!Number.isInteger(leadTime) || leadTime < 0 || leadTime > 65535) {
    throw new Error(`Leadtime "${leadTimeText}" is invalid.`);
  }

  return {
    id: '',
    supplier,
    poNo: fields.poNo?.trim() ?? '',
    poDate: importDate(fields.poDate, 'PO Date') || undefined,
    material: fields.material?.trim() ?? '',
    invoiceNo: fields.invoiceNo?.trim() ?? '',
    invoiceDate: importDate(fields.invoiceDate, 'Invoice Date'),
    proformaInvoiceNo: '',
    proformaInvoiceDate: '',
    portOfLoading: requiredMasterName('ports', fields.portOfLoading ?? '', masters),
    portOfLanding: requiredMasterName('ports', fields.portOfLanding ?? '', masters) || undefined,
    blNo: fields.blNo?.trim() || 'BL-PENDING',
    blDate: importDate(fields.blDate, 'BL Date'),
    mawb: fields.mawb?.trim() ?? '',
    hawb: fields.hawb?.trim() ?? '',
    cha: requiredMasterName('chas', fields.cha ?? '', masters),
    documentStatus,
    modeOfShipment: modeName,
    boeNo: fields.boeNo?.trim() || 'BOE-PENDING',
    boeDate: importDate(fields.boeDate, 'BOE Date'),
    country: requiredMasterName('countries', fields.country ?? '', masters),
    paymentType,
    creditDays: paymentTerm?.credit_days ?? null,
    creditDaysFrom: creditBasisLabel(paymentTerm?.credit_basis ?? null),
    paymentStatus,
    paymentTerms: paymentTerm?.name ?? '',
    bankReferenceNo: fields.bankReferenceNo?.trim() ?? '',
    materialStatus: schedule.materialStatus,
    warehouseName: requiredMasterName('warehouses', fields.warehouseName ?? '', masters) || undefined,
    arrivedDate: importDate(fields.arrivedDate, 'Arrival Date') || undefined,
    etd: schedule.etd,
    eta: schedule.eta,
    link: '',
    leadTime,
    createdAt: new Date().toISOString().slice(0, 10),
  };
}
