import type { Metadata } from "next";

import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { SidebarProvider } from "@/context/SidebarContext";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import './globals.css'

export const metadata: Metadata = {
  title: "EnergyMeter – Enterprise Energy Intelligence",
  description: "Real-time energy monitoring and analytics platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>
              <Sidebar />
              <Topbar
                title="Dashboard"
                subtitle=""
              />
              <main className="main-content">{children}</main>
            </SidebarProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
