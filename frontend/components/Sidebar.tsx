'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Zap, LogOut } from 'lucide-react';
import { navSections } from '@/data/navigation';
import type { NavItem, NavChild } from '@/data/navigation';

/* ── Sub-link (leaf node) ── */
function ChildLink({ child }: { child: NavChild }) {
  const pathname = usePathname();
  const active = pathname === child.href;
  return (
    <Link
      href={child.href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.4rem 0.875rem 0.4rem 1rem',
        borderRadius: 6,
        fontSize: '0.8rem',
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

  /* Auto-open if a child is active */
  const childActive = !!item.children?.some(c => c.href === pathname);
  const [open, setOpen] = useState(childActive);

  const isActive = !item.children && item.href === pathname;
  const Icon = item.icon;

  /* Parent with children */
  if (item.children?.length) {
    return (
      <div>
        <div
          className={`nav-item${childActive ? ' active' : ''}`}
          onClick={() => setOpen(o => !o)}
          style={{ justifyContent: 'flex-start' }}
        >
          <Icon size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{item.label}</span>
          <ChevronDown
            size={13}
            style={{
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              opacity: 0.5,
            }}
          />
        </div>
        {open && (
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
    <Link href={item.href ?? '#'} className={`nav-item${isActive ? ' active' : ''}`}>
      <Icon size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge !== undefined && (
        <span style={{
          fontSize: '0.6rem', fontWeight: 700,
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
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{
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
        <div>
          <div style={{ fontSize: '0.93rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            EnergyMeter
          </div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
            ENTERPRISE EDITION
          </div>
        </div>
      </div>

      {/* Active plant badge */}
      <div style={{ padding: '0.625rem 0.75rem' }}>
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.22)',
          borderRadius: 8,
          padding: '0.45rem 0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span className="pulse" style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#10b981', flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.07em' }}>
              ACTIVE PLANT
            </div>
            <div style={{ fontSize: '0.77rem', fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
              Delphi-TVS Technologies
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0 0.5rem', paddingBottom: '0.5rem' }}>
        {navSections.map(section => (
          <div key={section.title}>
            <div className="nav-section">{section.title}</div>
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
        <button style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          width: '100%', padding: '0.45rem 0.625rem', borderRadius: 7,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem',
          transition: 'color 0.12s, background 0.12s',
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#fff';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <LogOut size={14} /> Logout
        </button>
        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.18)', paddingLeft: '0.375rem', marginTop: '0.375rem' }}>
          v1.0.0 · © 2026 EnergyMeter
        </div>
      </div>
    </aside>
  );
}
