// data/navigation.ts

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Activity, Gauge, BarChart3, Bell, FileText,
  Zap, Settings, Users, Sun, Battery, TrendingUp,
  Clock, AlertTriangle, Map, Cpu, Layers,
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
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard',           href: '/',          icon: LayoutDashboard },
      { label: 'Real-time Monitoring',href: '/realtime',  icon: Activity, badge: 'Live', badgeColor: 'green' },
    ],
  },
  {
    title: 'Energy Reports',
    items: [
      {
        label: '110kV Reports', icon: Zap,
        children: [
          { label: 'Plant Overview',          href: '/reports/110kv/plant-overview' },
        ],
      },
      {
        label: 'Incomer Analysis', icon: TrendingUp,
        children: [
          { label: 'KPI Dashboard',     href: '/incomer/kpi' },
          { label: 'Voltage & Current', href: '/incomer/voltage-current' },
          { label: 'Demand Analysis',   href: '/incomer/demand' },
          { label: 'Power Quality',     href: '/incomer/power-quality' },
          { label: 'Solar Generation',  href: '/incomer/solar' },
        ],
      },
      {
        label: 'Shift Analysis', icon: Clock,
        children: [
          { label: 'Shift Summary',     href: '/shift/summary' },
          { label: 'Peak Time Analysis',href: '/shift/peak-time' },
          { label: 'Energy Comparison', href: '/shift/comparison' },
        ],
      },
    ],
  },
  
  {
    title: 'Analytics',
    items: [
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      {
        label: 'KPI Group', icon: TrendingUp,
        children: [
          { label: 'Energy KPIs', href: '/kpi/energy' },
          { label: 'Cost KPIs',   href: '/kpi/cost' },
          { label: 'Demand KPIs', href: '/kpi/demand' },
        ],
      },
      {
        label: 'Parameter Wise', icon: Cpu,
        children: [
          { label: 'Voltage Trends',  href: '/param/voltage' },
          { label: 'Current Trends',  href: '/param/current' },
          { label: 'Power Factor',    href: '/param/power-factor' },
          { label: 'Frequency',       href: '/param/frequency' },
          { label: 'THD Analysis',    href: '/param/thd' },
        ],
      },
    ],
  },
  
];
