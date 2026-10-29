// data/navigation.ts

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Activity, Gauge, BarChart3, Bell, FileText,
  Zap, Settings, Users, Sun, Battery, TrendingUp,
  Clock, AlertTriangle, Map, Cpu, Layers,
  Package, FilePlus,
} from 'lucide-react';

export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeColor?: 'green' | 'red' | 'blue';
  children?: NavChild[];
}

export interface NavSection {
  title: string;
  adminOnly?: boolean;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Supply Chain',
    items: [
      { label: 'New Entry', href: '/shipments/entry', icon: FilePlus },
    ],
  },
  {
    title: 'Administration',
    adminOnly: true,
    items: [
      { label: 'User Approvals', href: '/admin/users', icon: Users },
    ],
  },
 
  // {
  //   title: 'Analytics',
  //   items: [
  //     { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  //     {
  //       label: 'KPI Group', icon: TrendingUp,
  //       children: [
  //         { label: 'Energy KPIs', href: '/kpi/energy' },
  //         { label: 'Cost KPIs',   href: '/kpi/cost' },
  //         { label: 'Demand KPIs', href: '/kpi/demand' },
  //       ],
  //     },
  //     {
  //       label: 'Parameter Wise', icon: Cpu,
  //       children: [
  //         { label: 'Voltage Trends',  href: '/param/voltage' },
  //         { label: 'Current Trends',  href: '/param/current' },
  //         { label: 'Power Factor',    href: '/param/power-factor' },
  //         { label: 'Frequency',       href: '/param/frequency' },
  //         { label: 'THD Analysis',    href: '/param/thd' },
  //       ],
  //     },
  //   ],
  // },
];
