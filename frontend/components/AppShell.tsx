'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { Zap, Loader2 } from 'lucide-react';
import { ROUTES } from '@/data/ENUM';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();

  const isAuthPage = pathname === ROUTES.LOGIN || pathname === ROUTES.SIGNUP;

  // On auth pages (login / signup), render standalone screen
  if (isAuthPage) {
    return <main style={{ minHeight: '100vh', width: '100vw' }}>{children}</main>;
  }

  // If checking tokens on app start / page load, show splash loading
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        gap: '1rem',
      }}>
        <div style={{
          width: 50,
          height: 50,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.45)',
        }}>
          <Zap size={26} color="#fff" fill="#fff" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <Loader2 size={18} className="animate-spin" />
          <span>Verifying CUMI Enterprise Session...</span>
        </div>
      </div>
    );
  }

  // Authenticated Dashboard Layout
  return (
    <>
      <Sidebar />
      <Topbar title="Dashboard" subtitle="" />
      <main className="main-content">{children}</main>
    </>
  );
}
