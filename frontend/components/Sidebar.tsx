'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Zap } from 'lucide-react';
import { navSections } from '@/data/navigation';
import type { NavItem, NavChild } from '@/data/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { FONT_SIZES } from '@/context/ThemeContext';

/* ── Sub-link (leaf node) ── */
function ChildLink({ child }: { child: NavChild }) {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebar();
  const active = pathname === child.href;
  return (
    <Link
      href={child.href}
      onClick={() => setMobileOpen(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.4rem 0.875rem 0.4rem 1rem',
        borderRadius: 6,
        fontSize: FONT_SIZES.nestedLink,
        fontWeight: active ? 600 : 400,
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        background: active ? 'rgba(59,130,246,0.25)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLElement).style.color = '#fff';
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: active ? '#3b82f6' : 'rgba(255,255,255,0.25)',
      }} />
      {child.label}
    </Link>
  );
}

/* ── Nav item – handles both leaf and parent ── */
function NavItemRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const { collapsed, setCollapsed, setMobileOpen } = useSidebar();

  /* Auto-open if a child is active */
  const childActive = !!item.children?.some(c => c.href === pathname);
  const [open, setOpen] = useState(childActive);

  const isActive = !item.children && item.href === pathname;
  const Icon = item.icon;

  /* Parent with children */
  if (item.children?.length) {
    return (
      <div>
        <button
          type="button"
          className={`nav-item${childActive ? ' active' : ''}`}
          style={{ fontSize: FONT_SIZES.navItem }}
          title={collapsed ? item.label : undefined}
          aria-expanded={open}
          onClick={() => {
            if (collapsed) setCollapsed(false);
            setOpen(o => !o);
          }}
        >
          <Icon size={15} style={{ flexShrink: 0 }} />
          <span className="nav-label" style={{ flex: 1 }}>{item.label}</span>
          <ChevronDown
            className="nav-chevron"
            size={13}
            style={{
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              opacity: 0.5,
            }}
          />
        </button>
        {open && !collapsed && (
          <div style={{
            marginLeft: '1.25rem',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            paddingLeft: '0.25rem',
            marginBottom: '0.25rem',
          }}>
            {item.children.map(c => <ChildLink key={c.href} child={c} />)}
          </div>
        )}
      </div>
    );
  }

  /* Leaf */
  return (
    <Link
      href={item.href ?? '#'}
      className={`nav-item${isActive ? ' active' : ''}`}
      style={{ fontSize: FONT_SIZES.navItem }}
      title={collapsed ? item.label : undefined}
      onClick={() => setMobileOpen(false)}
    >
      <Icon size={15} style={{ flexShrink: 0 }} />
      <span className="nav-label" style={{ flex: 1 }}>{item.label}</span>
      {item.badge !== undefined && !collapsed && (
        <span style={{
          fontSize: FONT_SIZES.badge, fontWeight: 700,
          padding: '1px 6px', borderRadius: 10,
          background:
            item.badgeColor === 'red'   ? '#ef4444' :
            item.badgeColor === 'green' ? '#10b981' : '#3b82f6',
          color: '#fff',
          letterSpacing: '0.03em',
        }}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/* ── Sidebar shell ── */
export default function Sidebar() {
  const { logout, isAdminOrSuperAdmin } = useAuth();
  const { collapsed, mobileOpen, toggleCollapsed, setMobileOpen } = useSidebar();

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop${mobileOpen ? ' visible' : ''}`}
        aria-label="Close navigation menu"
        onClick={() => setMobileOpen(false)}
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      {/* Logo */}
      <div style={{
        position: 'relative',
        padding: '1rem 1rem 0.875rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 10px rgba(245,158,11,0.45)',
        }}>
          <Zap size={17} color="#fff" fill="#fff" />
        </div>
        <div className="sidebar-brand-copy">
          <div style={{ fontSize: FONT_SIZES.brand, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            EnergyMeter
          </div>
          <div style={{ fontSize: FONT_SIZES.micro, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
            ENTERPRISE EDITION
          </div>
        </div>
        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0 0.5rem', paddingBottom: '0.5rem' }}>
        {navSections
          .filter(section => !section.adminOnly || isAdminOrSuperAdmin)
          .map(section => (
            <div key={section.title}>
              <div className="nav-section" style={{ fontSize: FONT_SIZES.navSection }}>
                {section.title}
              </div>
              {section.items.map(item => (
                <NavItemRow key={item.label} item={item} />
              ))}
            </div>
          ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '0.625rem 0.75rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <button
          type="button"
          className="sidebar-logout"
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          aria-label="Logout"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            width: '100%', padding: '0.45rem 0.625rem', borderRadius: 7,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.35)', fontSize: FONT_SIZES.body,
            transition: 'color 0.12s, background 0.12s',
          }}
        >
          <LogOut size={14} /> <span className="sidebar-label">Logout</span>
        </button>
        <div className="sidebar-version" style={{ fontSize: FONT_SIZES.micro, color: 'rgba(255,255,255,0.18)', paddingLeft: '0.375rem', marginTop: '0.375rem' }}>
          v1.0.0 · © 2026 EnergyMeter
        </div>
      </div>
      </aside>
    </>
  );
}
