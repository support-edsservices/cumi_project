'use client';
import { Bell, Search, RefreshCw, Calendar, ChevronDown, User } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { theme, toggle } = useTheme();

  return (
    <header className="topbar">
      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          fontSize: '0.975rem', fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Date range */}
      <button style={filterBtn}>
        <Calendar size={13} />
        <span>May 20 – May 26, 2026</span>
        <ChevronDown size={12} />
      </button>

      {/* Quick filters */}
      {['All Sites', 'All Buildings', 'All Meters'].map(f => (
        <button key={f} style={filterBtn}>
          {f} <ChevronDown size={12} />
        </button>
      ))}

      {/* Search */}
      <IconBtn><Search size={14} /></IconBtn>

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

      {/* Auto refresh indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.35rem',
        fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0,
      }}>
        <span className="pulse" style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%' }} />
        Auto Refresh
        <RefreshCw size={11} style={{ cursor: 'pointer', opacity: 0.65 }} />
      </div>

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
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Admin</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Administrator</div>
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
  color: 'var(--text-secondary)', fontSize: '0.76rem',
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
