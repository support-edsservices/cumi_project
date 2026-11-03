'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle, Loader2, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/data/ENUM';
import { MASTER_LABELS, MASTER_TYPES, type MasterEntry, type MasterType } from '@/data/masterData';

function isMasterType(value: string): value is MasterType {
  return MASTER_TYPES.includes(value as MasterType);
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const data: unknown = await response.json().catch(() => null);
  if (data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') {
    return data.detail;
  }
  return fallback;
}

export default function MasterEntryPage() {
  const params = useParams<{ master: string }>();
  const router = useRouter();
  const { user, fetchWithAuth } = useAuth();
  const masterType = isMasterType(params.master) ? params.master : null;
  const title = masterType ? MASTER_LABELS[masterType] : 'Master Data';

  const [entries, setEntries] = useState<MasterEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<MasterEntry | null>(null);
  const [name, setName] = useState('');
  const [paymentType, setPaymentType] = useState('OTHER');
  const [creditDays, setCreditDays] = useState('');
  const [creditBasis, setCreditBasis] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const canManage = ['manager', 'admin', 'superadmin'].includes(user?.role.toLowerCase() ?? '');

  const fetchEntries = useCallback(async () => {
    if (!masterType) return;
    const response = await fetchWithAuth(`${BASE_URL}/api/masters/${masterType}`);
    if (!response.ok) throw new Error(await errorMessage(response, 'Could not load master entries.'));
    return await response.json() as MasterEntry[];
  }, [fetchWithAuth, masterType]);

  const loadEntries = useCallback(async () => {
    if (!masterType) return;
    setLoading(true);
    try {
      setEntries(await fetchEntries() ?? []);
      setNotice(null);
    } catch (loadError) {
      setNotice({ type: 'error', text: loadError instanceof Error ? loadError.message : 'Could not load master entries.' });
    } finally {
      setLoading(false);
    }
  }, [fetchEntries, masterType]);

  useEffect(() => {
    setEditingEntry(null);
    setName('');
    setPaymentType('OTHER');
    setCreditDays('');
    setCreditBasis('');
    setNeedsReview(false);
    setSearchTerm('');
  }, [masterType]);

  useEffect(() => {
    if (!canManage) {
      router.replace('/');
      return;
    }
    let active = true;
    const loadInitialEntries = async () => {
      try {
        const loadedEntries = await fetchEntries();
        if (active) {
          setEntries(loadedEntries ?? []);
          setNotice(null);
        }
      } catch (loadError) {
        if (active) {
          setNotice({ type: 'error', text: loadError instanceof Error ? loadError.message : 'Could not load master entries.' });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInitialEntries();
    return () => { active = false; };
  }, [canManage, fetchEntries, router]);

  const activeEntries = useMemo(() => entries.filter((entry) => Boolean(entry.is_active)), [entries]);

  /* Filter entries using real-time search */
  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      const entryName = entry.name.toLowerCase();
      const statusStr = entry.is_active ? 'active' : 'inactive';
      const paymentTypeStr = (entry.payment_type ?? '').toLowerCase();
      const creditBasisStr = (entry.credit_basis ?? '').toLowerCase();
      const creditDaysStr = entry.credit_days != null ? String(entry.credit_days) : '';
      return (
        entryName.includes(query) ||
        statusStr.includes(query) ||
        paymentTypeStr.includes(query) ||
        creditBasisStr.includes(query) ||
        creditDaysStr.includes(query)
      );
    });
  }, [entries, searchTerm]);

  const saveEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!masterType || !name.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetchWithAuth(
        `${BASE_URL}/api/masters/${masterType}${editingEntry ? `/${editingEntry.id}` : ''}`,
        {
          method: editingEntry ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            paymentType,
            creditDays: creditDays !== '' ? Number(creditDays) : null,
            creditBasis: creditBasis || null,
            needsReview,
          }),
        },
      );
      if (!response.ok) throw new Error(await errorMessage(response, `Could not ${editingEntry ? 'update' : 'save'} master entry.`));
      const savedName = name.trim();
      setName('');
      setPaymentType('OTHER');
      setCreditDays('');
      setCreditBasis('');
      setNeedsReview(false);
      setNotice({ type: 'success', text: `${title} entry ${editingEntry ? 'updated' : 'added'}: ${savedName}.` });
      setEditingEntry(null);
      await loadEntries();
    } catch (saveError) {
      setNotice({ type: 'error', text: saveError instanceof Error ? saveError.message : 'Could not save master entry.' });
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (entry: MasterEntry) => {
    setEditingEntry(entry);
    setName(entry.name);
    setPaymentType(entry.payment_type ?? 'OTHER');
    setCreditDays(entry.credit_days == null ? '' : String(entry.credit_days));
    setCreditBasis(entry.credit_basis ?? '');
    setNeedsReview(Boolean(entry.needs_review));
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setName('');
    setPaymentType('OTHER');
    setCreditDays('');
    setCreditBasis('');
    setNeedsReview(false);
  };

  const setEntryActive = async (entry: MasterEntry, active: boolean) => {
    if (!masterType || (active && !window.confirm(`Reactivate "${entry.name}" for new shipments?`)) ||
        (!active && !window.confirm(`Deactivate "${entry.name}"? It will no longer be available for new shipments.`))) return;
    setActionId(entry.id);
    setNotice(null);
    try {
      const url = `${BASE_URL}/api/masters/${masterType}/${entry.id}${active ? '/activate' : '/deactivate'}`;
      const response = await fetchWithAuth(url, { method: 'PATCH' });
      if (!response.ok) throw new Error(await errorMessage(response, `Could not ${active ? 'reactivate' : 'deactivate'} this entry.`));
      setNotice({ type: 'success', text: `${entry.name} ${active ? 'reactivated' : 'deactivated'}.` });
      await loadEntries();
    } catch (actionError) {
      setNotice({ type: 'error', text: actionError instanceof Error ? actionError.message : 'Could not update this entry.' });
    } finally {
      setActionId(null);
    }
  };

  const deleteEntry = async (entry: MasterEntry) => {
    if (!masterType || !window.confirm(`Permanently delete "${entry.name}"? This is only allowed if no shipments use it.`)) return;
    setActionId(entry.id);
    setNotice(null);
    try {
      const response = await fetchWithAuth(`${BASE_URL}/api/masters/${masterType}/${entry.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await errorMessage(response, 'Could not delete this entry.'));
      if (editingEntry?.id === entry.id) cancelEditing();
      setNotice({ type: 'success', text: `${entry.name} permanently deleted.` });
      await loadEntries();
    } catch (actionError) {
      setNotice({ type: 'error', text: actionError instanceof Error ? actionError.message : 'Could not delete this entry.' });
    } finally {
      setActionId(null);
    }
  };

  if (!canManage || !masterType) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', padding: '0.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <Link href="/shipments/entry" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '0.82rem', marginBottom: 8 }}>
            <ArrowLeft size={14} /> Shipment entry
          </Link>
          <h1 style={{ fontSize: 'var(--font-size-section-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>{title} Master</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Add, edit, deactivate, or permanently delete values available in the shipment entry form.
          </p>
        </div>
        <button type="button" onClick={() => void loadEntries()} disabled={loading} style={buttonStyle}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {MASTER_TYPES.map((type) => (
          <Link key={type} href={`/masters/${type}`} style={{
            ...categoryLinkStyle,
            color: type === masterType ? '#fff' : 'var(--text-secondary)',
            background: type === masterType ? 'var(--accent-blue)' : 'var(--bg-secondary)',
          }}>
            {MASTER_LABELS[type]}
          </Link>
        ))}
      </div>

      {notice && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem 1rem', borderRadius: 8,
          color: notice.type === 'success' ? '#059669' : '#dc2626',
          background: notice.type === 'success' ? '#10b98115' : '#ef444415',
          border: `1px solid ${notice.type === 'success' ? '#10b98140' : '#ef444440'}`,
          fontSize: '0.84rem', fontWeight: 600,
        }}>
          {notice.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {notice.text}
        </div>
      )}

      <form onSubmit={saveEntry} className="card" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.8rem', alignItems: 'end' }}>
        <label style={fieldLabelStyle}>
          {entryLabel(masterType)}
          <input required maxLength={maxNameLength(masterType)} value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholderFor(masterType)} style={inputStyle} />
        </label>

        {masterType === 'payment-terms' && (
          <>
            <label style={fieldLabelStyle}>
              Payment type
              <select value={paymentType} onChange={(event) => setPaymentType(event.target.value)} style={inputStyle}>
                <option value="OTHER">Other / advance</option>
                <option value="LC">LC</option>
                <option value="CREDIT_DAYS">Credit days</option>
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Credit days
              <input type="number" min="0" max="65535" value={creditDays} onChange={(event) => setCreditDays(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldLabelStyle}>
              Count from
              <select value={creditBasis} onChange={(event) => setCreditBasis(event.target.value)} style={inputStyle}>
                <option value="">Not applicable</option>
                <option value="INVOICE_DATE">Invoice date</option>
                <option value="BL_DATE">BL date</option>
                <option value="PO_DATE">PO date</option>
                <option value="PROFORMA_INVOICE_DATE">Proforma invoice date</option>
              </select>
            </label>
            <label style={{ ...fieldLabelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={needsReview} onChange={(event) => setNeedsReview(event.target.checked)} />
              Needs business review
            </label>
          </>
        )}

        <button type="submit" disabled={saving} style={{ ...buttonStyle, justifyContent: 'center', minHeight: 40, background: 'var(--accent-blue)', color: '#fff', borderColor: 'var(--accent-blue)' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : editingEntry ? <Save size={15} /> : <Plus size={15} />}
          {editingEntry ? 'Save changes' : `Add ${entryLabel(masterType)}`}
        </button>
        {editingEntry && (
          <button type="button" onClick={cancelEditing} disabled={saving} style={{ ...buttonStyle, justifyContent: 'center', minHeight: 40 }}>
            <X size={15} /> Cancel edit
          </button>
        )}
      </form>

      {/* Table Section with Header Search Controls and Fixed Max-Height Scroll Area */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '0.75rem', background: 'var(--bg-secondary)',
        }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 750 }}>
            {title} ({activeEntries.length} active / {entries.length} total)
          </div>

          {/* Search Input Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', maxWidth: 320 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '0.35rem 0.65rem',
            }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', border: 'none', outline: 'none',
                  background: 'transparent', color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><Loader2 className="animate-spin" size={20} /></div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {entries.length === 0 ? 'No entries yet. Add the first value above.' : `No ${title.toLowerCase()} entries matching "${searchTerm}".`}
          </div>
        ) : (
          /* Table Container with Sticky Headers & Vertical Scroll */
          <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 2, boxShadow: '0 1px 0 var(--border)' }}>
                  <th style={cellStyle}>Name</th>
                  {masterType === 'payment-terms' && <><th style={cellStyle}>Type</th><th style={cellStyle}>Credit</th><th style={cellStyle}>Review</th></>}
                  <th style={cellStyle}>Status</th>
                  <th style={cellStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.name}</td>
                    {masterType === 'payment-terms' && <>
                      <td style={cellStyle}>{entry.payment_type ?? '-'}</td>
                      <td style={cellStyle}>{entry.credit_days != null ? `${entry.credit_days} days from ${entry.credit_basis ?? ''}` : '-'}</td>
                      <td style={cellStyle}>{entry.needs_review ? 'Yes' : 'No'}</td>
                    </>}
                    <td style={cellStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                        background: entry.is_active ? '#10b98115' : '#ef444415',
                        color: entry.is_active ? '#059669' : '#dc2626',
                        fontWeight: 700, fontSize: '0.78rem',
                      }}>
                        {entry.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {masterType !== 'prw' && (
                          <button type="button" onClick={() => startEditing(entry)} disabled={actionId === entry.id} aria-label={`Edit ${entry.name}`} style={buttonStyle}>
                            <Pencil size={14} /> Edit
                          </button>
                        )}
                        {masterType === 'prw' && (
                          <button type="button" disabled title="PRW values are fixed system statuses" style={{ ...buttonStyle, opacity: 0.55, cursor: 'not-allowed' }}>
                            <Pencil size={14} /> System value
                          </button>
                        )}
                        {entry.is_active ? (
                          <button type="button" onClick={() => void setEntryActive(entry, false)} disabled={actionId === entry.id} aria-label={`Deactivate ${entry.name}`} style={{ ...buttonStyle, color: 'var(--accent-orange)' }}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" onClick={() => void setEntryActive(entry, true)} disabled={actionId === entry.id} style={buttonStyle}>
                            Reactivate
                          </button>
                        )}
                        <button type="button" onClick={() => void deleteEntry(entry)} disabled={actionId === entry.id} aria-label={`Delete ${entry.name}`} style={{ ...buttonStyle, color: 'var(--accent-red)' }}>
                          {actionId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function placeholderFor(type: MasterType): string {
  if (type === 'material-id') return 'e.g. IC, MS, AB';
  if (type === 'suppliers') return 'e.g. Bosch GmbH';
  if (type === 'ports') return 'e.g. Hamburg Port';
  if (type === 'chas') return 'e.g. DHL Global Forwarding';
  if (type === 'modes') return 'e.g. Road, Rail, Courier';
  if (type === 'countries') return 'e.g. Germany';
  if (type === 'materials') return 'e.g. Hydraulic Actuator';
  if (type === 'payment-terms') return 'e.g. 30 Days from Invoice';
  if (type === 'prw') return 'e.g. NOT PAID';
  return 'e.g. Main Warehouse';
}

function maxNameLength(type: MasterType): number {
  if (type === 'material-id') return 50;
  if (type === 'payment-terms') return 255;
  if (type === 'modes') return 40;
  if (type === 'countries') return 80;
  if (type === 'ports' || type === 'chas' || type === 'warehouses') return 120;
  if (type === 'materials') return 255;
  if (type === 'prw') return 30;
  return 150;
}

function entryLabel(type: MasterType): string {
  const labels: Record<MasterType, string> = {
    suppliers: 'Supplier',
    ports: 'Port',
    chas: 'CHA agent',
    modes: 'Shipment mode',
    countries: 'Country',
    'payment-terms': 'Payment term',
    prw: 'PRW/payment status',
    warehouses: 'Warehouse',
    materials: 'Material',
    'material-id': 'Material ID',
  };
  return labels[type];
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0.5rem 0.75rem',
  border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 650, cursor: 'pointer',
};
const categoryLinkStyle: CSSProperties = {
  padding: '0.45rem 0.7rem', borderRadius: 7, textDecoration: 'none', fontSize: '0.78rem', fontWeight: 650,
};
const fieldLabelStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 650,
};
const inputStyle: CSSProperties = {
  width: '100%', padding: '0.58rem 0.65rem', border: '1px solid var(--border)', borderRadius: 7,
  background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.84rem',
};
const cellStyle: CSSProperties = { padding: '0.7rem 0.85rem', whiteSpace: 'nowrap' };