'use client';
import { useState } from 'react';
import { Bell, Menu, Moon, Sun, User, X, AlertTriangle, Anchor } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { ROLE_LABELS } from '@/data/ENUM';
import { Shipment } from '@/types/shipment';
import { formatDMY, getPaymentDueDate } from '@/data/shipmentData';

interface TopbarProps {
  title: string;
  subtitle?: string;
  overduePayments?: Shipment[];
  etaArrived?: Shipment[];
  onShipmentClick?: (shipment: Shipment) => void;
}

export default function Topbar({ title, subtitle, overduePayments = [], etaArrived = [], onShipmentClick }: TopbarProps) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const { setMobileOpen } = useSidebar();
  const [showNotifications, setShowNotifications] = useState(false);

  const displayName = user?.user_name || user?.name || 'Guest';
  const displayRole = user?.role
    ? ROLE_LABELS[user.role.toLowerCase()] || user.role.toUpperCase()
    : 'Signed out';

  const notificationCount = overduePayments.length + etaArrived.length;

  return (
    <header className="topbar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem' }}>
      {/* Mobile menu button */}
      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Open navigation menu"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={18} />
      </button>

      {/* ── LEFT IMAGE LOGO ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <img
          src="/assets/cumi_svg.jpeg"
          alt="DSR System logo"
          style={{ height: 50, width: 'auto', maxWidth: 48, objectFit: 'contain', borderRadius: 4 }}
        />
      </div>

      {/* Page title */}
      <div className="topbar-title" style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          fontSize: 'var(--font-size-heading)', fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 'var(--font-size-small-plus)', color: 'var(--text-muted)', marginTop: 1 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <IconBtn onClick={() => setShowNotifications(!showNotifications)}>
          <Bell size={14} />
        </IconBtn>
        {notificationCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 7, height: 7, background: '#ef4444',
            borderRadius: '50%', border: '1.5px solid var(--bg-topbar)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Notification Dropdown */}
        {showNotifications && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99,
              }}
              onClick={() => setShowNotifications(false)}
            />
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 320,
              maxHeight: 400,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              zIndex: 100,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{
                  fontSize: 'var(--font-size-body-small)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>
                  Notifications ({notificationCount})
                </span>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 2,
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{
                maxHeight: 340,
                overflowY: 'auto',
                padding: '0.5rem',
              }}>
                {overduePayments.length === 0 && etaArrived.length === 0 ? (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--font-size-body-small)',
                  }}>
                    No notifications
                  </div>
                ) : (
                  <>
                    {/* Payment Overdues */}
                    {overduePayments.length > 0 && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{
                          padding: '0.4rem 0.6rem',
                          fontSize: 'var(--font-size-tiny)',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                        }}>
                          Payment Overdues ({overduePayments.length})
                        </div>
                        {overduePayments.slice(0, 5).map((shipment) => (
                          <div
                            key={shipment.id}
                            onClick={() => {
                              onShipmentClick?.(shipment);
                              setShowNotifications(false);
                            }}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: 8,
                              marginBottom: '0.35rem',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                              transition: 'background 0.15s, border-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--bg-primary)';
                              e.currentTarget.style.borderColor = 'var(--accent-blue)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'var(--bg-secondary)';
                              e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.25rem',
                            }}>
                              <AlertTriangle size={12} color="#ef4444" />
                              <span style={{
                                fontSize: 'var(--font-size-body-small)',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}>
                                {shipment.poNo}
                              </span>
                            </div>
                            <div style={{
                              fontSize: 'var(--font-size-tiny)',
                              color: 'var(--text-secondary)',
                            }}>
                              {shipment.supplier} • Due: {getPaymentDueDate(shipment) ? formatDMY(getPaymentDueDate(shipment)!) : 'N/A'}
                            </div>
                          </div>
                        ))}
                        {overduePayments.length > 5 && (
                          <div style={{
                            padding: '0.4rem 0.75rem',
                            fontSize: 'var(--font-size-tiny)',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                          }}>
                            +{overduePayments.length - 5} more overdue payments
                          </div>
                        )}
                      </div>
                    )}

                    {/* ETA Arrived */}
                    {etaArrived.length > 0 && (
                      <div>
                        <div style={{
                          padding: '0.4rem 0.6rem',
                          fontSize: 'var(--font-size-tiny)',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                        }}>
                          ETA Arrived ({etaArrived.length})
                        </div>
                        {etaArrived.slice(0, 5).map((shipment) => (
                          <div
                            key={shipment.id}
                            onClick={() => {
                              onShipmentClick?.(shipment);
                              setShowNotifications(false);
                            }}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: 8,
                              marginBottom: '0.35rem',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                              transition: 'background 0.15s, border-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--bg-primary)';
                              e.currentTarget.style.borderColor = 'var(--accent-blue)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'var(--bg-secondary)';
                              e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.25rem',
                            }}>
                              <Anchor size={12} color="#10b981" />
                              <span style={{
                                fontSize: 'var(--font-size-body-small)',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}>
                                {shipment.poNo}
                              </span>
                            </div>
                            <div style={{
                              fontSize: 'var(--font-size-tiny)',
                              color: 'var(--text-secondary)',
                            }}>
                              {shipment.supplier} • ETA: {shipment.eta ? formatDMY(shipment.eta) : 'N/A'}
                            </div>
                          </div>
                        ))}
                        {etaArrived.length > 5 && (
                          <div style={{
                            padding: '0.4rem 0.75rem',
                            fontSize: 'var(--font-size-tiny)',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                          }}>
                            +{etaArrived.length - 5} more ETA arrived
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className={`theme-toggle${theme === 'dark' ? ' dark' : ''}`}
        aria-label="Toggle light / dark mode"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      />
      <button
        type="button"
        className="mobile-theme-button"
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* ── RIGHT IMAGE LOGO ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <img
          src="/assets/murugappa.jpeg" // Replace with your right image path
          alt="Group Logo"
          style={{ height: 50, width: 'auto', objectFit: 'contain', borderRadius: 4 }}
        />
      </div>

      {/* User profile pill */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
          padding: '0.275rem 0.6rem', borderRadius: 8,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          flexShrink: 0,
        }}
        title={`User: ${displayName} (${displayRole})`}
      >
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <User size={13} color="#fff" />
        </div>
        <div className="topbar-user-details" style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: 'var(--font-size-body-small)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {displayName}
          </div>
          <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)' }}>
            {displayRole}
          </div>
        </div>
      </div>
    </header>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32, border: '1px solid var(--border)',
        borderRadius: 7, background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}