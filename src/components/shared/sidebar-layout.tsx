"use client";

import { useState } from "react";
import { ModernSidebar, MobileMenuButton } from "./modern-sidebar";
import type { User } from "@/types";

interface SidebarLayoutProps {
  children: React.ReactNode;
  className?: string;
  userRole?: string;
  user?: User | null;
}

export function SidebarLayout({ children, className, userRole = "employee", user }: SidebarLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      {/* Sidebar */}
      <ModernSidebar
        isCollapsed={isCollapsed}
        onToggle={toggleCollapse}
        className={isMobileOpen ? "translate-x-0" : ""}
        userRole={userRole}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-[var(--color-card)] border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'max(calc(0.75rem + env(safe-area-inset-top)), 0.75rem)' }}>
          <div className="flex items-center space-x-4">
            <MobileMenuButton onClick={toggleMobile} />
            <h1 className="text-lg font-semibold text-[var(--color-text)]">
              Dashboard
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--color-text)]">{user?.name || 'User'}</p>
                <p className="text-xs text-[var(--color-text-secondary)] capitalize">{user?.role || userRole || 'employee'}</p>
              </div>
              <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[var(--color-bg)] pb-20 md:pb-0">
          <div className={className}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
