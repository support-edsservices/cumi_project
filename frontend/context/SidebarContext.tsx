'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/data/ENUM';

interface SidebarContextValue {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsedState(localStorage.getItem(STORAGE_KEYS.SIDEBAR) === 'true');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setCollapsed = (nextCollapsed: boolean) => {
    setCollapsedState(nextCollapsed);
    localStorage.setItem(STORAGE_KEYS.SIDEBAR, String(nextCollapsed));
  };

  const toggleCollapsed = () => setCollapsed(!collapsed);

  return (
    <SidebarContext.Provider
      value={{ collapsed, mobileOpen, toggleCollapsed, setCollapsed, setMobileOpen }}
    >
      <div className={`app-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider.');
  return context;
}
