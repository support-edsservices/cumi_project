'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  CheckCircle,
  Clock,
  Shield,
  Trash2,
  Search,
  UserCheck,
  UserX,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAuth, AuthUser } from '@/context/AuthContext';
import { API_ENDPOINTS, BASE_URL, ROLE_LABELS, ROUTES } from '@/data/ENUM';

interface ManagedUser {
  phone_number: string;
  user_name: string;
  email?: string | null;
  role: string;
  is_granted: boolean;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isAdminOrSuperAdmin, fetchWithAuth } = useAuth();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'granted'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Security check: only admin and superadmin can access this page
  useEffect(() => {
    if (user && !isAdminOrSuperAdmin) {
      router.replace(ROUTES.HOME);
    }
  }, [user, isAdminOrSuperAdmin, router]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetchWithAuth(`${BASE_URL}${API_ENDPOINTS.USERS}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setNotification({ type: 'error', message: err.detail || 'Failed to fetch users.' });
      }
    } catch (e) {
      setNotification({ type: 'error', message: 'Network error while retrieving users.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminOrSuperAdmin) {
      loadUsers();
    }
  }, [isAdminOrSuperAdmin]);

  const handleToggleGrant = async (targetPhone: string, currentStatus: boolean) => {
    try {
      setActionLoading(targetPhone);
      setNotification(null);
      const nextStatus = !currentStatus;

      const res = await fetchWithAuth(`${BASE_URL}${API_ENDPOINTS.GRANT_USER}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: targetPhone,
          is_granted: nextStatus,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          message: data.message || `Access ${nextStatus ? 'granted' : 'revoked'} successfully.`,
        });
        setUsers((prev) =>
          prev.map((u) => (u.phone_number === targetPhone ? { ...u, is_granted: nextStatus } : u))
        );
      } else {
        setNotification({ type: 'error', message: data.detail || 'Failed to update access status.' });
      }
    } catch (e) {
      setNotification({ type: 'error', message: 'Action failed. Please try again.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (targetPhone: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName}" (${targetPhone})?`)) {
      return;
    }

    try {
      setActionLoading(targetPhone);
      setNotification(null);

      const res = await fetchWithAuth(`${BASE_URL}${API_ENDPOINTS.USERS}/${encodeURIComponent(targetPhone)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok) {
        setNotification({ type: 'success', message: data.message || 'User deleted successfully.' });
        setUsers((prev) => prev.filter((u) => u.phone_number !== targetPhone));
      } else {
        setNotification({ type: 'error', message: data.detail || 'Failed to delete user.' });
      }
    } catch (e) {
      setNotification({ type: 'error', message: 'Delete failed. Please try again.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Filter and search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone_number.includes(searchQuery) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        u.role.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (filterTab === 'pending') return !u.is_granted;
      if (filterTab === 'granted') return u.is_granted;
      return true;
    });
  }, [users, searchQuery, filterTab]);

  const stats = useMemo(() => {
    const total = users.length;
    const granted = users.filter((u) => u.is_granted).length;
    const pending = users.filter((u) => !u.is_granted).length;
    return { total, granted, pending };
  }, [users]);

  if (!isAdminOrSuperAdmin) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-section-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>
            User Access Approvals
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Manage user authorization, approve waiting list requests, and regulate role access.
          </p>
        </div>
        <button
          onClick={loadUsers}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.85rem',
            borderRadius: 7,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderRadius: 8,
          background: notification.type === 'success' ? '#10b98115' : '#ef444415',
          border: `1px solid ${notification.type === 'success' ? '#10b98140' : '#ef444440'}`,
          color: notification.type === 'success' ? '#10b981' : '#ef4444',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Total Users */}
        <div className="stat-card" style={{ background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Registered</span>
            <Users size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>All accounts in database</div>
        </div>

        {/* Granted Access */}
        <div className="stat-card" style={{ background: 'var(--bg-card)', borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Granted Access</span>
            <UserCheck size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.35rem' }}>
            {stats.granted}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Allowed to log in</div>
        </div>

        {/* Pending Approvals */}
        <div className="stat-card" style={{ background: 'var(--bg-card)', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Waiting List</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.35rem' }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Requires your approval</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '0.875rem 1.125rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.875rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {(['all', 'pending', 'granted'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: 6,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  background: filterTab === tab ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                  color: filterTab === tab ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab === 'all' && `All (${stats.total})`}
                {tab === 'pending' && `Waiting List (${stats.pending})`}
                {tab === 'granted' && `Granted (${stats.granted})`}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '0 0.65rem',
            width: '100%',
            maxWidth: 280,
          }}>
            <Search size={14} color="var(--text-muted)" style={{ marginRight: '0.5rem', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search user, phone, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {['User Name', 'Phone Number', 'Email', 'Role', 'Access Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
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
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Loading user records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => {
                  const isCurrentLoggedIn = u.phone_number === user?.phone_number;
                  const isSelf = isCurrentLoggedIn;
                  const isTargetSuperAdmin = u.role.toLowerCase() === 'superadmin';
                  const isTargetAdmin = u.role.toLowerCase() === 'admin';
                  const isCallerSuperAdmin = user?.role?.toLowerCase() === 'superadmin';
                  const isActionBusy = actionLoading === u.phone_number;

                  // Permission Rule 1: Admin can NEVER delete or modify Super Admin
                  // Permission Rule 2: Super Admin CAN delete Admin and others
                  let canDelete = false;
                  let deleteDisabledReason = '';

                  if (isSelf) {
                    canDelete = false;
                    deleteDisabledReason = 'You cannot delete your own account.';
                  } else if (isTargetSuperAdmin) {
                    canDelete = false;
                    deleteDisabledReason = 'Admins can never delete the Super Admin.';
                  } else if (isTargetAdmin) {
                    if (isCallerSuperAdmin) {
                      canDelete = true;
                    } else {
                      canDelete = false;
                      deleteDisabledReason = 'Only a Super Admin has permission to delete the Admin.';
                    }
                  } else {
                    // Normal users (manager, user) can be deleted by admin or superadmin
                    canDelete = true;
                  }

                  const canToggleGrant = !(isTargetSuperAdmin && !isCallerSuperAdmin);
                  const grantDisabledReason = !canToggleGrant
                    ? 'Admins cannot modify Super Admin permissions.'
                    : u.is_granted
                    ? 'Revoke login access'
                    : 'Grant login access';

                  return (
                    <tr
                      key={u.phone_number}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 1 ? 'var(--bg-secondary)' : 'transparent',
                      }}
                    >
                      {/* Name */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{u.user_name}</span>
                          {isCurrentLoggedIn && (
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: '#3b82f620',
                              color: '#3b82f6',
                              fontWeight: 700,
                            }}>
                              YOU
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {u.phone_number}
                      </td>

                      {/* Email */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        {u.email || '—'}
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <RoleBadge role={u.role} />
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {u.is_granted ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 12,
                            background: '#10b98118',
                            color: '#10b981',
                          }}>
                            <CheckCircle size={12} /> Granted
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 12,
                            background: '#f59e0b18',
                            color: '#f59e0b',
                          }}>
                            <Clock size={12} /> Waiting List
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Grant / Revoke Toggle */}
                          <button
                            onClick={() => handleToggleGrant(u.phone_number, u.is_granted)}
                            disabled={isActionBusy || !canToggleGrant}
                            title={grantDisabledReason}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: 6,
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              border: 'none',
                              cursor: isActionBusy || !canToggleGrant ? 'not-allowed' : 'pointer',
                              background: u.is_granted ? '#ef444418' : '#10b98118',
                              color: u.is_granted ? '#ef4444' : '#10b981',
                              opacity: !canToggleGrant ? 0.45 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {isActionBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : u.is_granted ? (
                              <>
                                <UserX size={13} />
                                <span>Revoke</span>
                              </>
                            ) : (
                              <>
                                <UserCheck size={13} />
                                <span>Grant Access</span>
                              </>
                            )}
                          </button>

                          {/* Delete Button */}
                          {!isSelf && (
                            <button
                              onClick={() => handleDeleteUser(u.phone_number, u.user_name)}
                              disabled={isActionBusy || !canDelete}
                              title={canDelete ? `Delete ${ROLE_LABELS[u.role] || u.role}` : deleteDisabledReason}
                              style={{
                                padding: '0.35rem 0.5rem',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: canDelete ? 'transparent' : 'var(--bg-secondary)',
                                color: canDelete ? '#ef4444' : 'var(--text-muted)',
                                cursor: canDelete && !isActionBusy ? 'pointer' : 'not-allowed',
                                opacity: canDelete ? 1 : 0.4,
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
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
  );
}

function RoleBadge({ role }: { role: string }) {
  const r = role.toLowerCase();
  let bg = '#64748b20';
  let color = '#64748b';

  if (r === 'superadmin') {
    bg = '#ef444420';
    color = '#ef4444';
  } else if (r === 'admin') {
    bg = '#8b5cf620';
    color = '#8b5cf6';
  } else if (r === 'manager') {
    bg = '#3b82f620';
    color = '#3b82f6';
  } else {
    bg = '#10b98120';
    color = '#10b981';
  }

  return (
    <span style={{
      fontSize: '0.72rem',
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      padding: '2px 7px',
      borderRadius: 6,
      background: bg,
      color: color,
    }}>
      {ROLE_LABELS[r] || role}
    </span>
  );
}
