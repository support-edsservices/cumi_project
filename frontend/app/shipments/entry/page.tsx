'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Shipment Entry & History Portal
   Includes:
   - Dynamic tab switching: "New Entry" vs "Shipment History & Records"
   - Complete Entry form with all supplier, invoice, BL/MAWB, BOE, payment terms
   - Comprehensive Shipment History table with multi-criteria filtering
   - Quick search by Supplier, PO, Invoice, BL, Country
   - Filter by Mode (Sea/Air), Payment Status (PAID/NOT PAID/PARTIAL), Document Status
   - Full Excel (.xlsx) and CSV Export features using the pre-installed 'xlsx' package
   - Responsive, dark/light theme aware with custom ThemeContext font sizing
───────────────────────────────────────────────────────────────────────────── */
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Save,
  PlusCircle,
  X,
  UploadCloud,
  FileText,
  Ship,
  Plane,
  CheckCircle2,
  Building2,
  Receipt,
  Navigation,
  ShieldCheck,
  CreditCard,
  Calendar,
  Download,
  Search,
  Filter,
  Eye,
  ExternalLink,
  Table as TableIcon,
  Plus,
  RefreshCw,
  Clock,
  Paperclip,
} from 'lucide-react';

import {
  Shipment,
  ShipmentMode,
  PaymentTermType,
  PaymentStatus,
  DocumentStatus,
  MaterialStatus,
} from '@/types/shipment';
import { shipmentData as initialShipmentData, getPaymentDueDate } from '@/data/shipmentData';

export default function ShipmentEntryAndHistoryPage() {
  // Active Tab: 'entry' or 'history'
  const [activeTab, setActiveTab] = useState<'entry' | 'history'>('entry');

  // Shipment dataset (starts with seed mock data, appends newly added shipments)
  const [shipments, setShipments] = useState<Shipment[]>(initialShipmentData);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detailed view modal state for selected shipment
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  // ─── Entry Form State ───
  const defaultFormData = {
    supplier: '',
    poNo: '',
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
    boeNo: '',
    boeDate: '',
    boeDocName: '',
    country: '',
    paymentTerms: '60 Days from BL' as PaymentTermType,
    paymentStatus: 'NOT PAID' as PaymentStatus,
    materialStatus: 'In Transit' as MaterialStatus,
    etd: '',
    eta: '',
    link: '',
    bankReferenceNo: '',
    leadTime: '45',
  };

  const [formData, setFormData] = useState(defaultFormData);

  // ─── History Filter & Search State ───
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterDocStatus, setFilterDocStatus] = useState<string>('all');
  const [filterMaterialStatus, setFilterMaterialStatus] = useState<string>('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSimulate = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setFormData((prev) => ({ ...prev, [field]: fileName }));
      showToast(`Attached document: ${fileName}`);
    }
  };

  const handleResetForm = () => {
    setFormData(defaultFormData);
  };

  const handleSubmit = (stayOnPage = false) => {
    if (!formData.supplier.trim() || !formData.poNo.trim() || !formData.invoiceNo.trim()) {
      alert('Please fill in required fields: Supplier, PO No, and Invoice No.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newRecord: Shipment = {
        id: `SHP-${String(shipments.length + 1).padStart(3, '0')}`,
        supplier: formData.supplier.trim(),
        poNo: formData.poNo.trim(),
        poDocument: formData.poDocName
          ? { name: formData.poDocName, url: '#', type: 'pdf' }
          : undefined,
        material: formData.material.trim() || 'Industrial Components',
        invoiceNo: formData.invoiceNo.trim(),
        invoiceDate: formData.invoiceDate || new Date().toISOString().split('T')[0],
        invoiceDocument: formData.invoiceDocName
          ? { name: formData.invoiceDocName, url: '#', type: 'pdf' }
          : undefined,
        portOfLoading: formData.portOfLoading.trim() || 'Origin Port',
        blNo: formData.blNo.trim() || 'BL-PENDING',
        blDate: formData.blDate || new Date().toISOString().split('T')[0],
        blDocument: formData.blDocName
          ? { name: formData.blDocName, url: '#', type: 'pdf' }
          : undefined,
        mawb: formData.mawb.trim(),
        hawb: formData.hawb.trim(),
        cha: formData.cha.trim() || 'In-House CUMI Clearance',
        documentStatus: formData.documentStatus,
        modeOfShipment: formData.modeOfShipment,
        boeNo: formData.boeNo.trim() || 'BOE-PENDING',
        boeDate: formData.boeDate || new Date().toISOString().split('T')[0],
        boeDocument: formData.boeDocName
          ? { name: formData.boeDocName, url: '#', type: 'pdf' }
          : undefined,
        country: formData.country.trim() || 'International',
        paymentTerms: formData.paymentTerms,
        paymentStatus: formData.paymentStatus,
        materialStatus: formData.materialStatus,
        etd: formData.etd || new Date().toISOString().split('T')[0],
        eta: formData.eta || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        link: formData.link.trim(),
        bankReferenceNo: formData.bankReferenceNo.trim(),
        leadTime: parseInt(formData.leadTime) || 45,
        createdAt: new Date().toISOString().split('T')[0],
      };

      setShipments([newRecord, ...shipments]);
      setIsSubmitting(false);
      showToast(`Shipment ${newRecord.id} recorded in history!`);
      handleResetForm();

      if (!stayOnPage) {
        setActiveTab('history');
      }
    }, 500);
  };

  // ─── Filtered Shipments for History Table ───
  const filteredShipments = useMemo(() => {
    return shipments.filter((item) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        item.supplier.toLowerCase().includes(q) ||
        item.poNo.toLowerCase().includes(q) ||
        item.invoiceNo.toLowerCase().includes(q) ||
        item.blNo.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.country.toLowerCase().includes(q) ||
        item.cha.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);

      const matchMode = filterMode === 'all' || item.modeOfShipment === filterMode;
      const matchPayment = filterPayment === 'all' || item.paymentStatus === filterPayment;
      const matchDocStatus = filterDocStatus === 'all' || item.documentStatus === filterDocStatus;
      const matchMatStatus = filterMaterialStatus === 'all' || item.materialStatus === filterMaterialStatus;

      return matchSearch && matchMode && matchPayment && matchDocStatus && matchMatStatus;
    });
  }, [shipments, searchTerm, filterMode, filterPayment, filterDocStatus, filterMaterialStatus]);

  // ─── Excel (.xlsx) Export Handler ───
  const handleExportExcel = () => {
    if (filteredShipments.length === 0) {
      alert('No records available to export.');
      return;
    }

    const exportRows = filteredShipments.map((s, idx) => {
      const dueDate = getPaymentDueDate(s);
      return {
        'S.No': idx + 1,
        'Shipment ID': s.id,
        'Supplier Name': s.supplier,
        'PO Number': s.poNo,
        'Material Description': s.material,
        'Mode of Shipment': s.modeOfShipment,
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
        'Payment Terms': s.paymentTerms,
        'Payment Status': s.paymentStatus,
        'Payment Due Date (60 Days)': dueDate ? dueDate.toISOString().split('T')[0] : 'N/A',
        'Material Status': s.materialStatus,
        'ETD': s.etd,
        'ETA': s.eta,
        'Lead Time (Days)': s.leadTime,
        'Bank Reference': s.bankReferenceNo || '-',
        'Tracking Link': s.link || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipment History');

    // Auto fit column widths
    const maxCols = Object.keys(exportRows[0]).map((key) => ({
      wch: Math.max(key.length, 14),
    }));
    worksheet['!cols'] = maxCols;

    const fileName = `CUMI_Shipments_History_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showToast(`Exported ${filteredShipments.length} rows to ${fileName}`);
  };

  // ─── CSV Export Handler ───
  const handleExportCSV = () => {
    if (filteredShipments.length === 0) {
      alert('No records available to export.');
      return;
    }

    const exportRows = filteredShipments.map((s) => {
      const dueDate = getPaymentDueDate(s);
      return {
        'ID': s.id,
        'Supplier': s.supplier,
        'PO No': s.poNo,
        'Material': s.material,
        'Mode': s.modeOfShipment,
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
        'Payment Terms': s.paymentTerms,
        'Payment Status': s.paymentStatus,
        'Payment Due Date': dueDate ? dueDate.toISOString().split('T')[0] : 'N/A',
        'Material Status': s.materialStatus,
        'ETD': s.etd,
        'ETA': s.eta,
        'Lead Time': s.leadTime,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CUMI_Shipments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported CSV successfully!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* ── Toast notification ── */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '4.5rem',
            right: '1.5rem',
            zIndex: 9999,
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
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Top Header Bar ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
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
              transition: 'all 0.15s ease',
            }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1
              style={{
                fontSize: 'var(--font-size-section-heading)',
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              Shipment Management Portal
            </h1>
          </div>
        </div>

        {/* ── Top Nav Switcher: New Entry vs History View ── */}
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
          <button
            type="button"
            onClick={() => setActiveTab('entry')}
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
              background: activeTab === 'entry' ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === 'entry' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'entry' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={16} />
            <span>New Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
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
              background: activeTab === 'history' ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === 'history' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'history' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <TableIcon size={16} />
            <span>History & Records ({shipments.length})</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: NEW ENTRY FORM
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'entry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* ── SECTION 1: Supplier & PO ── */}
          <div className="card fade-up" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.625rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#3b82f618', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={16} color="var(--accent-blue)" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Supplier & Purchase Order
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>
                  Supplier Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bosch GmbH, Siemens AG, ABB Ltd"
                  value={formData.supplier}
                  onChange={(e) => handleInputChange('supplier', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  PO Number <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO/2026/04-0187"
                  value={formData.poNo}
                  onChange={(e) => handleInputChange('poNo', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>PO Document Attachment</label>
                <FileUploadZone
                  docName={formData.poDocName}
                  onFileChange={(e) => handleFileSimulate('poDocName', e)}
                  placeholder="Upload PO PDF/Scanned Copy"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Material & Invoice ── */}
          <div className="card fade-up delay-1" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.625rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#8b5cf618', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={16} color="var(--accent-purple)" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Material Description & Commercial Invoice
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Material / Product Description</label>
                <input
                  type="text"
                  placeholder="e.g. Hydraulic Actuators, Silicon Carbide Grit"
                  value={formData.material}
                  onChange={(e) => handleInputChange('material', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Invoice Number <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-BOSCH-2026-0412"
                  value={formData.invoiceNo}
                  onChange={(e) => handleInputChange('invoiceNo', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Invoice Date</label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Invoice Document File</label>
                <FileUploadZone
                  docName={formData.invoiceDocName}
                  onFileChange={(e) => handleFileSimulate('invoiceDocName', e)}
                  placeholder="Upload Vendor Invoice (PDF)"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 3: Shipping & Logistics (BL / Air Waybill) ── */}
          <div className="card fade-up delay-2" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.625rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#06b6d418', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Navigation size={16} color="var(--accent-teal)" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Mode of Shipment & Freight Documents
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {/* Mode Toggle */}
              <div style={{ gridColumn: '1 / -1', marginBottom: '0.25rem' }}>
                <label style={labelStyle}>Mode of Shipment</label>
                <div style={{ display: 'inline-flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.3rem', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => handleInputChange('modeOfShipment', 'Sea')}
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
                      background: formData.modeOfShipment === 'Sea' ? 'var(--accent-blue)' : 'transparent',
                      color: formData.modeOfShipment === 'Sea' ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Ship size={16} />
                    <span>Sea Freight 🚢</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('modeOfShipment', 'Air')}
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
                      background: formData.modeOfShipment === 'Air' ? 'var(--accent-teal)' : 'transparent',
                      color: formData.modeOfShipment === 'Air' ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Plane size={16} />
                    <span>Air Cargo ✈️</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Port of Loading / Airport</label>
                <input
                  type="text"
                  placeholder="e.g. Hamburg, Rotterdam, Shanghai"
                  value={formData.portOfLoading}
                  onChange={(e) => handleInputChange('portOfLoading', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Bill of Lading (BL) No</label>
                <input
                  type="text"
                  placeholder="e.g. MAEU726491835, HLCU835720194"
                  value={formData.blNo}
                  onChange={(e) => handleInputChange('blNo', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>BL Date</label>
                <input
                  type="date"
                  value={formData.blDate}
                  onChange={(e) => handleInputChange('blDate', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>BL Document File</label>
                <FileUploadZone
                  docName={formData.blDocName}
                  onFileChange={(e) => handleFileSimulate('blDocName', e)}
                  placeholder="Upload BL Document (PDF)"
                />
              </div>

              <div>
                <label style={labelStyle}>MAWB (Master Air Waybill)</label>
                <input
                  type="text"
                  placeholder="e.g. 157-82749103"
                  value={formData.mawb}
                  onChange={(e) => handleInputChange('mawb', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>HAWB (House Air Waybill)</label>
                <input
                  type="text"
                  placeholder="e.g. HAWB-FRA-2026-99"
                  value={formData.hawb}
                  onChange={(e) => handleInputChange('hawb', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 4: Customs, BOE & CHA ── */}
          <div className="card fade-up delay-3" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.625rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#10b98118', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={16} color="var(--accent-green)" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Customs Clearance, BOE & CHA
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Custom House Agent (CHA)</label>
                <input
                  type="text"
                  placeholder="e.g. Kuehne + Nagel India, DHL Global Forwarding"
                  value={formData.cha}
                  onChange={(e) => handleInputChange('cha', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Document Status</label>
                <select
                  value={formData.documentStatus}
                  onChange={(e) => handleInputChange('documentStatus', e.target.value)}
                  style={selectStyle}
                >
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                  <option value="In Process">In Process</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Country of Origin</label>
                <input
                  type="text"
                  placeholder="e.g. Germany, Japan, United States, Italy"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>BOE (Bill of Entry) Number</label>
                <input
                  type="text"
                  placeholder="e.g. BOE/2026/3847291"
                  value={formData.boeNo}
                  onChange={(e) => handleInputChange('boeNo', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>BOE Date</label>
                <input
                  type="date"
                  value={formData.boeDate}
                  onChange={(e) => handleInputChange('boeDate', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>BOE Document Attachment</label>
                <FileUploadZone
                  docName={formData.boeDocName}
                  onFileChange={(e) => handleFileSimulate('boeDocName', e)}
                  placeholder="Upload BOE Customs Stamp (PDF)"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 5: Payment Terms & Material Status ── */}
          <div className="card fade-up delay-4" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.625rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f59e0b18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={16} color="var(--accent-orange)" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Payment Terms & Material Status
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Payment Terms</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                  style={selectStyle}
                >
                  <option value="60 Days from BL">60 Days from BL (Bill of Lading)</option>
                  <option value="60 Days from Invoice">60 Days from Invoice Date</option>
                  <option value="LC">Letter of Credit (LC)</option>
                  <option value="PO">Purchase Order (PO)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Payment Status (PRW / Settlement)</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: 4 }}>
                  {[
                    { id: 'PAID', label: 'PAID', color: 'var(--accent-green)' },
                    { id: 'NOT PAID', label: 'NOT PAID', color: 'var(--accent-red)' },
                    { id: 'PARTIAL', label: 'PARTIAL', color: 'var(--accent-orange)' },
                  ].map((s) => {
                    const active = formData.paymentStatus === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleInputChange('paymentStatus', s.id)}
                        style={{
                          flex: 1,
                          padding: '0.55rem 0.6rem',
                          borderRadius: 8,
                          fontSize: 'var(--font-size-compact)',
                          fontWeight: 700,
                          border: active ? `2px solid ${s.color}` : '1px solid var(--border)',
                          background: active ? `${s.color}25` : 'var(--bg-secondary)',
                          color: active ? s.color : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Material Status</label>
                <select
                  value={formData.materialStatus}
                  onChange={(e) => handleInputChange('materialStatus', e.target.value)}
                  style={selectStyle}
                >
                  <option value="Pending Shipment">Pending Shipment</option>
                  <option value="In Transit">In Transit</option>
                  <option value="At Port">At Port</option>
                  <option value="Customs Clearance">Customs Clearance</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── SECTION 6: ETD vs ETA & References ── */}
          <div className="card fade-up delay-5" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.625rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#3b82f618', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} color="var(--accent-blue)" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-body-large)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ETD vs ETA & Lead Time Metrics
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>ETD (Expected to Depart)</label>
                <input
                  type="date"
                  value={formData.etd}
                  onChange={(e) => handleInputChange('etd', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>ETA (Expected to Arrive)</label>
                <input
                  type="date"
                  value={formData.eta}
                  onChange={(e) => handleInputChange('eta', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Lead Time (Days)</label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={formData.leadTime}
                  onChange={(e) => handleInputChange('leadTime', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Bank Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. ICICI/FX/2026/08142"
                  value={formData.bankReferenceNo}
                  onChange={(e) => handleInputChange('bankReferenceNo', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Live Container / Flight Tracking URL</label>
                <input
                  type="url"
                  placeholder="https://tracking.maersk.com/... or https://www.flightradar24.com/..."
                  value={formData.link}
                  onChange={(e) => handleInputChange('link', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* ── Form Actions Footer ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.875rem',
              padding: '1.25rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <button
              type="button"
              onClick={handleResetForm}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-body)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Fields
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-body)',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Save & Add Another
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
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
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                fontFamily: 'inherit',
              }}
            >
              <Save size={18} />
              <span>{isSubmitting ? 'Saving Shipment...' : 'Save & View History'}</span>
            </button>
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: SHIPMENT HISTORY & EXPORT VIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* ── Filter & Search Control Panel ── */}
          <div
            className="card fade-up"
            style={{
              padding: '1.125rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              {/* Search bar */}
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
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Action Buttons: Export Excel, Export CSV */}
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

            {/* Quick dropdown filters */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.625rem',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.75rem',
              }}
            >
              {/* Mode Filter */}
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Mode</label>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                  style={{ ...selectStyle, padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-compact)' }}
                >
                  <option value="all">All Modes</option>
                  <option value="Sea">Sea Freight 🚢</option>
                  <option value="Air">Air Cargo ✈️</option>
                </select>
              </div>

              {/* Payment Filter */}
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Payment Status</label>
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  style={{ ...selectStyle, padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-compact)' }}
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="PAID">PAID</option>
                  <option value="NOT PAID">NOT PAID</option>
                  <option value="PARTIAL">PARTIAL</option>
                </select>
              </div>

              {/* Document Status Filter */}
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Document Status</label>
                <select
                  value={filterDocStatus}
                  onChange={(e) => setFilterDocStatus(e.target.value)}
                  style={{ ...selectStyle, padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-compact)' }}
                >
                  <option value="all">All Document Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                  <option value="In Process">In Process</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Material Status Filter */}
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Material Status</label>
                <select
                  value={filterMaterialStatus}
                  onChange={(e) => setFilterMaterialStatus(e.target.value)}
                  style={{ ...selectStyle, padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-compact)' }}
                >
                  <option value="all">All Material Statuses</option>
                  <option value="Pending Shipment">Pending Shipment</option>
                  <option value="In Transit">In Transit</option>
                  <option value="At Port">At Port</option>
                  <option value="Customs Clearance">Customs Clearance</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── History Table Card ── */}
          <div className="card fade-up delay-1" style={{ padding: '1.125rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: 'var(--font-size-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Shipment Register & Records ({filteredShipments.length} matching)
              </div>
              <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-muted)' }}>
                Showing all chronological entries
              </div>
            </div>

            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1050 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    {['ID / Mode', 'Supplier & Country', 'PO & Invoice', 'BL / MAWB', 'BOE / CHA', 'Payment (60D)', 'Material Status', 'Actions'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '0.65rem 0.85rem',
                          fontSize: 'var(--font-size-label)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
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
                      const isOverdue = dueDate && dueDate < new Date() && item.paymentStatus !== 'PAID';

                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: idx % 2 === 1 ? 'var(--bg-secondary)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* ID & Mode */}
                          <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 800, color: 'var(--accent-blue)', fontSize: 'var(--font-size-body-compact)' }}>
                              {item.id}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)' }}>
                              {item.modeOfShipment === 'Sea' ? (
                                <>
                                  <Ship size={12} color="var(--accent-blue)" />
                                  <span>Sea</span>
                                </>
                              ) : (
                                <>
                                  <Plane size={12} color="var(--accent-teal)" />
                                  <span>Air</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Supplier & Country */}
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-size-body-compact)' }}>
                              {item.supplier}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)' }}>
                              {item.country} • {item.portOfLoading}
                            </div>
                          </td>

                          {/* PO & Invoice */}
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-compact)' }}>
                              {item.invoiceNo}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)' }}>
                              PO: {item.poNo} ({item.invoiceDate})
                            </div>
                          </td>

                          {/* BL / MAWB */}
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-compact)' }}>
                              {item.blNo || item.mawb || '-'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)' }}>
                              BL Date: {item.blDate || '-'}
                            </div>
                          </td>

                          {/* BOE / CHA */}
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ fontSize: 'var(--font-size-compact)', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {item.boeNo || '-'}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)' }}>
                              CHA: {item.cha}
                            </div>
                          </td>

                          {/* Payment (60D) */}
                          <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span
                                style={{
                                  fontSize: 'var(--font-size-tiny)',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  background:
                                    item.paymentStatus === 'PAID'
                                      ? 'rgba(16,185,129,0.18)'
                                      : item.paymentStatus === 'NOT PAID'
                                      ? 'rgba(239,68,68,0.18)'
                                      : 'rgba(245,158,11,0.18)',
                                  color:
                                    item.paymentStatus === 'PAID'
                                      ? 'var(--accent-green)'
                                      : item.paymentStatus === 'NOT PAID'
                                      ? 'var(--accent-red)'
                                      : 'var(--accent-orange)',
                                }}
                              >
                                {item.paymentStatus}
                              </span>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-tiny)', color: isOverdue ? 'var(--accent-red)' : 'var(--text-muted)', marginTop: 2 }}>
                              Due: {dueDate ? dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                              {isOverdue && ' (Overdue)'}
                            </div>
                          </td>

                          {/* Material Status */}
                          <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: 'var(--font-size-tiny)',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {item.materialStatus}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedShipment(item)}
                              style={{
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
                              }}
                              title="View complete shipment info"
                            >
                              <Eye size={13} color="var(--accent-blue)" />
                              <span>View</span>
                            </button>
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

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: SHIPMENT DETAILS VIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      {selectedShipment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={() => setSelectedShipment(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 750,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '1.5rem',
              background: 'var(--bg-card)',
              position: 'relative',
              borderRadius: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 'var(--font-size-section-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedShipment.supplier}
                  </h2>
                  <span style={{ fontSize: 'var(--font-size-compact)', background: 'var(--accent-blue)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                    {selectedShipment.id}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-muted)', marginTop: 2 }}>
                  Material: {selectedShipment.material} • Mode: {selectedShipment.modeOfShipment}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShipment(null)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '0.35rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: 'var(--font-size-compact)' }}>
              <div>
                <div style={labelStyle}>PO Number</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedShipment.poNo}</div>
              </div>

              <div>
                <div style={labelStyle}>Invoice No & Date</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedShipment.invoiceNo}</div>
                <div style={{ color: 'var(--text-muted)' }}>{selectedShipment.invoiceDate}</div>
              </div>

              <div>
                <div style={labelStyle}>BL / MAWB</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedShipment.blNo || selectedShipment.mawb || '-'}</div>
                <div style={{ color: 'var(--text-muted)' }}>BL Date: {selectedShipment.blDate || '-'}</div>
              </div>

              <div>
                <div style={labelStyle}>Customs BOE No & Date</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedShipment.boeNo || '-'}</div>
                <div style={{ color: 'var(--text-muted)' }}>{selectedShipment.boeDate || '-'}</div>
              </div>

              <div>
                <div style={labelStyle}>Port of Loading / Country</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedShipment.portOfLoading}</div>
                <div style={{ color: 'var(--text-muted)' }}>Origin: {selectedShipment.country}</div>
              </div>

              <div>
                <div style={labelStyle}>Custom House Agent (CHA)</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedShipment.cha}</div>
              </div>

              <div>
                <div style={labelStyle}>Payment Terms & Status</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedShipment.paymentTerms}</div>
                <div style={{ color: selectedShipment.paymentStatus === 'PAID' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                  Status: {selectedShipment.paymentStatus}
                </div>
              </div>

              <div>
                <div style={labelStyle}>ETD vs ETA</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>ETD: {selectedShipment.etd}</div>
                <div style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>ETA: {selectedShipment.eta}</div>
              </div>

              <div>
                <div style={labelStyle}>Lead Time & Bank Ref</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedShipment.leadTime} Days</div>
                <div style={{ color: 'var(--text-muted)' }}>{selectedShipment.bankReferenceNo || 'No Bank Ref'}</div>
              </div>
            </div>

            {/* Tracking Link button */}
            {selectedShipment.link && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <a
                  href={selectedShipment.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'var(--accent-blue)',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-body-compact)',
                  }}
                >
                  <ExternalLink size={16} />
                  <span>Open Live Carrier / Port Tracking</span>
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
   File Upload Dropzone Component
═══════════════════════════════════════════════════════════════════════════ */
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
          <span
            style={{
              fontSize: 'var(--font-size-compact)',
              color: 'var(--accent-green)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {docName}
          </span>
        </>
      ) : (
        <>
          <UploadCloud size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 'var(--font-size-compact)',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {placeholder}
          </span>
        </>
      )}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared Element Styles
═══════════════════════════════════════════════════════════════════════════ */
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

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.85rem',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 'var(--font-size-body)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
  boxSizing: 'border-box',
};
