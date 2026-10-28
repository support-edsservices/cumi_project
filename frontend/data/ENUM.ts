// Central constants for the whole app.
// Leave BASE_URL empty to run with the built-in mock auth (localStorage).
// Set it (e.g. "https://api.yourdomain.com") to call your real backend.
export const BASE_URL = "";

export const API_ENDPOINTS = {
  LOGIN: "/auth/login",
  SIGNUP: "/auth/signup",
} as const;

export const STORAGE_KEYS = {
  THEME: "ed_theme",
  FONT_SCALE: "ed_font_scale",
  SESSION: "ed_session",
  USERS: "ed_users",
  SIDEBAR: "ed_sidebar_collapsed",
} as const;

export enum ROUTES {
  HOME = "/",
  LOGIN = "/login",
  SIGNUP = "/signup",
  DASHBOARD = "/dashboard",
}

export enum METER_STATUS {
  ONLINE = "Online",
  OFFLINE = "Offline",
  COMM_LOST = "Comm. Lost",
  MAINTENANCE = "Maintenance",
}

export const DEMO_ACCOUNT = { email: "demo@energyhub.com", password: "Demo@123" };
