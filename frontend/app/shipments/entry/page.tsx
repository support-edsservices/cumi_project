'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Shipment Entry & History Portal
   - New Entry / Edit Entry form
       • Mode of shipment: selected from maintained master data
       • MAWB / HAWB document attachments added
       • Action Buttons: Clear, Preview, Save (with confirmation dialog)
   - History & Records table with search, filters, Excel / CSV export
   - Row details open in a right-side drawer (50% width, 100% height)
───────────────────────────────────────────────────────────────────────────── */
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Save,
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  Building2,
  Receipt,
  Navigation,
  ShieldCheck,
  CreditCard,
  Calendar,
  Download,
  Search,
  Eye,
  Table as TableIcon,
  Plus,
  Pencil,
  Trash2,
  Paperclip,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

import {
  Shipment,
  ShipmentDocument,
  ShipmentMode,
  PaymentType,
  PaymentStatus,
  DocumentStatus,
  MaterialStatus,
  PAYMENT_STATUSES,
} from '@/types/shipment';
import {
  formatDMY,
  formatEtdEta,
  getDaysUntilDue,
  getDocumentRemark,
  getModeLabel,
  getPaymentBaseISO,
  getPaymentDueDate,
  getPaymentTermDateBasis,
  getPaymentTermsLabel,
  getPaymentPeriod,
  nextShipmentId,
  toISODate,
} from '@/data/shipmentData';
import { useShipments } from '@/hooks/useShipments';
import type { ShipmentDocumentType } from '@/hooks/useShipments';
import { useAuth } from '@/context/AuthContext';
import { MASTER_LABELS, MASTER_PATHS, MASTER_TYPES, type MasterEntry, type MasterType } from '@/data/masterData';
import { BASE_URL } from '@/data/ENUM';
import SearchableSelect, { type SearchableSelectOption } from '@/components/SearchableSelect';

/* ═══════════════════════════════════════════════════════════════════════════
   Form state
═══════════════════════════════════════════════════════════════════════════ */
const emptyForm = {
  supplier: '',
  poNo: '',
  poDate: '',
  poDocName: '',
  material: '',
  invoiceNo: '',
  invoiceDate: '',
  invoiceDocName: '',
  portOfLoading: '',
  portOfLanding: '',
  blNo: '',
  blDate: '',
  blDocName: '',
  mawb: '',
  mawbDocName: '',
  hawb: '',
  hawbDocName: '',
  cha: '',
  documentStatus: 'Pending' as DocumentStatus,
  modeOfShipment: '' as ShipmentMode,
  boeNo: '',
  boeDate: '',
  boeDocName: '',
  country: '',
  paymentType: 'Others' as PaymentType,
  paymentTermChoice: '',
  bankReferenceNo: '',
  receiptDate: '',
  paymentStatus: 'NOT PAID' as PaymentStatus,
  materialStatus: 'In Transit' as MaterialStatus,
  warehouseName: '',
  arrivedDate: '',
  etd: '',
  eta: '',
  link: '',
  leadTime: '45',
};
type FormState = typeof emptyForm;
type DocumentField = 'poDocName' | 'invoiceDocName' | 'blDocName' | 'mawbDocName' | 'hawbDocName' | 'boeDocName';
type DocumentNumberField = 'poNo' | 'invoiceNo' | 'blNo' | 'boeNo';
type DocumentDateField = 'poDate' | 'invoiceDate' | 'blDate' | 'boeDate';
type DocumentCounts = Record<DocumentNumberField, number>;

const DEFAULT_DOCUMENT_COUNTS: DocumentCounts = {
  poNo: 1,
  invoiceNo: 1,
  blNo: 0,
  boeNo: 0,
};

function splitDocumentValues(value: string, count: number): string[] {
  const values = value ? value.split('_') : [];
  return Array.from({ length: count }, (_, index) => values[index] ?? '');
}

function documentCountFromValue(value: string, minimum: number): number {
  const values = value.split('_').filter((part) => part.trim());
  if (values.every((part) => ['BL-PENDING', 'BOE-PENDING'].includes(part.toUpperCase()))) return minimum;
  return Math.max(minimum, values.length);
}

const DOCUMENT_UPLOADS: { field: DocumentField; type: ShipmentDocumentType }[] = [
  { field: 'poDocName', type: 'PO' },
  { field: 'invoiceDocName', type: 'INVOICE' },
  { field: 'blDocName', type: 'BL' },
  { field: 'mawbDocName', type: 'MAWB' },
  { field: 'hawbDocName', type: 'HAWB' },
  { field: 'boeDocName', type: 'BOE' },
];

function shipmentToForm(s: Shipment & { mawbDocument?: ShipmentDocument; hawbDocument?: ShipmentDocument }): FormState {
  const savedPaymentTerms = s.paymentTerms ?? getPaymentTermsLabel(s);

  return {
    supplier: s.supplier,
    poNo: s.poNo,
    poDate: s.poDate ?? '',
    poDocName: s.poDocument?.name ?? '',
    material: s.material,
    invoiceNo: s.invoiceNo,
    invoiceDate: s.invoiceDate,
    invoiceDocName: s.invoiceDocument?.name ?? '',
    portOfLoading: s.portOfLoading,
    portOfLanding: s.portOfLanding ?? '',
    blNo: s.blNo,
    blDate: s.blDate,
    blDocName: s.blDocument?.name ?? '',
    mawb: s.mawb,
    mawbDocName: s.mawbDocument?.name ?? '',
    hawb: s.hawb,
    hawbDocName: s.hawbDocument?.name ?? '',
    cha: s.cha,
    documentStatus: s.documentStatus,
    modeOfShipment: s.modeOfShipment,
    boeNo: s.boeNo,
    boeDate: s.boeDate,
    boeDocName: s.boeDocument?.name ?? '',
    country: s.country,
    paymentType: s.paymentType,
    paymentTermChoice: savedPaymentTerms,
    bankReferenceNo: s.bankReferenceNo,
    receiptDate: s.receiptDate ?? '',
    paymentStatus: s.paymentStatus,
    materialStatus: s.materialStatus,
    warehouseName: s.warehouseName ?? '',
    arrivedDate: s.arrivedDate ?? '',
    etd: s.etd,
    eta: s.eta,
    link: s.docsFolderPath ?? '',
    leadTime: String(s.leadTime),
  };
}

function formToShipment(
  f: FormState,
  id: string,
  createdAt: string,
  prev?: Shipment & { mawbDocument?: ShipmentDocument; hawbDocument?: ShipmentDocument },
  paymentTerm?: MasterEntry,
): Shipment & { mawbDocument?: ShipmentDocument; hawbDocument?: ShipmentDocument } {
  const doc = (name: string, existing?: ShipmentDocument): ShipmentDocument | undefined =>
    !name ? undefined : existing && existing.name === name ? existing : { name, url: '#', type: 'pdf' };

  const paymentTerms = f.paymentTermChoice;

  return {
    id,
    supplier: f.supplier.trim(),
    poNo: f.poNo.trim(),
    poDate: f.poDate || undefined,
    poDocument: doc(f.poDocName, prev?.poDocument),
    material: f.material.trim() || 'Industrial Components',
    invoiceNo: f.invoiceNo.trim(),
    invoiceDate: f.invoiceDate,
    invoiceDocument: doc(f.invoiceDocName, prev?.invoiceDocument),
    portOfLoading: f.portOfLoading.trim(),
    portOfLanding: f.portOfLanding.trim() || undefined,
    blNo: f.blNo.trim() || 'BL-PENDING',
    blDate: f.blDate,
    blDocument: doc(f.blDocName, prev?.blDocument),
    mawb: f.mawb.trim(),
    mawbDocument: doc(f.mawbDocName, prev?.mawbDocument),
    hawb: f.hawb.trim(),
    hawbDocument: doc(f.hawbDocName, prev?.hawbDocument),
    cha: f.cha.trim(),
    documentStatus: f.documentStatus,
    modeOfShipment: f.modeOfShipment,
    boeNo: f.boeNo.trim() || 'BOE-PENDING',
    boeDate: f.boeDate,
    boeDocument: doc(f.boeDocName, prev?.boeDocument),
    country: f.country.trim(),
    paymentType: f.paymentType,
    creditDays: paymentTerm?.credit_days ?? null,
    creditDaysFrom: paymentTerm?.credit_basis ? creditBasisLabel(paymentTerm.credit_basis) : null,
    paymentStatus: f.paymentStatus,
    paymentTerms,
    bankReferenceNo: f.bankReferenceNo.trim(),
    receiptDate: f.receiptDate || undefined,
    materialStatus: f.materialStatus,
    warehouseName: f.warehouseName.trim() || undefined,
    arrivedDate: f.materialStatus === 'Arrived' ? f.arrivedDate : undefined,
    etd: f.etd,
    eta: f.eta,
    link: f.link.trim(),
    leadTime: parseInt(f.leadTime, 10) || 45,
    createdAt,
  };
}

function validate(
  f: FormState,
  activeModeNames: readonly string[],
  documentCounts: DocumentCounts,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.supplier.trim()) e.supplier = 'Supplier name is required';
  const poValues = splitDocumentValues(f.poNo, documentCounts.poNo);
  const invoiceValues = splitDocumentValues(f.invoiceNo, documentCounts.invoiceNo);
  const blValues = splitDocumentValues(f.blNo === 'BL-PENDING' ? '' : f.blNo, documentCounts.blNo);
  const boeValues = splitDocumentValues(f.boeNo === 'BOE-PENDING' ? '' : f.boeNo, documentCounts.boeNo);
  if (poValues.some((value) => !value.trim())) e.poNo = 'Enter a PO number in every PO field';
  if (invoiceValues.some((value) => !value.trim())) e.invoiceNo = 'Enter an invoice number in every invoice field';
  if (blValues.some((value) => value.trim()) && blValues.some((value) => !value.trim())) {
    e.blNo = 'Complete every BL field or leave all BL fields blank';
  }
  if (boeValues.some((value) => value.trim()) && boeValues.some((value) => !value.trim())) {
    e.boeNo = 'Complete every BOE field or leave all BOE fields blank';
  }
  const paymentTerms = f.paymentTermChoice;
  if (!paymentTerms) e.paymentTerms = 'Select or enter payment terms';
  if (!activeModeNames.includes(f.modeOfShipment)) e.modeOfShipment = 'Select an active shipment mode';
  if (!f.paymentStatus) e.paymentStatus = 'Select a PRW/payment status';


  if (f.paymentType === 'LC' && !f.bankReferenceNo.trim()) {
    e.bankReferenceNo = 'Bank reference is required for LC';
  }

  if (f.paymentStatus === 'NOT PAID' && f.paymentType !== 'LC') {
    const dateBasis = getPaymentTermDateBasis(paymentTerms);
    const allDatesProvided = (value: string, count: number) =>
      count > 0 && splitDocumentValues(value, count).every((date) => Boolean(date));
    if (dateBasis === 'Invoice Date' && !allDatesProvided(f.invoiceDate, documentCounts.invoiceNo)) {
      e.invoiceDate = 'Enter an invoice date for each invoice to calculate the payment due date';
    } else if (dateBasis === 'BL Date' && !allDatesProvided(f.blDate, documentCounts.blNo)) {
      e.blDate = 'Enter a BL date for each BL to calculate the payment due date';
    } else if (dateBasis === 'PO Date' && !allDatesProvided(f.poDate, documentCounts.poNo)) {
      e.poDate = 'Enter a PO date for each PO to calculate the payment due date';
    } else if (dateBasis === 'Receipt Date' && !f.receiptDate) {
      e.receiptDate = 'Select the date of receipt to calculate the payment due date';
    }
  }

  if (f.materialStatus === 'Arrived' && !f.arrivedDate) {
    e.arrivedDate = 'Select the arrival date';
  }
  return e;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page Component
═══════════════════════════════════════════════════════════════════════════ */
export default function ShipmentEntryAndHistoryPage() {
  const { shipments, ready, error, addShipment, updateShipment, deleteShipment, uploadAttachment } = useShipments();
  const { fetchWithAuth } = useAuth();

  const [activeTab, setActiveTab] = useState<'entry' | 'history'>('entry');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [masterOptions, setMasterOptions] = useState<Partial<Record<MasterType, MasterEntry[]>>>({});
  const [masterDataError, setMasterDataError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [documentCounts, setDocumentCounts] = useState<DocumentCounts>(DEFAULT_DOCUMENT_COUNTS);
  const [pendingFiles, setPendingFiles] = useState<Partial<Record<DocumentField, File>>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewShipment, setPreviewShipment] = useState<Shipment | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null);

  // History filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterDocStatus, setFilterDocStatus] = useState('all');
  const [filterMaterialStatus, setFilterMaterialStatus] = useState('all');

  const selectedShipment = useMemo(
    () => previewShipment ?? (shipments.find((s) => s.id === selectedId) ?? null),
    [shipments, selectedId, previewShipment]
  );

  const activeMasterNames = (masterType: MasterType) =>
    (masterOptions[masterType] ?? []).filter((entry) => Boolean(entry.is_active));
  const masterSelectOptions = (masterType: MasterType): SearchableSelectOption[] =>
    activeMasterNames(masterType).map((entry) => ({ value: entry.name, label: entry.name }));
  const errors = useMemo(
    () => (showErrors ? validate(formData, activeMasterNames('modes').map((entry) => entry.name), documentCounts) : {}),
    [showErrors, formData, masterOptions, documentCounts],
  );
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    let active = true;
    const loadMasterOptions = async () => {
      try {
        const responses = await Promise.all(
          MASTER_TYPES.map(async (masterType) => {
            const response = await fetchWithAuth(`${BASE_URL}/api/masters/${masterType}`);
            if (!response.ok) throw new Error(`Could not load ${MASTER_LABELS[masterType]} master data.`);
            return [masterType, await response.json() as MasterEntry[]] as const;
          })
        );
        if (active) {
          setMasterOptions(Object.fromEntries(responses) as Record<MasterType, MasterEntry[]>);
          setMasterDataError(null);
        }
      } catch (loadError) {
        if (active) setMasterDataError(loadError instanceof Error ? loadError.message : 'Could not load master data.');
      }
    };
    void loadMasterOptions();
    return () => { active = false; };
  }, [fetchWithAuth]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'history') {
      setActiveTab('history');
    }
  }, []);

  useEffect(() => {
    if (!selectedShipment && !deleteTarget && !showSaveConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget) setDeleteTarget(null);
      else if (showSaveConfirm) setShowSaveConfirm(false);
      else {
        setSelectedId(null);
        setPreviewShipment(null);
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedShipment, deleteTarget, showSaveConfirm]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateDocumentValue = (field: DocumentNumberField | DocumentDateField, index: number, value: string) => {
    if (field.endsWith('No') && value.includes('_')) {
      showToast('Enter one document number per field; underscores separate saved rows.');
      return;
    }
    const countField = field.endsWith('No') ? field as DocumentNumberField : ({
      poDate: 'poNo',
      invoiceDate: 'invoiceNo',
      blDate: 'blNo',
      boeDate: 'boeNo',
    } as const)[field as DocumentDateField];
    setFormData((current) => {
      const values = splitDocumentValues(current[field], documentCounts[countField]);
      values[index] = value;
      return { ...current, [field]: values.join('_') };
    });
  };

  const changeDocumentCount = (
    field: DocumentNumberField,
    dateField: DocumentDateField,
    requestedCount: number,
    minimum: number,
  ) => {
    const count = Math.max(minimum, Math.min(255, Math.floor(requestedCount || minimum)));
    setDocumentCounts((current) => ({ ...current, [field]: count }));
    setFormData((current) => ({
      ...current,
      [field]: splitDocumentValues(current[field], count).join('_'),
      [dateField]: splitDocumentValues(current[dateField], count).join('_'),
    }));
  };

  const resetDocumentCounts = () => setDocumentCounts(DEFAULT_DOCUMENT_COUNTS);

  const handleFileSimulate = (
    field: DocumentField,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileName = file.name;
      setField(field, fileName);
      setPendingFiles((current) => ({ ...current, [field]: file }));
      showToast(`Attached document: ${fileName}`);
    }
  };

  const startEdit = (s: Shipment) => {
    setEditingId(s.id);
    const editedForm = shipmentToForm(s);
    setFormData(editedForm);
    setDocumentCounts({
      poNo: documentCountFromValue(editedForm.poNo, 1),
      invoiceNo: documentCountFromValue(editedForm.invoiceNo, 1),
      blNo: documentCountFromValue(editedForm.blNo, 0),
      boeNo: documentCountFromValue(editedForm.boeNo, 0),
    });
    setPendingFiles({});
    setShowErrors(false);
    setSelectedId(null);
    setPreviewShipment(null);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(emptyForm);
    resetDocumentCounts();
    setPendingFiles({});
    setShowErrors(false);
    setActiveTab('history');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    try {
      await deleteShipment(id);
      if (selectedId === id) setSelectedId(null);
      if (editingId === id) {
        setEditingId(null);
        setFormData(emptyForm);
        resetDocumentCounts();
        setPendingFiles({});
      }
      setDeleteTarget(null);
      showToast(`Shipment ${id} deleted`);
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Could not delete shipment.');
    }
  };

  const handleClearForm = () => {
    setFormData(emptyForm);
    resetDocumentCounts();
    setPendingFiles({});
    setShowErrors(false);
    showToast('Form fields cleared');
  };

  const validateFormAndScroll = () => {
    const errs = validate(formData, activeMasterNames('modes').map((entry) => entry.name), documentCounts);
    if (Object.keys(errs).length > 0) {
      setShowErrors(true);
      setTimeout(() => {
        document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (!validateFormAndScroll()) return;
    const currentId = editingId || nextShipmentId(shipments);
    const mockPreview = formToShipment(formData, currentId, toISODate(new Date()), undefined, selectedPaymentTerm);
    setPreviewShipment(mockPreview);
  };

  const handleInitiateSave = () => {
    if (!validateFormAndScroll()) return;
    setShowSaveConfirm(true);
  };

  const handleConfirmSave = async () => {
    setShowSaveConfirm(false);
    let saved: Shipment | null = null;
    const wasEditing = editingId !== null;

    try {
      let savedRecord: Shipment;
      if (editingId) {
        const prev = shipments.find((s) => s.id === editingId);
        if (!prev) {
          setEditingId(null);
          showToast('That shipment no longer exists.');
          return;
        }
        savedRecord = await updateShipment(formToShipment(formData, prev.id, prev.createdAt, prev, selectedPaymentTerm));
      } else {
        savedRecord = await addShipment(formToShipment(formData, '', toISODate(new Date()), undefined, selectedPaymentTerm));
      }
      saved = savedRecord;

      for (const upload of DOCUMENT_UPLOADS) {
        const file = pendingFiles[upload.field];
        if (!file) continue;
        await uploadAttachment(savedRecord.id, upload.type, file);
        setPendingFiles((current) => {
          const next = { ...current };
          delete next[upload.field];
          return next;
        });
      }

      showToast(`Shipment ${savedRecord.id} is saved`);
      setEditingId(null);
      setFormData(emptyForm);
      resetDocumentCounts();
      setPendingFiles({});
      setShowErrors(false);
      setActiveTab('history');
    } catch (saveError) {
      if (saved && !wasEditing) setEditingId(saved.id);
      const message = saveError instanceof Error ? saveError.message : 'Could not save shipment.';
      showToast(saved ? `Shipment ${saved.id} was saved, but an attachment failed: ${message}` : message);
    }
  };

  const selectedPaymentTerms = formData.paymentTermChoice;
  const selectedPaymentTerm = activeMasterNames('payment-terms')
    .find((entry) => entry.name === selectedPaymentTerms);
  const paymentDueDateBasis = formData.paymentStatus === 'NOT PAID' && formData.paymentType !== 'LC'
    ? selectedPaymentTerm?.credit_basis
      ? creditBasisLabel(selectedPaymentTerm.credit_basis)
      : getPaymentTermDateBasis(selectedPaymentTerms)
    : null;
  const creditBaseISO = getPaymentBaseISO({
    invoiceDate: formData.invoiceDate,
    blDate: formData.blDate,
    poDate: formData.poDate,
    receiptDate: formData.receiptDate,
    paymentTerms: selectedPaymentTerms,
    creditDaysFrom: selectedPaymentTerm?.credit_basis ? creditBasisLabel(selectedPaymentTerm.credit_basis) : null,
  });
  const creditDue = getPaymentDueDate({
    paymentType: formData.paymentType,
    paymentTerms: selectedPaymentTerms,
    creditDays: selectedPaymentTerm?.credit_days ?? null,
    creditDaysFrom: selectedPaymentTerm?.credit_basis ? creditBasisLabel(selectedPaymentTerm.credit_basis) : null,
    invoiceDate: formData.invoiceDate,
    blDate: formData.blDate,
    poDate: formData.poDate,
    receiptDate: formData.receiptDate,
  });

  const filteredShipments = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return shipments.filter((item) => {
      const matchSearch =
        !searchTerm ||
        item.supplier.toLowerCase().includes(q) ||
        item.poNo.toLowerCase().includes(q) ||
        item.invoiceNo.toLowerCase().includes(q) ||
        item.blNo.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.country.toLowerCase().includes(q) ||
        item.cha.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.modeOfShipment.toLowerCase().includes(q);

      const matchMode = filterMode === 'all' || item.modeOfShipment === filterMode;
      const matchPayment = filterPayment === 'all' || item.paymentStatus === filterPayment;
      const matchDocStatus = filterDocStatus === 'all' || item.documentStatus === filterDocStatus;
      const matchMatStatus = filterMaterialStatus === 'all' || item.materialStatus === filterMaterialStatus;

      return matchSearch && matchMode && matchPayment && matchDocStatus && matchMatStatus;
    });
  }, [shipments, searchTerm, filterMode, filterPayment, filterDocStatus, filterMaterialStatus]);

  const handleExportExcel = () => {
    if (filteredShipments.length === 0) {
      alert('No records available to export.');
      return;
    }

    const exportRows = filteredShipments.map((s, idx) => {
      const due = getPaymentDueDate(s);
      return {
        'S.No': idx + 1,
        'Shipment ID': s.id,
        'Supplier Name': s.supplier,
        'PO Number': s.poNo,
        'PO Date': s.poDate || '',
        'Material Description': s.material,
        'Mode of Shipment': getModeLabel(s),
        'Invoice Number': s.invoiceNo,
        'Invoice Date': s.invoiceDate,
        'BL Number': s.blNo,
        'BL Date': s.blDate,
        'Port of Loading': s.portOfLoading,
        'Port of Landing': s.portOfLanding || '',
        'MAWB': s.mawb || '-',
        'HAWB': s.hawb || '-',
        'CHA Agent': s.cha,
        'Country': s.country,
        'BOE Number': s.boeNo,
        'BOE Date': s.boeDate,
        'Document Status': s.documentStatus,
        'Payment Type': s.paymentType,
        'Payment Terms': getPaymentTermsLabel(s),
        'PRW Status': s.paymentStatus,
        'Payment Due Date': due ? toISODate(due) : 'N/A',
        'Bank Reference': s.bankReferenceNo || '-',
        'Material Status': s.materialStatus,
        'Warehouse': s.warehouseName || '',
        'Date of Receipt': s.receiptDate || '',
        'Arrival Date': s.arrivedDate || '',
        'ETD': s.etd || '',
        'ETA': s.eta || '',
        'Lead Time (Days)': s.leadTime,
        'Documents Folder': s.docsFolderPath || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipment History');
    worksheet['!cols'] = Object.keys(exportRows[0]).map((key) => ({ wch: Math.max(key.length, 14) }));

    const fileName = `Shipments_History_${toISODate(new Date())}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showToast(`Exported ${filteredShipments.length} rows to ${fileName}`);
  };

  const handleExportCSV = () => {
    if (filteredShipments.length === 0) {
      alert('No records available to export.');
      return;
    }

    const exportRows = filteredShipments.map((s) => {
      const due = getPaymentDueDate(s);
      return {
        'ID': s.id,
        'Supplier': s.supplier,
        'PO No': s.poNo,
        'PO Date': s.poDate || '',
        'Material': s.material,
        'Mode': getModeLabel(s),
        'Invoice No': s.invoiceNo,
        'Invoice Date': s.invoiceDate,
        'BL No': s.blNo,
        'BL Date': s.blDate,
        'BOE No': s.boeNo,
        'BOE Date': s.boeDate,
        'Port': s.portOfLoading,
        'Port of Landing': s.portOfLanding || '',
        'CHA': s.cha,
        'Country': s.country,
        'Document Status': s.documentStatus,
        'Payment Terms': getPaymentTermsLabel(s),
        'PRW Status': s.paymentStatus,
        'Payment Due Date': due ? toISODate(due) : 'N/A',
        'Bank Reference': s.bankReferenceNo || '',
        'Material Status': s.materialStatus,
        'Warehouse': s.warehouseName || '',
        'Date of Receipt': s.receiptDate || '',
        'Arrival Date': s.arrivedDate || '',
        'ETD': s.etd || '',
        'ETA': s.eta || '',
        'Lead Time': s.leadTime,
        'Documents Folder': s.docsFolderPath || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Shipments_${toISODate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported CSV successfully!');
  };

  const isEditing = editingId !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: "100%", margin: '0 auto', width: '100%' }}>
      <style>{PAGE_CSS}</style>

      {error && (
        <div role="alert" style={{ padding: '0.75rem 1rem', borderRadius: 8, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.12)' }}>
          Shipment data could not be loaded: {error}
        </div>
      )}
      {!ready && <div role="status">Loading shipments…</div>}

      {/* ── Top-Right Toast Notification ── */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '4.5rem',
            right: '1.5rem',
            zIndex: 10100,
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.75rem 1.25rem',
            borderRadius: 8,
            background: 'var(--accent-green)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 'var(--font-size-body)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            animation: 'fadeUp 0.3s ease',
          }}
        >
          <CheckCircle2 size={20} />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 8 }}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Header Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <Link
            href="/shipments"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              boxShadow: 'var(--card-shadow)',
            }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 style={{ fontSize: 'var(--font-size-section-heading)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            Shipment Management Portal
          </h1>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-secondary)',
            padding: '0.3rem',
            borderRadius: 10,
            border: '1px solid var(--border)',
            gap: '0.35rem',
          }}
        >
          {(
            [
              { id: 'entry', label: isEditing ? 'Edit Entry' : 'New Entry', icon: isEditing ? <Pencil size={16} /> : <Plus size={16} /> },
              { id: 'history', label: `History & Records (${shipments.length})`, icon: <TableIcon size={16} /> },
            ] as const
          ).map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 1.15rem',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-body-compact)',
                  fontFamily: 'inherit',
                  background: active ? 'var(--accent-blue)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: active ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: ENTRY / EDIT FORM
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'entry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {isEditing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '0.7rem 1rem',
                borderRadius: 10,
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid var(--accent-blue)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-body-compact)',
                fontWeight: 600,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pencil size={16} color="var(--accent-blue)" />
                Editing <strong>{editingId}</strong> — {formData.supplier || 'Untitled'}
              </span>
              <button type="button" onClick={cancelEdit} style={ghostButtonStyle}>
                Cancel edit
              </button>
            </div>
          )}

          {errorCount > 0 && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0.7rem 1rem',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid var(--accent-red)',
                color: 'var(--accent-red)',
                fontSize: 'var(--font-size-body-compact)',
                fontWeight: 700,
              }}
            >
              <AlertTriangle size={16} />
              {errorCount} field{errorCount > 1 ? 's need' : ' needs'} attention before this can be saved.
            </div>
          )}

          {masterDataError && (
            <div role="alert" style={{
              padding: '0.7rem 1rem', borderRadius: 10, background: 'rgba(239,68,68,0.12)',
              border: '1px solid var(--accent-red)', color: 'var(--accent-red)',
              fontSize: 'var(--font-size-body-compact)', fontWeight: 650,
            }}>
              {masterDataError} Check that the master tables are installed, then refresh this page.
            </div>
          )}

          <Section icon={<Building2 size={16} color="var(--accent-blue)" />} tint="#3b82f618" title="Supplier & Purchase Order">
            <div style={gridStyle}>
              <Field label="Supplier Name" required id="supplier" error={errors.supplier}>
                <SearchableSelect
                  ariaLabel="Supplier Name"
                  value={formData.supplier}
                  onChange={(value) => setField('supplier', value)}
                  options={masterSelectOptions('suppliers')}
                  placeholder="Search suppliers"
                  style={withError(inputStyle, errors.supplier)}
                />
                {!activeMasterNames('suppliers').length && <MasterSetupLink masterType="suppliers" />}
              </Field>

              <DocumentEntryFields
                title="Purchase Orders"
                numberLabel="PO number"
                dateLabel="PO date"
                id="poNo"
                count={documentCounts.poNo}
                minimum={1}
                required
                numberValues={splitDocumentValues(formData.poNo, documentCounts.poNo)}
                dateValues={splitDocumentValues(formData.poDate, documentCounts.poNo)}
                error={errors.poNo ?? errors.poDate}
                numberError={errors.poNo}
                dateRequired={paymentDueDateBasis === 'PO Date'}
                dateError={errors.poDate}
                onCountChange={(count) => changeDocumentCount('poNo', 'poDate', count, 1)}
                onNumberChange={(index, value) => updateDocumentValue('poNo', index, value)}
                onDateChange={(index, value) => updateDocumentValue('poDate', index, value)}
              />

              <Field label="PO Document Attachment">
                <FileUploadZone
                  docName={formData.poDocName}
                  onFileChange={(e) => handleFileSimulate('poDocName', e)}
                  placeholder="Upload PO PDF/Scanned Copy"
                />
              </Field>
            </div>
          </Section>

          <Section icon={<Receipt size={16} color="var(--accent-purple)" />} tint="#8b5cf618" title="Material Description & Commercial Invoice" delay={1}>
            <div style={gridStyle}>
              <Field label="Material / Product Description">
                <SearchableSelect
                  ariaLabel="Material / Product Description"
                  value={formData.material}
                  onChange={(value) => setField('material', value)}
                  options={masterSelectOptions('materials')}
                  placeholder="Search materials"
                  style={inputStyle}
                  allowCustom
                />
                {!activeMasterNames('materials').length && <MasterSetupLink masterType="materials" />}
              </Field>

              <DocumentEntryFields
                title="Invoices"
                numberLabel="Invoice number"
                dateLabel="Invoice date"
                id="invoiceNo"
                count={documentCounts.invoiceNo}
                minimum={1}
                required
                numberValues={splitDocumentValues(formData.invoiceNo, documentCounts.invoiceNo)}
                dateValues={splitDocumentValues(formData.invoiceDate, documentCounts.invoiceNo)}
                error={errors.invoiceNo ?? errors.invoiceDate}
                numberError={errors.invoiceNo}
                dateRequired={paymentDueDateBasis === 'Invoice Date'}
                dateError={errors.invoiceDate}
                onCountChange={(count) => changeDocumentCount('invoiceNo', 'invoiceDate', count, 1)}
                onNumberChange={(index, value) => updateDocumentValue('invoiceNo', index, value)}
                onDateChange={(index, value) => updateDocumentValue('invoiceDate', index, value)}
              />

              <Field label="Invoice Document File">
                <FileUploadZone
                  docName={formData.invoiceDocName}
                  onFileChange={(e) => handleFileSimulate('invoiceDocName', e)}
                  placeholder="Upload Vendor Invoice (PDF)"
                />
              </Field>
            </div>
          </Section>

          <Section icon={<Navigation size={16} color="var(--accent-teal)" />} tint="#06b6d418" title="Mode of Shipment & Freight Documents" delay={2}>
            <div style={gridStyle}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Mode of Shipment <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                <SearchableSelect
                  ariaLabel="Mode of Shipment"
                  value={formData.modeOfShipment}
                  onChange={(value) => setField('modeOfShipment', value as ShipmentMode)}
                  options={masterSelectOptions('modes')}
                  placeholder="Search shipment modes"
                  style={selectStyle}
                />
                {!activeMasterNames('modes').length && <MasterSetupLink masterType="modes" />}
                {errors.modeOfShipment && <div style={{ ...errorTextStyle }}>{errors.modeOfShipment}</div>}
              </div>

              <Field label="Port of Loading / Airport">
                <SearchableSelect
                  ariaLabel="Port of Loading / Airport"
                  value={formData.portOfLoading}
                  onChange={(value) => setField('portOfLoading', value)}
                  options={masterSelectOptions('ports')}
                  placeholder="Search ports"
                  style={inputStyle}
                />
              </Field>

              <Field label="Port of Landing">
                <SearchableSelect
                  ariaLabel="Port of Landing"
                  value={formData.portOfLanding}
                  onChange={(value) => setField('portOfLanding', value)}
                  options={masterSelectOptions('ports')}
                  placeholder="Search ports"
                  style={inputStyle}
                />
              </Field>

              <DocumentEntryFields
                title="Bills of Lading (BL)"
                numberLabel="BL number"
                dateLabel="BL date"
                id="blNo"
                count={documentCounts.blNo}
                minimum={0}
                numberValues={splitDocumentValues(formData.blNo === 'BL-PENDING' ? '' : formData.blNo, documentCounts.blNo)}
                dateValues={splitDocumentValues(formData.blDate, documentCounts.blNo)}
                error={errors.blNo ?? errors.blDate}
                numberError={errors.blNo}
                dateRequired={paymentDueDateBasis === 'BL Date'}
                dateError={errors.blDate}
                onCountChange={(count) => changeDocumentCount('blNo', 'blDate', count, 0)}
                onNumberChange={(index, value) => updateDocumentValue('blNo', index, value)}
                onDateChange={(index, value) => updateDocumentValue('blDate', index, value)}
              />

              <Field label="BL Document File">
                <FileUploadZone
                  docName={formData.blDocName}
                  onFileChange={(e) => handleFileSimulate('blDocName', e)}
                  placeholder="Upload BL Document (PDF)"
                />
              </Field>

              {/* MAWB Field + Attachment */}
              <Field label="MAWB (Master Air Waybill)">
                <input
                  type="text"
                  placeholder="e.g. 157-82749103"
                  value={formData.mawb}
                  onChange={(e) => setField('mawb', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="MAWB Document Attachment">
                <FileUploadZone
                  docName={formData.mawbDocName}
                  onFileChange={(e) => handleFileSimulate('mawbDocName', e)}
                  placeholder="Upload MAWB Attachment (PDF)"
                />
              </Field>

              {/* HAWB Field + Attachment */}
              <Field label="HAWB (House Air Waybill)">
                <input
                  type="text"
                  placeholder="e.g. HAWB-FRA-2026-99"
                  value={formData.hawb}
                  onChange={(e) => setField('hawb', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="HAWB Document Attachment">
                <FileUploadZone
                  docName={formData.hawbDocName}
                  onFileChange={(e) => handleFileSimulate('hawbDocName', e)}
                  placeholder="Upload HAWB Attachment (PDF)"
                />
              </Field>
            </div>
          </Section>

          <Section icon={<ShieldCheck size={16} color="var(--accent-green)" />} tint="#10b98118" title="Customs Clearance, BOE & CHA" delay={3}>
            <div style={gridStyle}>
              <Field label="Custom House Agent (CHA)">
                <SearchableSelect
                  ariaLabel="Custom House Agent (CHA)"
                  value={formData.cha}
                  onChange={(value) => setField('cha', value)}
                  options={masterSelectOptions('chas')}
                  placeholder="Search CHA agents"
                  style={inputStyle}
                />
                {!activeMasterNames('chas').length && <MasterSetupLink masterType="chas" />}
              </Field>

              <Field label="Document Status">
                <SearchableSelect
                  ariaLabel="Document Status"
                  value={formData.documentStatus}
                  onChange={(value) => setField('documentStatus', value as DocumentStatus)}
                  options={['Pending', 'Received', 'In Process', 'Completed'].map((value) => ({ value, label: value }))}
                  placeholder="Search document statuses"
                  style={selectStyle}
                />
              </Field>

              <Field label="Country of Origin">
                <SearchableSelect
                  ariaLabel="Country of Origin"
                  value={formData.country}
                  onChange={(value) => setField('country', value)}
                  options={masterSelectOptions('countries')}
                  placeholder="Search countries"
                  style={inputStyle}
                />
              </Field>

              <DocumentEntryFields
                title="Bills of Entry (BOE)"
                numberLabel="BOE number"
                dateLabel="BOE date"
                id="boeNo"
                count={documentCounts.boeNo}
                minimum={0}
                numberValues={splitDocumentValues(formData.boeNo === 'BOE-PENDING' ? '' : formData.boeNo, documentCounts.boeNo)}
                dateValues={splitDocumentValues(formData.boeDate, documentCounts.boeNo)}
                error={errors.boeNo ?? errors.boeDate}
                numberError={errors.boeNo}
                dateRequired={false}
                dateError={errors.boeDate}
                onCountChange={(count) => changeDocumentCount('boeNo', 'boeDate', count, 0)}
                onNumberChange={(index, value) => updateDocumentValue('boeNo', index, value)}
                onDateChange={(index, value) => updateDocumentValue('boeDate', index, value)}
              />

              <Field label="BOE Document Attachment">
                <FileUploadZone
                  docName={formData.boeDocName}
                  onFileChange={(e) => handleFileSimulate('boeDocName', e)}
                  placeholder="Upload BOE Customs Stamp (PDF)"
                />
              </Field>
            </div>
          </Section>

          <Section icon={<CreditCard size={16} color="var(--accent-orange)" />} tint="#f59e0b18" title="Payment Terms" delay={4}>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Payment Type</label>
                <div style={{ ...inputStyle, minHeight: 40, display: 'flex', alignItems: 'center' }}>
                  {selectedPaymentTerm?.payment_type === 'LC' ? 'LC' : 'Others'}
                </div>
              </div>

              <Field label="Payment Terms" required id="paymentTerms" error={errors.paymentTerms}>
                <SearchableSelect
                  ariaLabel="Payment Terms"
                  value={formData.paymentTermChoice}
                  onChange={(value) => {
                    setField('paymentTermChoice', value);
                    const selectedTerm = activeMasterNames('payment-terms').find((entry) => entry.name === value);
                    setField('paymentType', selectedTerm?.payment_type === 'LC' ? 'LC' : 'Others');
                  }}
                  options={masterSelectOptions('payment-terms')}
                  placeholder="Search payment terms"
                  style={withError(selectStyle, errors.paymentTerms)}
                />
                {!activeMasterNames('payment-terms').length && <MasterSetupLink masterType="payment-terms" />}
              </Field>

              {paymentDueDateBasis === 'Receipt Date' && (
                <Field label="Date of Receipt" required id="receiptDate" error={errors.receiptDate}>
                  <DateField
                    value={formData.receiptDate}
                    onChange={(value) => setField('receiptDate', value)}
                    invalid={!!errors.receiptDate}
                  />
                </Field>
              )}

              <Field
                label="Bank Reference Number"
                required={formData.paymentType === 'LC'}
                id="bankReferenceNo"
                error={errors.bankReferenceNo}
              >
                <input
                  type="text"
                  placeholder="e.g. ICICI/FX/2026/08142"
                  value={formData.bankReferenceNo}
                  onChange={(e) => setField('bankReferenceNo', e.target.value)}
                  style={withError(inputStyle, errors.bankReferenceNo)}
                />
                <div style={hintStyle}>
                  {formData.paymentType === 'LC' ? 'Required for LC payments.' : 'Optional for this payment type.'}
                </div>
              </Field>

              <Field label="PRW / Payment Status" required id="paymentStatus" error={errors.paymentStatus}>
                <SearchableSelect
                  ariaLabel="PRW / Payment Status"
                  value={formData.paymentStatus}
                  onChange={(value) => setField('paymentStatus', value as PaymentStatus)}
                  options={masterSelectOptions('prw')}
                  placeholder="Search PRW / payment statuses"
                  style={selectStyle}
                />
                {!activeMasterNames('prw').length && <MasterSetupLink masterType="prw" />}
              </Field>

              {paymentDueDateBasis && creditDue && selectedPaymentTerms && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <InfoBox>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 'var(--font-size-body)' }}>
                      Calculated due date from payment terms
                    </div>
                    <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-compact)' }}>
                      {selectedPaymentTerms}: <strong>{formatDMY(creditBaseISO)}</strong>
                      {'  →  '}
                      Due date: <strong>{formatDMY(creditDue)}</strong>
                    </div>
                  </InfoBox>
                </div>
              )}
            </div>
          </Section>

          <Section icon={<Calendar size={16} color="var(--accent-blue)" />} tint="#3b82f618" title="Material Status, Arrival Date & Documents Link" delay={5}>
            <div style={gridStyle}>
              <Field label="Material Status">
                <SearchableSelect
                  ariaLabel="Material Status"
                  value={formData.materialStatus}
                  onChange={(value) => setField('materialStatus', value as MaterialStatus)}
                  options={['Pending Shipment', 'In Transit', 'At Port', 'Customs Clearance', 'Arrived'].map((value) => ({ value, label: value }))}
                  placeholder="Search material statuses"
                  style={selectStyle}
                />
              </Field>

              <Field label="Warehouse Name">
                <SearchableSelect
                  ariaLabel="Warehouse Name"
                  value={formData.warehouseName}
                  onChange={(value) => setField('warehouseName', value)}
                  options={masterSelectOptions('warehouses')}
                  placeholder="Search warehouses"
                  style={inputStyle}
                />
              </Field>

              {formData.materialStatus === 'Arrived' ? (
                <Field label="Arrival Date" required id="arrivedDate" error={errors.arrivedDate}>
                  <DateField
                    value={formData.arrivedDate}
                    onChange={(v) => setField('arrivedDate', v)}
                    invalid={!!errors.arrivedDate}
                  />
                </Field>
              ) : (
                <>
                  <Field label="ETD (Expected to Depart) — optional">
                    <DateField value={formData.etd} onChange={(v) => setField('etd', v)} />
                  </Field>
                  <Field label="ETA (Expected to Arrive) — optional">
                    <DateField value={formData.eta} onChange={(v) => setField('eta', v)} />
                  </Field>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <InfoBox>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 'var(--font-size-body)' }}>
                        {formatEtdEta(formData)}
                      </div>
                      <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 'var(--font-size-compact)' }}>
                        {getDocumentRemark(formData.documentStatus)}
                      </div>
                    </InfoBox>
                  </div>
                </>
              )}

              <Field label="Lead Time (Days)">
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={formData.leadTime}
                  onChange={(e) => setField('leadTime', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Documents Folder (server managed)" span>
                <input
                  type="text"
                  placeholder="Assigned when the shipment is saved"
                  value={formData.link}
                  readOnly
                  style={inputStyle}
                />
                <div style={hintStyle}>Uploaded documents are stored in this server-managed folder.</div>
              </Field>
            </div>
          </Section>

          {/* ── Updated Bottom Action Bar (Clear, Preview, Save) ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: '0.875rem',
              padding: '1.25rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <button type="button" onClick={handleClearForm} style={ghostButtonStyle}>
              <RotateCcw size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={handlePreview}
              style={{
                ...ghostButtonStyle,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Eye size={18} color="var(--accent-blue)" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={handleInitiateSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.75rem',
                borderRadius: 8,
                background: 'var(--accent-blue)',
                border: 'none',
                color: '#ffffff',
                fontSize: 'var(--font-size-body)',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                fontFamily: 'inherit',
              }}
            >
              <Save size={18} />
              <span>{isEditing ? 'Update' : 'Save'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: HISTORY & EXPORT
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card fade-up" style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.45rem 0.75rem',
                  minWidth: 320,
                  flex: 1,
                }}
              >
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search by supplier, PO, Invoice, BL, material, country..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-body-compact)',
                    fontFamily: 'inherit',
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.5rem 0.875rem',
                    borderRadius: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-compact)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  title="Export filtered records to standard CSV"
                >
                  <Download size={14} color="var(--accent-purple)" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    background: 'var(--accent-green)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 'var(--font-size-compact)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 3px 10px rgba(16,185,129,0.3)',
                  }}
                  title="Export full Excel workbook (.xlsx)"
                >
                  <Download size={14} />
                  <span>Export Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.625rem',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.75rem',
              }}
            >
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Mode</label>
                <SearchableSelect
                  ariaLabel="Filter by mode"
                  value={filterMode}
                  onChange={setFilterMode}
                  placeholder="Search modes"
                  options={[{ value: 'all', label: 'All Modes' }, ...Array.from(new Set(shipments.map((shipment) => shipment.modeOfShipment)))
                    .sort((left, right) => left.localeCompare(right))
                    .map((mode) => ({ value: mode, label: mode }))]}
                  style={filterSelectStyle}
                />
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>PRW Status</label>
                <SearchableSelect
                  ariaLabel="Filter by PRW status"
                  value={filterPayment}
                  onChange={setFilterPayment}
                  placeholder="Search PRW statuses"
                  options={[{ value: 'all', label: 'All PRW statuses' }, ...PAYMENT_STATUSES.map((value) => ({ value, label: value }))]}
                  style={filterSelectStyle}
                />
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Document Status</label>
                <SearchableSelect
                  ariaLabel="Filter by document status"
                  value={filterDocStatus}
                  onChange={setFilterDocStatus}
                  placeholder="Search document statuses"
                  options={['all', 'Pending', 'Received', 'In Process', 'Completed'].map((value) => ({
                    value,
                    label: value === 'all' ? 'All Document Statuses' : value,
                  }))}
                  style={filterSelectStyle}
                />
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Material Status</label>
                <SearchableSelect
                  ariaLabel="Filter by material status"
                  value={filterMaterialStatus}
                  onChange={setFilterMaterialStatus}
                  placeholder="Search material statuses"
                  options={['all', 'Pending Shipment', 'In Transit', 'At Port', 'Customs Clearance', 'Arrived'].map((value) => ({
                    value,
                    label: value === 'all' ? 'All Material Statuses' : value,
                  }))}
                  style={filterSelectStyle}
                />
              </div>
            </div>
          </div>

          <div className="card fade-up delay-1" style={{ padding: '1.125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: 'var(--font-size-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Shipment Register & Records ({filteredShipments.length} matching)
              </div>
              <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>Click View to open the full details</div>
            </div>

            <div
              style={{
                height: '800px',
                maxHeight: '800px',
                overflow: 'auto',
                width: '100%',
                position: 'relative',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  textAlign: 'left',
                  minWidth: 1350,
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '140px' }} />
                </colgroup>

                <thead>
                  <tr>
                    <th
                      style={{
                        position: 'sticky',
                        top: 0,
                        left: 0,
                        zIndex: 11,
                        background: 'var(--bg-secondary)',
                        borderBottom: '2px solid var(--border)',
                        padding: '0.75rem 0.85rem',
                        fontSize: 'var(--font-size-label)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
                        verticalAlign: 'middle',
                      }}
                    >
                      ID / Mode
                    </th>

                    {['Supplier & Country', 'PO & Invoice', 'BL / MAWB', 'BOE / CHA', 'Payment Terms & PRW', 'Material Status'].map((h) => (
                      <th
                        key={h}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                          background: 'var(--bg-secondary)',
                          borderBottom: '2px solid var(--border)',
                          padding: '0.75rem 0.85rem',
                          fontSize: 'var(--font-size-label)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                        }}
                      >
                        {h}
                      </th>
                    ))}

                    <th
                      style={{
                        position: 'sticky',
                        top: 0,
                        right: 0,
                        zIndex: 11,
                        background: 'var(--bg-secondary)',
                        borderBottom: '2px solid var(--border)',
                        padding: '0.75rem 0.85rem',
                        fontSize: 'var(--font-size-label)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        boxShadow: '-2px 0 5px rgba(0,0,0,0.05)',
                        verticalAlign: 'middle',
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShipments.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No shipment records match your search filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredShipments.map((item, idx) => {
                      const dueDate = getPaymentDueDate(item);
                      const period = getPaymentPeriod(item);
                      const isOverdue = !!dueDate && item.paymentStatus === 'NOT PAID' && (getDaysUntilDue(item) ?? 0) < 0;
                      const isSelected = item.id === selectedId;

                      const rowBg = isSelected
                        ? 'rgba(59,130,246,0.1)'
                        : idx % 2 === 1
                        ? 'var(--bg-secondary)'
                        : 'var(--bg-card)';

                      return (
                        <tr
                          key={item.id}
                          style={{
                            background: rowBg,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td
                            style={{
                              position: 'sticky',
                              left: 0,
                              zIndex: 2,
                              background: rowBg,
                              padding: '0.75rem 0.85rem',
                              whiteSpace: 'nowrap',
                              borderBottom: '1px solid var(--border)',
                              boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
                              verticalAlign: 'top',
                            }}
                          >
                            <div style={{ fontWeight: 800, color: 'var(--accent-blue)', fontSize: 'var(--font-size-body-compact)' }}>{item.id}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)' }}>
                              <ModeIcon mode={item.modeOfShipment} size={12} />
                              <span>{getModeLabel(item)}</span>
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-size-body-compact)' }}>{item.supplier}</div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>
                              {item.country} • {item.portOfLoading}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-compact)' }}>{item.invoiceNo}</div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>
                              PO: {item.poNo}
                              {item.poDate ? ` (${formatDMY(item.poDate)})` : ''}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-compact)' }}>
                              {item.blNo || item.mawb || '-'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>
                              BL Date: {formatDMY(item.blDate) || '-'}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-primary)', fontWeight: 600 }}>{item.boeNo || '-'}</div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>CHA: {item.cha}</div>
                          </td>

                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <PaymentBadge status={item.paymentStatus} />
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-primary)', fontWeight: 600, marginTop: 4 }}>
                              {getPaymentTermsLabel(item)}
                            </div>
                            {period && (
                              <div style={{ fontSize: 'var(--font-size-tiny)', color: isOverdue ? 'var(--accent-red)' : 'var(--text-muted)', marginTop: 2 }}>
                                {formatDMY(period.from)} → {formatDMY(period.to)}
                                {isOverdue && ' (Overdue)'}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <span
                              style={{
                                fontSize: 'var(--font-size-tiny)',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                display: 'inline-block',
                              }}
                            >
                              {item.materialStatus}
                            </span>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 4 }}>
                              {item.materialStatus === 'Arrived' ? (
                                <>Arrived : {formatDMY(item.arrivedDate) || '?'}</>
                              ) : (
                                <>
                                  {formatEtdEta(item)}
                                  <div>{getDocumentRemark(item.documentStatus)}</div>
                                </>
                              )}
                            </div>
                          </td>

                          <td
                            style={{
                              position: 'sticky',
                              right: 0,
                              zIndex: 2,
                              background: rowBg,
                              padding: '0.75rem 0.85rem',
                              whiteSpace: 'nowrap',
                              borderBottom: '1px solid var(--border)',
                              boxShadow: '-2px 0 5px rgba(0,0,0,0.05)',
                              verticalAlign: 'top',
                            }}
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <button type="button" onClick={() => setSelectedId(item.id)} style={rowButtonStyle} title="View complete shipment info">
                                <Eye size={13} color="var(--accent-blue)" />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                style={{ ...rowButtonStyle, padding: '0.3rem 0.45rem' }}
                                title="Edit shipment"
                                aria-label={`Edit ${item.id}`}
                              >
                                <Pencil size={13} color="var(--accent-orange)" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                style={{ ...rowButtonStyle, padding: '0.3rem 0.45rem' }}
                                title="Delete shipment"
                                aria-label={`Delete ${item.id}`}
                              >
                                <Trash2 size={13} color="var(--accent-red)" />
                              </button>
                              {item.link && (
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ ...rowButtonStyle, padding: '0.3rem 0.45rem', textDecoration: 'none' }}
                                  title="Open documents (PDF)"
                                  aria-label={`Open documents for ${item.id}`}
                                >
                                  <Paperclip size={13} color="var(--text-secondary)" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT-SIDE DETAILS DRAWER (Used for View & Preview)
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedShipment && (
        <ShipmentDrawer
          s={selectedShipment}
          isPreview={!!previewShipment}
          onClose={() => {
            setSelectedId(null);
            setPreviewShipment(null);
          }}
          onEdit={() => {
            if (previewShipment) {
              setPreviewShipment(null);
            } else {
              startEdit(selectedShipment);
            }
          }}
          onDelete={() => setDeleteTarget(selectedShipment)}
        />
      )}

      {/* Save Confirmation Dialog */}
      {showSaveConfirm && (
        <ConfirmDialog
          title={isEditing ? `Update Shipment ${editingId}?` : `Save Shipment ${nextShipmentId(shipments)}?`}
          message={`Are you sure you want to save this shipment record for ${formData.supplier || 'this supplier'}?`}
          confirmLabel={isEditing ? 'Confirm Update' : 'Confirm Save'}
          onCancel={() => setShowSaveConfirm(false)}
          onConfirm={handleConfirmSave}
          accentColor="var(--accent-blue)"
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.id}?`}
          message={`${deleteTarget.supplier} • ${deleteTarget.poNo} will be removed from history. This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          accentColor="var(--accent-red)"
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Drawer Component
═══════════════════════════════════════════════════════════════════════════ */
function ShipmentDrawer({
  s,
  isPreview,
  onClose,
  onEdit,
  onDelete,
}: {
  s: Shipment & { mawbDocument?: ShipmentDocument; hawbDocument?: ShipmentDocument };
  isPreview?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { fetchWithAuth } = useAuth();
  const [documentError, setDocumentError] = useState<string | null>(null);
  const due = getPaymentDueDate(s);
  const period = getPaymentPeriod(s);
  const daysLeft = getDaysUntilDue(s);

  const docs: { label: string; doc?: ShipmentDocument }[] = [
    { label: 'PO', doc: s.poDocument },
    { label: 'Invoice', doc: s.invoiceDocument },
    { label: 'BL', doc: s.blDocument },
    { label: 'MAWB', doc: s.mawbDocument },
    { label: 'HAWB', doc: s.hawbDocument },
    { label: 'BOE', doc: s.boeDocument },
  ];
  const attached = docs.filter((d) => d.doc);

  const openDocument = async (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    event.preventDefault();
    setDocumentError(null);
    const documentWindow = window.open('', '_blank');
    if (!documentWindow) {
      setDocumentError('Allow pop-ups to open this document.');
      return;
    }
    documentWindow.opener = null;
    try {
      const response = await fetchWithAuth(url);
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(
          detail && typeof detail.detail === 'string'
            ? detail.detail
            : 'Could not open this document.',
        );
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      documentWindow.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (openError) {
      documentWindow.close();
      setDocumentError(openError instanceof Error ? openError.message : 'Could not open this document.');
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, animation: 'sp-fade-in 0.2s ease' }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Shipment ${s.id} details`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '50vw',
          minWidth: 'min(100vw, 520px)',
          zIndex: 10001,
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sp-drawer-in 0.25s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'var(--font-size-section-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>{s.supplier || 'Unspecified Supplier'}</h2>
              <span style={{ fontSize: 'var(--font-size-compact)', background: 'var(--accent-blue)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                {isPreview ? `PREVIEW (${s.id})` : s.id}
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-muted)', marginTop: 4 }}>
              {s.material || 'No Material Specified'} • {getModeLabel(s)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!isPreview && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  style={{ ...rowButtonStyle, padding: '0.45rem 0.85rem', fontSize: 'var(--font-size-compact)', color: 'var(--text-primary)' }}
                >
                  <Pencil size={14} color="var(--accent-orange)" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  style={{
                    ...rowButtonStyle,
                    padding: '0.45rem 0.85rem',
                    fontSize: 'var(--font-size-compact)',
                    color: 'var(--accent-red)',
                    border: '1px solid var(--accent-red)',
                  }}
                >
                  <Trash2 size={14} color="var(--accent-red)" />
                  <span>Delete</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.4rem',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <TrackingProgress shipment={s} />

          <DetailGroup title="Supplier & Purchase Order">
            <Detail label="Supplier">{s.supplier || '-'}</Detail>
            <Detail label="Country of Origin">{s.country || '-'}</Detail>
            <Detail label="PO Number">{s.poNo || '-'}</Detail>
            <Detail label="PO Date">{formatDMY(s.poDate) || '-'}</Detail>
            <Detail label="Material">{s.material || '-'}</Detail>
          </DetailGroup>

          <DetailGroup title="Invoice">
            <Detail label="Invoice Number">{s.invoiceNo || '-'}</Detail>
            <Detail label="Invoice Date">{formatDMY(s.invoiceDate) || '-'}</Detail>
          </DetailGroup>

          <DetailGroup title="Shipping">
            <Detail label="Mode of Shipment">{getModeLabel(s)}</Detail>
            <Detail label="Port of Loading">{s.portOfLoading || '-'}</Detail>
            <Detail label="Port of Landing">{s.portOfLanding || '-'}</Detail>
            <Detail label="BL Number">{s.blNo || '-'}</Detail>
            <Detail label="BL Date">{formatDMY(s.blDate) || '-'}</Detail>
            <Detail label="MAWB">{s.mawb || '-'}</Detail>
            <Detail label="HAWB">{s.hawb || '-'}</Detail>
          </DetailGroup>

          <DetailGroup title="Customs">
            <Detail label="Custom House Agent">{s.cha || '-'}</Detail>
            <Detail label="Document Status">{s.documentStatus}</Detail>
            <Detail label="BOE Number">{s.boeNo || '-'}</Detail>
            <Detail label="BOE Date">{formatDMY(s.boeDate) || '-'}</Detail>
          </DetailGroup>

          <DetailGroup title="Payment">
            <Detail label="Payment Type">{s.paymentType}</Detail>
            <Detail label="Payment Terms">{getPaymentTermsLabel(s)}</Detail>
            <Detail label="PRW Status">
              <PaymentBadge status={s.paymentStatus} />
            </Detail>
            <Detail label="Bank Reference">{s.bankReferenceNo || '-'}</Detail>
            <Detail label="Date of Receipt">{formatDMY(s.receiptDate) || '-'}</Detail>
            {period && due && (
              <Detail label={`${s.creditDaysFrom} → Due Date`} wide>
                <span>
                  {formatDMY(period.from)} → <strong>{formatDMY(due)}</strong>
                </span>
                {s.paymentStatus === 'NOT PAID' && daysLeft !== null && (
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 'var(--font-size-compact)',
                      fontWeight: 700,
                      color: daysLeft < 0 ? 'var(--accent-red)' : daysLeft <= 7 ? 'var(--accent-orange)' : 'var(--accent-green)',
                    }}
                  >
                    {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                  </span>
                )}
              </Detail>
            )}
          </DetailGroup>

          <DetailGroup title="Material Status">
            <Detail label="Status">{s.materialStatus}</Detail>
            {s.materialStatus === 'Arrived' ? (
              <>
                <Detail label="Arrival Date">{formatDMY(s.arrivedDate) || '-'}</Detail>
                <Detail label="Warehouse Name">{s.warehouseName || '-'}</Detail>
              </>
            ) : (
              <Detail label="ETD / ETA" wide>
                <div>{formatEtdEta(s)}</div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 'var(--font-size-compact)' }}>
                  {getDocumentRemark(s.documentStatus)}
                </div>
              </Detail>
            )}
            <Detail label="Lead Time">{s.leadTime} days</Detail>
            <Detail label="Entered On">{formatDMY(s.createdAt) || '-'}</Detail>
          </DetailGroup>

          <DetailGroup title="Documents & Attachments">
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {attached.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No documents attached.</span>}

              {attached.map(({ label, doc }) => {
                const openable = doc && doc.url && doc.url !== '#';
                const chip = (
                  <span style={chipStyle}>
                    <FileText size={14} color="var(--accent-green)" />
                    <span>
                      {label}: {doc!.name}
                    </span>
                  </span>
                );
                return openable ? (
                  <a
                    key={label}
                    href={doc!.url}
                    onClick={(event) => void openDocument(event, doc!.url)}
                    style={{ textDecoration: 'none' }}
                  >
                    {chip}
                  </a>
                ) : (
                  <React.Fragment key={label}>{chip}</React.Fragment>
                );
              })}

            </div>
            {documentError && <div role="alert" style={{ gridColumn: '1 / -1', color: 'var(--accent-red)' }}>{documentError}</div>}
            {s.docsFolderPath && <Detail label="Stored folder">{s.docsFolderPath}</Detail>}
          </DetailGroup>
        </div>
      </aside>
    </>
  );
}

function TrackingProgress({ shipment }: { shipment: Shipment }) {
  const stages: { status: MaterialStatus; detail: string }[] = [
    { status: 'Pending Shipment', detail: shipment.portOfLoading || '—' },
    { status: 'In Transit', detail: getModeLabel(shipment) },
    { status: 'At Port', detail: shipment.portOfLanding || '—' },
    { status: 'Customs Clearance', detail: shipment.cha || '—' },
    { status: 'Arrived', detail: shipment.warehouseName || '—' },
  ];
  const currentIndex = stages.findIndex(({ status }) => status === shipment.materialStatus);

  return (
    <section
      aria-label="Shipment tracking progress"
      style={{
        padding: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--bg-secondary)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 'var(--font-size-label)', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
          Tracking Status
        </span>
        <span style={{ fontSize: 'var(--font-size-compact)', fontWeight: 700, color: 'var(--text-primary)' }}>
          {shipment.materialStatus}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <ol style={{ display: 'flex', listStyle: 'none', margin: 0, padding: '0 0 2px', minWidth: 460 }}>
          {stages.map(({ status, detail }, index) => {
            const completed = index < currentIndex;
            const current = index === currentIndex;
            const color = completed ? 'var(--accent-green)' : current ? 'var(--accent-blue)' : 'var(--border)';

            return (
              <li
                key={status}
                aria-current={current ? 'step' : undefined}
                style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}
              >
                {index < stages.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: '50%',
                      width: '100%',
                      height: 3,
                      background: index < currentIndex ? 'var(--accent-green)' : 'var(--border)',
                    }}
                  />
                )}
                <span
                  aria-hidden="true"
                  style={{
                    zIndex: 1,
                    width: 18,
                    height: 18,
                    boxSizing: 'border-box',
                    borderRadius: '50%',
                    border: `2px solid ${color}`,
                    background: completed || current ? color : 'var(--bg-card)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {completed ? '✓' : current ? index + 1 : ''}
                </span>
                <span
                  style={{
                    maxWidth: 86,
                    textAlign: 'center',
                    fontSize: 'var(--font-size-tiny)',
                    lineHeight: 1.25,
                    fontWeight: current || completed ? 700 : 500,
                    color: current ? 'var(--accent-blue)' : completed ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {status}
                </span>
                <span
                  title={detail}
                  style={{
                    maxWidth: 86,
                    textAlign: 'center',
                    fontSize: 'var(--font-size-tiny)',
                    lineHeight: 1.25,
                    color: 'var(--text-secondary)',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {detail}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div
        style={{
          fontSize: 'var(--font-size-label)',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--accent-blue)',
          paddingBottom: 6,
          marginBottom: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem 1rem' }}>{children}</div>
    </section>
  );
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ ...labelStyle, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-size-body-compact)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dialogs & UI Helpers
═══════════════════════════════════════════════════════════════════════════ */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  accentColor = 'var(--accent-blue)',
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  accentColor?: string;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 10200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'sp-fade-in 0.15s ease',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 440, width: '100%', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 12 }}
      >
        <div style={{ display: 'flex', gap: '0.85rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${accentColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Save size={18} color={accentColor} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</div>
            <div style={{ marginTop: 6, fontSize: 'var(--font-size-body-compact)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onCancel} style={ghostButtonStyle} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 8,
              background: accentColor,
              border: 'none',
              color: '#fff',
              fontSize: 'var(--font-size-body)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  tint,
  title,
  delay,
  children,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`card shipment-entry-section fade-up${delay ? ` delay-${delay}` : ''}`} style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.625rem' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function DocumentEntryFields({
  title,
  numberLabel,
  dateLabel,
  id,
  count,
  minimum,
  required = false,
  numberValues,
  dateValues,
  error,
  numberError,
  dateRequired,
  dateError,
  onCountChange,
  onNumberChange,
  onDateChange,
}: {
  title: string;
  numberLabel: string;
  dateLabel: string;
  id: string;
  count: number;
  minimum: number;
  required?: boolean;
  numberValues: string[];
  dateValues: string[];
  error?: string;
  numberError?: string;
  dateRequired: boolean;
  dateError?: string;
  onCountChange: (count: number) => void;
  onNumberChange: (index: number, value: string) => void;
  onDateChange: (index: number, value: string) => void;
}) {
  const maxNumberLength = numberLabel === 'BOE number' ? 40 : 80;
  return (
    <Field label={title} required={required} id={id} error={error} span>
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        Number of entries
        <input
          type="number"
          min={minimum}
          max={255}
          value={count}
          onChange={(event) => onCountChange(Number(event.target.value))}
          aria-label={`Number of ${title.toLowerCase()}`}
          style={{ ...inputStyle, width: 90 }}
        />
        {minimum === 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Optional</span>}
      </label>
      <div style={{ display: 'grid', gap: 8 }}>
        {numberValues.map((number, index) => (
          <div
            key={`${id}-${index}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}
          >
            <label style={labelStyle}>
              {numberLabel} {index + 1}{required && <span style={{ color: 'var(--accent-red)' }}> *</span>}
              <input
                type="text"
                maxLength={maxNumberLength}
                placeholder={`Enter ${numberLabel.toLowerCase()}`}
                value={number}
                aria-invalid={Boolean(numberError)}
                onChange={(event) => onNumberChange(index, event.target.value)}
                style={withError(inputStyle, numberError)}
              />
            </label>
            <label style={labelStyle}>
              {dateLabel} {index + 1}{dateRequired && <span style={{ color: 'var(--accent-red)' }}> *</span>}
              <input
                type="date"
                value={dateValues[index] ?? ''}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => onDateChange(index, event.target.value)}
                style={withError(inputStyle, dateError)}
              />
            </label>
          </div>
        ))}
        {count === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-compact)' }}>No entries added.</div>}
      </div>
    </Field>
  );
}

function Field({
  label,
  required,
  error,
  id,
  span,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  id?: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div id={id ? `field-${id}` : undefined} data-error={error ? 'true' : undefined} style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: 'var(--accent-red)' }}> *</span>}
      </label>
      {children}
      {error && <div style={errorTextStyle}>{error}</div>}
    </div>
  );
}

function DateField({
  value,
  onChange,
  invalid,
  allowMultiple = false,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  allowMultiple?: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={allowMultiple ? 'text' : 'date'}
        placeholder={allowMultiple ? 'YYYY-MM-DD or YYYY-MM-DD_YYYY-MM-DD' : undefined}
        autoComplete={allowMultiple ? 'off' : undefined}
        className="sp-date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={withError({ ...inputStyle, paddingRight: '2.6rem' }, invalid ? 'x' : undefined)}
      />
      {!allowMultiple && <Calendar
        size={16}
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '0.85rem',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: 'var(--text-secondary)',
        }}
      />}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string; icon?: React.ReactNode; color: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        background: 'var(--bg-secondary)',
        padding: '0.3rem',
        borderRadius: 10,
        border: '1px solid var(--border)',
      }}
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.25rem',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              fontSize: 'var(--font-size-body-compact)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: active ? o.color : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        borderRadius: 8,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderLeft: '4px solid var(--accent-blue)',
      }}
    >
      {children}
    </div>
  );
}

function ModeIcon({ mode, size }: { mode: ShipmentMode; size: number }) {
  const color = mode.toLowerCase().includes('sea')
    ? 'var(--accent-blue)'
    : mode.toLowerCase().includes('air')
      ? 'var(--accent-teal)'
      : 'var(--accent-purple)';
  return <Navigation size={size} color={color} />;
}

function creditBasisLabel(basis: string): 'Invoice Date' | 'BL Date' | 'PO Date' | 'Receipt Date' | null {
  const labels: Record<string, 'Invoice Date' | 'BL Date' | 'PO Date' | 'Receipt Date'> = {
    INVOICE_DATE: 'Invoice Date',
    BL_DATE: 'BL Date',
    PO_DATE: 'PO Date',
    RECEIPT_DATE: 'Receipt Date',
  };
  return labels[basis] ?? null;
}

function MasterSetupLink({ masterType }: { masterType: MasterType }) {
  return (
    <Link href={MASTER_PATHS[masterType]} style={{
      display: 'inline-block', marginTop: 4, color: 'var(--accent-blue)',
      fontSize: 'var(--font-size-compact)', fontWeight: 650, textDecoration: 'none',
    }}>
      Add {MASTER_LABELS[masterType]} master values
    </Link>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const color = status === 'PAID'
    ? 'var(--accent-green)'
    : status === 'NOT PAID'
      ? 'var(--accent-red)'
      : status === 'ADVANCE'
        ? 'var(--accent-blue)'
        : status === '2 WAY'
          ? 'var(--accent-purple)'
          : status === 'SR DATE'
            ? 'var(--accent-teal)'
            : 'var(--accent-orange)';
  const bg = status === 'PAID'
    ? 'rgba(16,185,129,0.18)'
    : status === 'NOT PAID'
      ? 'rgba(239,68,68,0.18)'
      : status === 'ADVANCE'
        ? 'rgba(59,130,246,0.18)'
        : status === '2 WAY'
          ? 'rgba(139,92,246,0.18)'
          : status === 'SR DATE'
            ? 'rgba(6,182,212,0.18)'
            : 'rgba(245,158,11,0.18)';
  return (
    <span style={{ fontSize: 'var(--font-size-tiny)', fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: bg, color }}>
      {status}
    </span>
  );
}

function FileUploadZone({
  docName,
  onFileChange,
  placeholder,
}: {
  docName: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.55rem 0.85rem',
        background: 'var(--bg-secondary)',
        border: docName ? '1px solid var(--accent-green)' : '1px dashed var(--border)',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease',
        overflow: 'hidden',
      }}
    >
      <input type="file" onChange={onFileChange} style={{ display: 'none' }} />
      {docName ? (
        <>
          <FileText size={16} color="var(--accent-green)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--accent-green)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {docName}
          </span>
        </>
      ) : (
        <>
          <UploadCloud size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {placeholder}
          </span>
        </>
      )}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared styles
═══════════════════════════════════════════════════════════════════════════ */
const PAGE_CSS = `
.sp-date { position: relative; }
.sp-date::-webkit-calendar-picker-indicator {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  width: auto; height: auto; margin: 0; padding: 0;
  opacity: 0; cursor: pointer;
}
@keyframes sp-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes sp-fade-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  @keyframes sp-drawer-in { from { opacity: 0; } to { opacity: 1; } }
}
`;

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-label)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  marginBottom: '0.35rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.85rem',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 'var(--font-size-body)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

const filterSelectStyle: React.CSSProperties = {
  ...selectStyle,
  padding: '0.4rem 0.6rem',
  fontSize: 'var(--font-size-compact)',
};

function withError(base: React.CSSProperties, error?: string): React.CSSProperties {
  return error ? { ...base, border: '1px solid var(--accent-red)' } : base;
}

const errorTextStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 'var(--font-size-compact)',
  fontWeight: 600,
  color: 'var(--accent-red)',
};

const hintStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 'var(--font-size-compact)',
  color: 'var(--text-muted)',
};

const ghostButtonStyle: React.CSSProperties = {
  padding: '0.65rem 1.25rem',
  borderRadius: 8,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-body)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const rowButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '0.3rem 0.6rem',
  borderRadius: 6,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-tiny)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '0.4rem 0.7rem',
  borderRadius: 8,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-compact)',
  fontWeight: 600,
};