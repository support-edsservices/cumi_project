// Sidebar is rendered entirely from this file.
// Add / remove / nest links here and the sidebar updates automatically.
// `icon` must be a key of the ICONS map in components/Sidebar.tsx.

// export interface NavItem {
//   id: string;
//   label: string;
//   icon: string;
//   href?: string; // leaf link
//   children?: { label: string; href: string }[]; // nested links
// }

// export const NAVIGATION: NavItem[] = [
//   { id: "energy", label: "Energy Dashboard", icon: "dashboard", href: "/dashboard" },
//   {
//     id: "meters",
//     label: "Meters",
//     icon: "gauge",
//     children: [
//       { label: "All Meters", href: "/meters" },
//       { label: "Meter Health", href: "/meters/health" },
//       { label: "Add Meter", href: "/meters/add" },
//     ],
//   },
//   {
//     id: "analytics",
//     label: "Analytics",
//     icon: "chart",
//     children: [
//       { label: "Consumption", href: "/analytics/consumption" },
//       { label: "Peak Demand", href: "/analytics/demand" },
//       { label: "Cost Analysis", href: "/analytics/cost" },
//     ],
//   },
//   {
//     id: "reports",
//     label: "Reports",
//     icon: "report",
//     children: [
//       { label: "Daily Report", href: "/reports/daily" },
//       { label: "Monthly Report", href: "/reports/monthly" },
//     ],
//   },
//   { id: "alerts", label: "Alerts", icon: "bell", href: "/alerts" },
//   {
//     id: "settings",
//     label: "Settings",
//     icon: "settings",
//     children: [
//       { label: "Profile", href: "/settings/profile" },
//       { label: "Appearance", href: "/settings/appearance" },
//     ],
//   },
// ];

// export function findNavLabel(pathname: string): string {
//   for (const item of NAVIGATION) {
//     if (item.href === pathname) return item.label;
//     const child = item.children?.find((c) => c.href === pathname);
//     if (child) return child.label;
//   }
//   return "Dashboard";
// }



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
          { label: 'Plant Monthly Energy',    href: '/reports/110kv/monthly-energy' },
          { label: 'Plant Usage',             href: '/reports/110kv/plant-usage' },
          { label: 'Assembly',                href: '/reports/110kv/assembly' },
          { label: 'Assembly Breakdown',      href: '/reports/110kv/assembly-breakdown' },
          { label: 'Assembly Detailed',       href: '/reports/110kv/assembly-detailed' },
          { label: 'Instantaneous Power',     href: '/reports/110kv/instantaneous' },
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
    title: 'Metering',
    items: [
      { label: 'Meters', href: '/meters', icon: Gauge },
      {
        label: 'Energy Groups', icon: Layers,
        children: [
          { label: 'Grid Consumption', href: '/groups/grid' },
          { label: 'DG Consumption',   href: '/groups/dg' },
          { label: 'Solar Generation', href: '/groups/solar' },
          { label: 'CO₂ Emission',     href: '/groups/co2' },
        ],
      },
      {
        label: 'Flow Monitoring', icon: Map,
        children: [
          { label: 'SLD Diagram',    href: '/flow/sld' },
          { label: 'Parameter View', href: '/flow/parameter' },
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
  {
    title: 'System',
    items: [
      { label: 'Alarms & Events', href: '/alarms',  icon: AlertTriangle, badge: 3, badgeColor: 'red' },
      { label: 'Reports',         href: '/reports', icon: FileText },
      {
        label: 'System Health', icon: Activity,
        children: [
          { label: 'Device Status',    href: '/system/devices' },
          { label: 'Device Data Login',href: '/system/data-login' },
          { label: 'Condition Monitor',href: '/system/condition' },
        ],
      },
      { label: 'Tariff & Cost',  href: '/tariff',   icon: Battery },
      { label: 'Configuration',  href: '/settings', icon: Settings },
      { label: 'Users & Roles',  href: '/users',    icon: Users },
    ],
  },
];
