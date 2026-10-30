'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Shipment Entry & History Portal
   - New Entry / Edit Entry form
       • Mode of shipment: Sea, Air or Others (type the mode when Others)
       • Payment: LC needs a bank reference; credit days counted from
         Invoice Date, BL Date or PO Date, with the date range shown
       • Material status: Arrived -> arrival date; otherwise optional ETD / ETA
       • Link = PDF / document link (not a tracking link)
   - History & Records table with search, filters, Excel / CSV export
   - Row details open in a right-side drawer (50% width, 100% height) with
     Edit and Delete
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
  Ship,
  Plane,
  Package,
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
  ExternalLink,
  Table as TableIcon,
  Plus,
  Pencil,
  Trash2,
  Paperclip,
  AlertTriangle,
  Truck,
} from 'lucide-react';

import {
  Shipment,
  ShipmentDocument,
  ShipmentMode,
  PaymentType,
  PaymentStatus,
  CreditDaysFrom,
  DocumentStatus,
  MaterialStatus,
} from '@/types/shipment';
import {
  addDaysToISO,
  formatDMY,
  formatEtdEta,
  getDaysUntilDue,
  getDocumentRemark,
  getModeLabel,
  getPaymentBaseISO,
  getPaymentDueDate,
  getPaymentPeriod,
  getPaymentTermsLabel,
  nextShipmentId,
  toISODate,
} from '@/data/shipmentData';
import { useShipments } from '@/hooks/useShipments';

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
  blNo: '',
  blDate: '',
  blDocName: '',
  mawb: '',
  hawb: '',
  cha: '',
  documentStatus: 'Pending' as DocumentStatus,
  modeOfShipment: 'Sea' as ShipmentMode,
  otherModeDetail: '',
  boeNo: '',
  boeDate: '',
  boeDocName: '',
  country: '',
  paymentType: 'Others' as PaymentType,
  bankReferenceNo: '',
  useCreditDays: false,
  creditDays: '',
  creditDaysFrom: 'Invoice Date' as CreditDaysFrom,
  paymentStatus: 'NOT PAID' as PaymentStatus,
  materialStatus: 'In Transit' as MaterialStatus,
  arrivedDate: '',
  etd: '',
  eta: '',
  link: '',
  leadTime: '45',
};
type FormState = typeof emptyForm;

function shipmentToForm(s: Shipment): FormState {
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
    blNo: s.blNo,
    blDate: s.blDate,
    blDocName: s.blDocument?.name ?? '',
    mawb: s.mawb,
    hawb: s.hawb,
    cha: s.cha,
    documentStatus: s.documentStatus,
    modeOfShipment: s.modeOfShipment,
    otherModeDetail: s.otherModeDetail ?? '',
    boeNo: s.boeNo,
    boeDate: s.boeDate,
    boeDocName: s.boeDocument?.name ?? '',
    country: s.country,
    paymentType: s.paymentType,
    bankReferenceNo: s.bankReferenceNo,
    useCreditDays: s.creditDays != null,
    creditDays: s.creditDays != null ? String(s.creditDays) : '',
    creditDaysFrom: s.creditDaysFrom ?? 'Invoice Date',
    paymentStatus: s.paymentStatus,
    materialStatus: s.materialStatus,
    arrivedDate: s.arrivedDate ?? '',
    etd: s.etd,
    eta: s.eta,
    link: s.link,
    leadTime: String(s.leadTime),
  };
}

function formToShipment(f: FormState, id: string, createdAt: string, prev?: Shipment): Shipment {
  const doc = (name: string, existing?: ShipmentDocument): ShipmentDocument | undefined =>
    !name ? undefined : existing && existing.name === name ? existing : { name, url: '#', type: 'pdf' };

  const days = f.useCreditDays ? parseInt(f.creditDays, 10) : null;

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
    portOfLoading: f.portOfLoading.trim() || 'Origin Port',
    blNo: f.blNo.trim() || 'BL-PENDING',
    blDate: f.blDate,
    blDocument: doc(f.blDocName, prev?.blDocument),
    mawb: f.mawb.trim(),
    hawb: f.hawb.trim(),
    cha: f.cha.trim() || 'In-House Clearance',
    documentStatus: f.documentStatus,
    modeOfShipment: f.modeOfShipment,
    otherModeDetail: f.modeOfShipment === 'Others' ? f.otherModeDetail.trim() : undefined,
    boeNo: f.boeNo.trim() || 'BOE-PENDING',
    boeDate: f.boeDate,
    boeDocument: doc(f.boeDocName, prev?.boeDocument),
    country: f.country.trim() || 'International',
    paymentType: f.paymentType,
    creditDays: days,
    creditDaysFrom: days != null ? f.creditDaysFrom : null,
    paymentStatus: f.paymentStatus,
    bankReferenceNo: f.bankReferenceNo.trim(),
    materialStatus: f.materialStatus,
    arrivedDate: f.materialStatus === 'Arrived' ? f.arrivedDate : undefined,
    etd: f.etd,
    eta: f.eta,
    link: f.link.trim(),
    leadTime: parseInt(f.leadTime, 10) || 45,
    createdAt,
  };
}

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.supplier.trim()) e.supplier = 'Supplier name is required';
  if (!f.poNo.trim()) e.poNo = 'PO number is required';
  if (!f.invoiceNo.trim()) e.invoiceNo = 'Invoice number is required';

  if (f.modeOfShipment === 'Others' && !f.otherModeDetail.trim()) {
    e.otherModeDetail = 'Enter the mode of shipment';
  }

  if (f.paymentType === 'LC' && !f.bankReferenceNo.trim()) {
    e.bankReferenceNo = 'Bank reference is required for LC';
  }

  if (f.useCreditDays) {
    const n = Number(f.creditDays);
    if (!Number.isInteger(n) || n <= 0) e.creditDays = 'Enter the number of days';
    if (!getPaymentBaseISO(f)) {
      e.creditDaysFrom = `Enter the ${f.creditDaysFrom} above to calculate the due date`;
    }
  }

  if (f.materialStatus === 'Arrived' && !f.arrivedDate) {
    e.arrivedDate = 'Select the arrival date';
  }
  return e;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════════ */
export default function ShipmentEntryAndHistoryPage() {
  const { shipments, addShipment, updateShipment, deleteShipment } = useShipments();

  const [activeTab, setActiveTab] = useState<'entry' | 'history'>('entry');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [showErrors, setShowErrors] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null);

  // History filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterDocStatus, setFilterDocStatus] = useState('all');
  const [filterMaterialStatus, setFilterMaterialStatus] = useState('all');

  const selectedShipment = useMemo(
    () => shipments.find((s) => s.id === selectedId) ?? null,
    [shipments, selectedId],
  );

  const errors = useMemo(() => (showErrors ? validate(formData) : {}), [showErrors, formData]);
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'history') {
      setActiveTab('history');
    }
  }, []);

  useEffect(() => {
    if (!selectedId && !deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget) setDeleteTarget(null);
      else setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedId, deleteTarget]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSimulate = (
    field: 'poDocName' | 'invoiceDocName' | 'blDocName' | 'boeDocName',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setField(field, fileName);
      showToast(`Attached document: ${fileName}`);
    }
  };

  const startEdit = (s: Shipment) => {
    setEditingId(s.id);
    setFormData(shipmentToForm(s));
    setShowErrors(false);
    setSelectedId(null);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowErrors(false);
    setActiveTab('history');
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    deleteShipment(id);
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) {
      setEditingId(null);
      setFormData(emptyForm);
    }
    setDeleteTarget(null);
    showToast(`Shipment ${id} deleted`);
  };

  const handleResetForm = () => {
    setFormData(emptyForm);
    setShowErrors(false);
  };

  const handleSubmit = (stayOnPage = false) => {
    const errs = validate(formData);
    if (Object.keys(errs).length > 0) {
      setShowErrors(true);
      setTimeout(() => {
        document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    if (editingId) {
      const prev = shipments.find((s) => s.id === editingId);
      if (!prev) {
        setEditingId(null);
        showToast('That shipment no longer exists.');
        return;
      }
      const updated = formToShipment(formData, prev.id, prev.createdAt, prev);
      updateShipment(updated);
      showToast(`Shipment ${updated.id} updated`);
      setEditingId(null);
      setFormData(emptyForm);
      setShowErrors(false);
      setActiveTab('history');
      return;
    }

    const record = formToShipment(formData, nextShipmentId(shipments), toISODate(new Date()));
    addShipment(record);
    showToast(`Shipment ${record.id} recorded in history!`);
    setFormData(emptyForm);
    setShowErrors(false);
    if (!stayOnPage) setActiveTab('history');
  };

  const creditDaysNum = parseInt(formData.creditDays, 10);
  const creditBaseISO = getPaymentBaseISO(formData);
  const creditDue = creditDaysNum > 0 ? addDaysToISO(creditBaseISO, creditDaysNum) : null;

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
        (item.otherModeDetail ?? '').toLowerCase().includes(q);

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
        'MAWB': s.mawb || '-',
        'HAWB': s.hawb || '-',
        'CHA Agent': s.cha,
        'Country': s.country,
        'BOE Number': s.boeNo,
        'BOE Date': s.boeDate,
        'Document Status': s.documentStatus,
        'Payment Type': s.paymentType,
        'Payment Terms': getPaymentTermsLabel(s),
        'Payment Status': s.paymentStatus,
        'Payment Due Date': due ? toISODate(due) : 'N/A',
        'Bank Reference': s.bankReferenceNo || '-',
        'Material Status': s.materialStatus,
        'Arrival Date': s.arrivedDate || '',
        'ETD': s.etd || '',
        'ETA': s.eta || '',
        'Lead Time (Days)': s.leadTime,
        'Documents Link': s.link || '-',
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
        'CHA': s.cha,
        'Country': s.country,
        'Document Status': s.documentStatus,
        'Payment Terms': getPaymentTermsLabel(s),
        'Payment Status': s.paymentStatus,
        'Payment Due Date': due ? toISODate(due) : 'N/A',
        'Bank Reference': s.bankReferenceNo || '',
        'Material Status': s.materialStatus,
        'Arrival Date': s.arrivedDate || '',
        'ETD': s.etd || '',
        'ETA': s.eta || '',
        'Lead Time': s.leadTime,
        'Documents Link': s.link || '',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <style>{PAGE_CSS}</style>

      {/* ── Toast ── */}
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

      {/* ── Top header bar ── */}
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

          <Section icon={<Building2 size={16} color="var(--accent-blue)" />} tint="#3b82f618" title="Supplier & Purchase Order">
            <div style={gridStyle}>
              <Field label="Supplier Name" required id="supplier" error={errors.supplier}>
                <input
                  type="text"
                  placeholder="e.g. Bosch GmbH, Siemens AG, ABB Ltd"
                  value={formData.supplier}
                  onChange={(e) => setField('supplier', e.target.value)}
                  style={withError(inputStyle, errors.supplier)}
                />
              </Field>

              <Field label="PO Number" required id="poNo" error={errors.poNo}>
                <input
                  type="text"
                  placeholder="e.g. PO/2026/04-0187"
                  value={formData.poNo}
                  onChange={(e) => setField('poNo', e.target.value)}
                  style={withError(inputStyle, errors.poNo)}
                />
              </Field>

              <Field label="PO Date" id="poDate">
                <DateField value={formData.poDate} onChange={(v) => setField('poDate', v)} />
              </Field>

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
                <input
                  type="text"
                  placeholder="e.g. Hydraulic Actuators, Silicon Carbide Grit"
                  value={formData.material}
                  onChange={(e) => setField('material', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Invoice Number" required id="invoiceNo" error={errors.invoiceNo}>
                <input
                  type="text"
                  placeholder="e.g. INV-BOSCH-2026-0412"
                  value={formData.invoiceNo}
                  onChange={(e) => setField('invoiceNo', e.target.value)}
                  style={withError(inputStyle, errors.invoiceNo)}
                />
              </Field>

              <Field label="Invoice Date">
                <DateField value={formData.invoiceDate} onChange={(v) => setField('invoiceDate', v)} />
              </Field>

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
                <label style={labelStyle}>Mode of Shipment</label>
                <Segmented<ShipmentMode>
                  value={formData.modeOfShipment}
                  onChange={(v) => setField('modeOfShipment', v)}
                  options={[
                    { id: 'Sea', label: 'Sea Freight', icon: <Ship size={16} />, color: 'var(--accent-blue)' },
                    { id: 'Air', label: 'Air Cargo', icon: <Plane size={16} />, color: 'var(--accent-teal)' },
                    { id: 'Others', label: 'Others', icon: <Package size={16} />, color: 'var(--accent-purple)' },
                  ]}
                />
              </div>

              {formData.modeOfShipment === 'Others' && (
                <Field label="Specify Mode of Shipment" required id="otherModeDetail" error={errors.otherModeDetail}>
                  <input
                    type="text"
                    placeholder="e.g. Courier, Road / Truck, Rail, Hand carry"
                    value={formData.otherModeDetail}
                    onChange={(e) => setField('otherModeDetail', e.target.value)}
                    style={withError(inputStyle, errors.otherModeDetail)}
                    autoFocus
                  />
                </Field>
              )}

              <Field label="Port of Loading / Airport">
                <input
                  type="text"
                  placeholder="e.g. Hamburg, Rotterdam, Shanghai"
                  value={formData.portOfLoading}
                  onChange={(e) => setField('portOfLoading', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Bill of Lading (BL) No">
                <input
                  type="text"
                  placeholder="e.g. MAEU726491835, HLCU835720194"
                  value={formData.blNo}
                  onChange={(e) => setField('blNo', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="BL Date">
                <DateField value={formData.blDate} onChange={(v) => setField('blDate', v)} />
              </Field>

              <Field label="BL Document File">
                <FileUploadZone
                  docName={formData.blDocName}
                  onFileChange={(e) => handleFileSimulate('blDocName', e)}
                  placeholder="Upload BL Document (PDF)"
                />
              </Field>

              <Field label="MAWB (Master Air Waybill)">
                <input
                  type="text"
                  placeholder="e.g. 157-82749103"
                  value={formData.mawb}
                  onChange={(e) => setField('mawb', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="HAWB (House Air Waybill)">
                <input
                  type="text"
                  placeholder="e.g. HAWB-FRA-2026-99"
                  value={formData.hawb}
                  onChange={(e) => setField('hawb', e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </Section>

          <Section icon={<ShieldCheck size={16} color="var(--accent-green)" />} tint="#10b98118" title="Customs Clearance, BOE & CHA" delay={3}>
            <div style={gridStyle}>
              <Field label="Custom House Agent (CHA)">
                <input
                  type="text"
                  placeholder="e.g. Kuehne + Nagel India, DHL Global Forwarding"
                  value={formData.cha}
                  onChange={(e) => setField('cha', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Document Status">
                <select
                  value={formData.documentStatus}
                  onChange={(e) => setField('documentStatus', e.target.value as DocumentStatus)}
                  style={selectStyle}
                >
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                  <option value="In Process">In Process</option>
                  <option value="Completed">Completed</option>
                </select>
              </Field>

              <Field label="Country of Origin">
                <input
                  type="text"
                  placeholder="e.g. Germany, Japan, United States, Italy"
                  value={formData.country}
                  onChange={(e) => setField('country', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="BOE (Bill of Entry) Number">
                <input
                  type="text"
                  placeholder="e.g. BOE/2026/3847291"
                  value={formData.boeNo}
                  onChange={(e) => setField('boeNo', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="BOE Date">
                <DateField value={formData.boeDate} onChange={(v) => setField('boeDate', v)} />
              </Field>

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
                <Segmented<PaymentType>
                  value={formData.paymentType}
                  onChange={(v) => setField('paymentType', v)}
                  options={[
                    { id: 'LC', label: 'LC', icon: <FileText size={16} />, color: 'var(--accent-orange)' },
                    { id: 'Others', label: 'Others', icon: <Truck size={16} />, color: 'var(--accent-blue)' },
                  ]}
                />
              </div>

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

              <div>
                <label style={labelStyle}>Payment Status (PRW / Settlement)</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: 4 }}>
                  {(
                    [
                      { id: 'PAID', label: 'PAID', color: 'var(--accent-green)' },
                      { id: 'NOT PAID', label: 'NOT PAID', color: 'var(--accent-red)' },
                      { id: 'PARTIAL', label: 'PARTIAL', color: 'var(--accent-orange)' },
                    ] as const
                  ).map((s) => {
                    const active = formData.paymentStatus === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setField('paymentStatus', s.id)}
                        style={{
                          flex: 1,
                          padding: '0.55rem 0.6rem',
                          borderRadius: 8,
                          fontSize: 'var(--font-size-compact)',
                          fontWeight: 700,
                          border: active ? `2px solid ${s.color}` : '1px solid var(--border)',
                          background: active ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'var(--bg-secondary)',
                          color: active ? s.color : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-body)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.useCreditDays}
                    onChange={(e) => setField('useCreditDays', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                  />
                  <span>Payment is due after a number of days</span>
                </label>
              </div>

              {formData.useCreditDays && (
                <>
                  <Field label="Number of Days" required id="creditDays" error={errors.creditDays}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="e.g. 40"
                      value={formData.creditDays}
                      onChange={(e) => setField('creditDays', e.target.value)}
                      style={withError(inputStyle, errors.creditDays)}
                    />
                  </Field>

                  <Field label="Count Days From" id="creditDaysFrom" error={errors.creditDaysFrom}>
                    <Segmented<CreditDaysFrom>
                      value={formData.creditDaysFrom}
                      onChange={(v) => setField('creditDaysFrom', v)}
                      options={[
                        { id: 'Invoice Date', label: 'Invoice Date', color: 'var(--accent-blue)' },
                        { id: 'BL Date', label: 'BL Date', color: 'var(--accent-blue)' },
                        { id: 'PO Date', label: 'PO Date', color: 'var(--accent-blue)' },
                      ]}
                    />
                  </Field>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <InfoBox>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 'var(--font-size-body)' }}>
                        {creditDaysNum > 0 ? creditDaysNum : '—'} days from {formData.creditDaysFrom}
                      </div>
                      {creditDue ? (
                        <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-compact)' }}>
                          {formData.creditDaysFrom}: <strong>{formatDMY(creditBaseISO)}</strong>
                          {'  →  '}
                          Due date: <strong>{formatDMY(creditDue)}</strong>
                        </div>
                      ) : (
                        <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 'var(--font-size-compact)' }}>
                          {creditBaseISO
                            ? 'Enter the number of days to see the due date.'
                            : `Enter the ${formData.creditDaysFrom} above to see the due date.`}
                        </div>
                      )}
                    </InfoBox>
                  </div>
                </>
              )}
            </div>
          </Section>

          <Section icon={<Calendar size={16} color="var(--accent-blue)" />} tint="#3b82f618" title="Material Status, Arrival Date & Documents Link" delay={5}>
            <div style={gridStyle}>
              <Field label="Material Status">
                <select
                  value={formData.materialStatus}
                  onChange={(e) => setField('materialStatus', e.target.value as MaterialStatus)}
                  style={selectStyle}
                >
                  <option value="Pending Shipment">Pending Shipment</option>
                  <option value="In Transit">In Transit</option>
                  <option value="At Port">At Port</option>
                  <option value="Customs Clearance">Customs Clearance</option>
                  <option value="Arrived">Arrived</option>
                </select>
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

              <Field label="Documents Link (PDF)" span>
                <input
                  type="url"
                  placeholder="https://…/shipment-documents.pdf"
                  value={formData.link}
                  onChange={(e) => setField('link', e.target.value)}
                  style={inputStyle}
                />
                <div style={hintStyle}>Link to the PDF / document folder for this shipment. This is not a tracking link.</div>
              </Field>
            </div>
          </Section>

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
            {isEditing ? (
              <button type="button" onClick={cancelEdit} style={ghostButtonStyle}>
                Cancel Edit
              </button>
            ) : (
              <>
                <button type="button" onClick={handleResetForm} style={ghostButtonStyle}>
                  Reset Fields
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  style={{ ...ghostButtonStyle, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700 }}
                >
                  Save & Add Another
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleSubmit(false)}
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
              <span>{isEditing ? 'Update Shipment' : 'Save & View History'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: HISTORY & EXPORT
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Search + export + filters */}
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
                <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} style={filterSelectStyle}>
                  <option value="all">All Modes</option>
                  <option value="Sea">Sea Freight</option>
                  <option value="Air">Air Cargo</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Payment Status</label>
                <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} style={filterSelectStyle}>
                  <option value="all">All Payment Statuses</option>
                  <option value="PAID">PAID</option>
                  <option value="NOT PAID">NOT PAID</option>
                  <option value="PARTIAL">PARTIAL</option>
                </select>
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Document Status</label>
                <select value={filterDocStatus} onChange={(e) => setFilterDocStatus(e.target.value)} style={filterSelectStyle}>
                  <option value="all">All Document Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                  <option value="In Process">In Process</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Material Status</label>
                <select value={filterMaterialStatus} onChange={(e) => setFilterMaterialStatus(e.target.value)} style={filterSelectStyle}>
                  <option value="all">All Material Statuses</option>
                  <option value="Pending Shipment">Pending Shipment</option>
                  <option value="In Transit">In Transit</option>
                  <option value="At Port">At Port</option>
                  <option value="Customs Clearance">Customs Clearance</option>
                  <option value="Arrived">Arrived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container - Fixed 800px Height & Fixed Layout Alignment */}
          <div className="card fade-up delay-1" style={{ padding: '1.125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: 'var(--font-size-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Shipment Register & Records ({filteredShipments.length} matching)
              </div>
              <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>Click View to open the full details</div>
            </div>

            {/* Scroll Container: Fixed 800px Height */}
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
                    {/* Fixed First Column Header */}
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

                    {['Supplier & Country', 'PO & Invoice', 'BL / MAWB', 'BOE / CHA', 'Payment', 'Material Status'].map((h) => (
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

                    {/* Fixed Actions Header */}
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
                      const isOverdue = !!dueDate && item.paymentStatus !== 'PAID' && (getDaysUntilDue(item) ?? 0) < 0;
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
                          {/* Fixed First Column: ID & Mode */}
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

                          {/* Supplier & Country */}
                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-size-body-compact)' }}>{item.supplier}</div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>
                              {item.country} • {item.portOfLoading}
                            </div>
                          </td>

                          {/* PO & Invoice */}
                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-compact)' }}>{item.invoiceNo}</div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>
                              PO: {item.poNo}
                              {item.poDate ? ` (${formatDMY(item.poDate)})` : ''}
                            </div>
                          </td>

                          {/* BL / MAWB */}
                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-compact)' }}>
                              {item.blNo || item.mawb || '-'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>
                              BL Date: {formatDMY(item.blDate) || '-'}
                            </div>
                          </td>

                          {/* BOE / CHA */}
                          <td style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                            <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-primary)', fontWeight: 600 }}>{item.boeNo || '-'}</div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)', marginTop: 2 }}>CHA: {item.cha}</div>
                          </td>

                          {/* Payment */}
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

                          {/* Material Status */}
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

                          {/* Fixed Actions Column */}
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
          RIGHT-SIDE DETAILS DRAWER (50% width, 100% height)
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedShipment && (
        <ShipmentDrawer
          s={selectedShipment}
          onClose={() => setSelectedId(null)}
          onEdit={() => startEdit(selectedShipment)}
          onDelete={() => setDeleteTarget(selectedShipment)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.id}?`}
          message={`${deleteTarget.supplier} • ${deleteTarget.poNo} will be removed from the history and the dashboard. This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Drawer
═══════════════════════════════════════════════════════════════════════════ */
function ShipmentDrawer({
  s,
  onClose,
  onEdit,
  onDelete,
}: {
  s: Shipment;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const due = getPaymentDueDate(s);
  const period = getPaymentPeriod(s);
  const daysLeft = getDaysUntilDue(s);

  const docs: { label: string; doc?: ShipmentDocument }[] = [
    { label: 'PO', doc: s.poDocument },
    { label: 'Invoice', doc: s.invoiceDocument },
    { label: 'BL', doc: s.blDocument },
    { label: 'BOE', doc: s.boeDocument },
  ];
  const attached = docs.filter((d) => d.doc);

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
              <h2 style={{ fontSize: 'var(--font-size-section-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>{s.supplier}</h2>
              <span style={{ fontSize: 'var(--font-size-compact)', background: 'var(--accent-blue)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                {s.id}
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-muted)', marginTop: 4 }}>
              {s.material} • {getModeLabel(s)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
          <DetailGroup title="Supplier & Purchase Order">
            <Detail label="Supplier">{s.supplier}</Detail>
            <Detail label="Country of Origin">{s.country}</Detail>
            <Detail label="PO Number">{s.poNo}</Detail>
            <Detail label="PO Date">{formatDMY(s.poDate) || '-'}</Detail>
            <Detail label="Material">{s.material}</Detail>
          </DetailGroup>

          <DetailGroup title="Invoice">
            <Detail label="Invoice Number">{s.invoiceNo}</Detail>
            <Detail label="Invoice Date">{formatDMY(s.invoiceDate) || '-'}</Detail>
          </DetailGroup>

          <DetailGroup title="Shipping">
            <Detail label="Mode of Shipment">{getModeLabel(s)}</Detail>
            <Detail label="Port of Loading">{s.portOfLoading}</Detail>
            <Detail label="BL Number">{s.blNo || '-'}</Detail>
            <Detail label="BL Date">{formatDMY(s.blDate) || '-'}</Detail>
            <Detail label="MAWB">{s.mawb || '-'}</Detail>
            <Detail label="HAWB">{s.hawb || '-'}</Detail>
          </DetailGroup>

          <DetailGroup title="Customs">
            <Detail label="Custom House Agent">{s.cha}</Detail>
            <Detail label="Document Status">{s.documentStatus}</Detail>
            <Detail label="BOE Number">{s.boeNo || '-'}</Detail>
            <Detail label="BOE Date">{formatDMY(s.boeDate) || '-'}</Detail>
          </DetailGroup>

          <DetailGroup title="Payment">
            <Detail label="Payment Type">{s.paymentType}</Detail>
            <Detail label="Payment Terms">{getPaymentTermsLabel(s)}</Detail>
            <Detail label="Payment Status">
              <PaymentBadge status={s.paymentStatus} />
            </Detail>
            <Detail label="Bank Reference">{s.bankReferenceNo || '-'}</Detail>
            {period && due && (
              <Detail label={`${s.creditDaysFrom} → Due Date`} wide>
                <span>
                  {formatDMY(period.from)} → <strong>{formatDMY(due)}</strong>
                </span>
                {s.paymentStatus !== 'PAID' && daysLeft !== null && (
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
              <Detail label="Arrival Date">{formatDMY(s.arrivedDate) || '-'}</Detail>
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

          <DetailGroup title="Documents">
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {attached.length === 0 && !s.link && <span style={{ color: 'var(--text-muted)' }}>No documents attached.</span>}

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
                  <a key={label} href={doc!.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    {chip}
                  </a>
                ) : (
                  <React.Fragment key={label}>{chip}</React.Fragment>
                );
              })}

              {s.link && (
                <a href={s.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <span style={{ ...chipStyle, borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}>
                    <ExternalLink size={14} />
                    <span>Open documents link (PDF)</span>
                  </span>
                </a>
              )}
            </div>
          </DetailGroup>
        </div>
      </aside>
    </>
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
   Small shared components
═══════════════════════════════════════════════════════════════════════════ */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
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
              background: 'rgba(239,68,68,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Trash2 size={18} color="var(--accent-red)" />
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
              background: 'var(--accent-red)',
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
    <div className={`card fade-up${delay ? ` delay-${delay}` : ''}`} style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.625rem' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      </div>
      {children}
    </div>
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
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="date"
        className="sp-date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={withError({ ...inputStyle, paddingRight: '2.6rem' }, invalid ? 'x' : undefined)}
      />
      <Calendar
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
      />
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
  if (mode === 'Sea') return <Ship size={size} color="var(--accent-blue)" />;
  if (mode === 'Air') return <Plane size={size} color="var(--accent-teal)" />;
  return <Package size={size} color="var(--accent-purple)" />;
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const color = status === 'PAID' ? 'var(--accent-green)' : status === 'NOT PAID' ? 'var(--accent-red)' : 'var(--accent-orange)';
  const bg = status === 'PAID' ? 'rgba(16,185,129,0.18)' : status === 'NOT PAID' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)';
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