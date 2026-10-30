'use client';
import { Bell, Menu, Moon, Sun, User } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { ROLE_LABELS } from '@/data/ENUM';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const { setMobileOpen } = useSidebar();

  const displayName = user?.user_name || user?.name || 'Guest';
  const displayRole = user?.role
    ? ROLE_LABELS[user.role.toLowerCase()] || user.role.toUpperCase()
    : 'Signed out';

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
          src="/images/logo-left.png" // Replace with your left image path
          alt="Company Logo"
          style={{ height: 36, width: 'auto', objectFit: 'contain', borderRadius: 4 }}
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
        <IconBtn>
          <Bell size={14} />
        </IconBtn>
        <span style={{
          position: 'absolute', top: 4, right: 4,
          width: 7, height: 7, background: '#ef4444',
          borderRadius: '50%', border: '1.5px solid var(--bg-topbar)',
          pointerEvents: 'none',
        }} />
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
          src="/images/logo-right.png" // Replace with your right image path
          alt="Group Logo"
          style={{ height: 36, width: 'auto', objectFit: 'contain', borderRadius: 4 }}
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

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{
      width: 32, height: 32, border: '1px solid var(--border)',
      borderRadius: 7, background: 'var(--bg-secondary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0,
      fontFamily: 'inherit',
    }}>
      {children}
    </button>
  );
}