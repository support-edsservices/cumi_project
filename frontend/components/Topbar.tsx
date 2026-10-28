'use client';
import { Bell, Search, RefreshCw, Calendar, ChevronDown, Menu, Moon, Sun, User } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const { setMobileOpen } = useSidebar();

  return (
    <header className="topbar">
      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Open navigation menu"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={18} />
      </button>
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

      {/* User avatar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem',
        padding: '0.275rem 0.6rem', borderRadius: 8,
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        cursor: 'pointer', flexShrink: 0,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <User size={13} color="#fff" />
        </div>
        <div className="topbar-user-details" style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: 'var(--font-size-body-small)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {user?.name ?? 'Guest'}
          </div>
          <div style={{ fontSize: 'var(--font-size-tiny)', color: 'var(--text-muted)' }}>
            {user?.role ?? 'Signed out'}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ── Shared inline styles ── */
const filterBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.35rem',
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  borderRadius: 7, padding: '0.35rem 0.65rem',
  color: 'var(--text-secondary)', fontSize: 'var(--font-size-body-compact)',
  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  fontFamily: 'inherit', fontWeight: 500,
};

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
