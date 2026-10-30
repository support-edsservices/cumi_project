'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { navSections } from '@/data/navigation';
import type { NavItem, NavChild } from '@/data/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { FONT_SIZES } from '@/context/ThemeContext';

/* ── Keyframe animations for marquee ── */
const MARQUEE_CSS = `
@keyframes sidebarMarquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.moving-company-name {
  display: inline-block;
  white-space: nowrap;
  animation: sidebarMarquee 10s linear infinite;
}
`;

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

  const childActive = !!item.children?.some(c => c.href === pathname);
  const [open, setOpen] = useState(childActive);

  const isActive = !item.children && item.href === pathname;
  const Icon = item.icon;

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
      <style>{MARQUEE_CSS}</style>
      <button
        type="button"
        className={`sidebar-backdrop${mobileOpen ? ' visible' : ''}`}
        aria-label="Close navigation menu"
        onClick={() => setMobileOpen(false)}
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        
        {/* Top Header: Full Width & Height Logo Container */}
        <div style={{
          position: 'relative',
          padding: '0.75rem 0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width:"100%"
        }}>
          {/* Full Width & Height Image Box */}
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src="/assets/projectLogo.png"
              alt="Project Logo"
              style={{
                width: 'auto',
                height: 80,
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ position: 'absolute', right: '0.5rem', top: '0.5rem' }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Section */}
        <nav style={{ flex: 1, padding: '0 0.5rem', paddingBottom: '0.5rem', overflowY: 'auto' }}>
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

        {/* Footer Section: Company Image, Moving Text & Logout */}
        <div style={{
          padding: '0.75rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          {/* Company Image & Moving Text (Hidden when collapsed) */}
          {!collapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.4rem 0.5rem',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              overflow: 'hidden',
              flexDirection: 'column',
            }}>
              {/* Rounded Image Above Logout */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                overflow: 'hidden', background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  src="/assets/EDS.png" // Replace with your company image path
                  alt="Company Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {/* Moving Company Name Container */}
              <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                <div className="moving-company-name" style={{ fontSize: FONT_SIZES.bodySmall, fontWeight: 700, color: '#fff' }}>
                  Expert Digital Support
                </div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            className="sidebar-logout"
            onClick={logout}
            title={collapsed ? 'Logout' : undefined}
            aria-label="Logout"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', width: '100%', padding: '0.55rem 0.625rem', borderRadius: 8,
              background: 'rgb(193, 52, 52)', border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', color: '#fff', fontSize: FONT_SIZES.body, fontWeight: 600,
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <LogOut size={15} /> 
            <span className="sidebar-label">Logout</span>
          </button>
        </div>

      </aside>
    </>
  );
}