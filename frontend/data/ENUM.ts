// Central constants for the CUMI EnergyMeter Enterprise App.
// Supports both HTTP (local dev) and HTTPS (cloud deployment).

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : "http://localhost:8001");

// ─────────────────────────────────────────────────────────────────────────────
// Common Roles Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_ROLES = ["admin", "superadmin", "manager", "user"] as const;
export type UserRole = (typeof ALL_ROLES)[number];

export const SINGLETON_ROLES = ["admin", "superadmin"] as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  superadmin: "Super Admin",
  manager: "Manager",
  user: "User",
};

export const API_ENDPOINTS = {
  LOGIN: "/auth/login",
  SIGNUP: "/auth/signup",
  REFRESH: "/auth/refresh",
  LOGOUT: "/auth/logout",
  ME: "/auth/me",
  AVAILABLE_ROLES: "/auth/available-roles",
  USERS: "/auth/users",
  GRANT_USER: "/auth/users/grant",
} as const;

export const STORAGE_KEYS = {
  THEME: "em-theme",
  FONT_SCALE: "em-font-scale",
  ACCESS_TOKEN: "cumi_access_token",
  USER: "cumi_user",
  SIDEBAR: "ed_sidebar_collapsed",
} as const;

export enum ROUTES {
  HOME = "/",
  LOGIN = "/login",
  SIGNUP = "/signup",
  DASHBOARD = "/",
  ADMIN_USERS = "/admin/users",
}

export enum METER_STATUS {
  ONLINE = "Online",
  OFFLINE = "Offline",
  COMM_LOST = "Comm. Lost",
  MAINTENANCE = "Maintenance",
}
