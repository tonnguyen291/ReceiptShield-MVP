"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { Chatbot } from "@/components/shared/chatbot";
import { getAllReceipts } from "@/lib/firebase-receipt-store";
import { getReceiptsForManager } from "@/lib/receipt-store";
import { getEmployeesForManager, initializeDefaultUsers } from "@/lib/firebase-user-store";
import { getUnreadNotificationCount } from "@/lib/firebase-notification-store";
import { getCompany } from "@/lib/firebase-company-store";
import { getReceiptTotalAmount } from "@/lib/data-service";
import type { ProcessedReceipt } from "@/types";
import {
  Home,
  ReceiptText,
  BarChart3,
  Users,
  ShieldAlert,
  Settings,
  User,
  Bell,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bot,
  Sun,
  Moon,
  Monitor,
  Activity,
  CreditCard,
  Building2,
  Globe
} from "lucide-react";

interface ModernSidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  className?: string;
  userRole?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function ModernSidebar({ 
  isCollapsed = false, 
  onToggle,
  className,
  userRole = "employee",
  isMobileOpen: externalIsMobileOpen,
  onMobileClose
}: ModernSidebarProps) {
  const pathname = usePathname();
  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false);
  const isMobileOpen = externalIsMobileOpen !== undefined ? externalIsMobileOpen : internalIsMobileOpen;
  const setIsMobileOpen = onMobileClose ? () => onMobileClose() : setInternalIsMobileOpen;
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const { user, logout } = useAuth();
  const [fraudAlertsCount, setFraudAlertsCount] = useState<number | null>(null);
  const [notificationsCount, setNotificationsCount] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    // Apply theme to document
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
    } else {
      // System theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    // Save to localStorage
    localStorage.setItem('theme', newTheme);
  };

  const handleChatbotToggle = () => {
    setIsChatbotOpen(!isChatbotOpen);
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      handleThemeChange(savedTheme);
    }
  }, []);

  // Load company name
  useEffect(() => {
    const fetchCompanyName = async () => {
      if (user?.companyId) {
        try {
          const company = await getCompany(user.companyId);
          if (company) {
            setCompanyName(company.name);
          }
        } catch (error) {
          console.error('Error fetching company name:', error);
        }
      }
    };

    fetchCompanyName();
  }, [user?.companyId]);

  // Helper function to analyze receipt for fraud (simplified version for sidebar)
  const analyzeReceiptForFraud = (receipt: ProcessedReceipt, allReceipts: ProcessedReceipt[]): boolean => {
    // Check if receipt is already marked as fraudulent
    if (receipt.isFraudulent) {
      return true;
    }

    let fraudScore = 0;

    // Duplicate Receipt Detection
    const receiptAmount = getReceiptTotalAmount(receipt);
    const receiptDate = new Date(receipt.uploadedAt);
    const receiptVendor = extractVendor(receipt);

    const recentReceipts = allReceipts.filter(r => 
      r.uploadedBy === receipt.uploadedBy &&
      r.id !== receipt.id &&
      Math.abs(new Date(r.uploadedAt).getTime() - receiptDate.getTime()) < 7 * 24 * 60 * 60 * 1000
    );

    // Check for exact duplicates
    const exactDuplicates = recentReceipts.filter(r => {
      const rAmount = getReceiptTotalAmount(r);
      const rVendor = extractVendor(r);
      const rDate = new Date(r.uploadedAt);
      return Math.abs(rAmount - receiptAmount) < 0.01 && 
             rVendor.toLowerCase() === receiptVendor.toLowerCase() &&
             Math.abs(rDate.getTime() - receiptDate.getTime()) < 24 * 60 * 60 * 1000;
    });

    if (exactDuplicates.length > 0) {
      fraudScore += 0.8;
    }

    // Amount Analysis
    const userReceipts = allReceipts.filter(r => r.uploadedBy === receipt.uploadedBy && r.id !== receipt.id);
    if (userReceipts.length > 0) {
      const amounts = userReceipts.map(getReceiptTotalAmount).filter(a => a > 0);
      if (amounts.length > 0) {
        const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
        const maxAmount = Math.max(...amounts);
        const stdDev = Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length);

        if (receiptAmount > maxAmount * 2) {
          fraudScore += 0.7;
        } else if (receiptAmount > avgAmount + (3 * stdDev)) {
          fraudScore += 0.5;
        }
      }
    }

    // Vendor Analysis
    const userVendors = userReceipts.map(extractVendor).filter(v => v.length > 0);
    const vendorCounts = userVendors.reduce((acc, v) => {
      acc[v.toLowerCase()] = (acc[v.toLowerCase()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (!vendorCounts[receiptVendor.toLowerCase()]) {
      fraudScore += 0.4;
    }

    // Timing Analysis
    const hour = receiptDate.getHours();
    if (hour < 6 || hour > 22) {
      fraudScore += 0.3;
    }

    return fraudScore > 0.3;
  };

  // Helper function to extract vendor from receipt
  const extractVendor = (receipt: ProcessedReceipt): string => {
    const vendorItem = receipt.items?.find(item => 
      item.label.toLowerCase().includes('vendor') || 
      item.label.toLowerCase().includes('merchant') ||
      item.label.toLowerCase().includes('store')
    );
    return vendorItem?.value || 'Unknown';
  };

  // Load fraud alerts and notifications counts
  useEffect(() => {
    const loadCounts = async () => {
      if (!user) return;

      try {
        // Load fraud alerts count for admin and manager (not for employees)
        if (userRole === 'admin') {
          const companyId = user.isPlatformAdmin ? undefined : user.companyId;
          const allReceipts = await getAllReceipts(undefined, companyId);
          const fraudCount = allReceipts.filter(r => r.isFraudulent).length;
          setFraudAlertsCount(fraudCount);
        } else if (userRole === 'manager') {
          // Use same approach as fraud alerts page and team dashboard
          await initializeDefaultUsers();
          
          // Get team members - use same approach as Team Dashboard
          const teamMembers = await getEmployeesForManager(user.id);
          
          // Get all receipts for the manager's team (by supervisorId)
          const receiptsBySupervisor = await getReceiptsForManager(user.id);
          
          // Also get receipts by employee emails/IDs to catch any that might not have supervisorId set
          const { getReceiptsByUser } = await import('@/lib/firebase-receipt-store');
          const employeeReceiptPromises = teamMembers.map(emp => {
            if (emp.email) {
              return getReceiptsByUser(emp.email, user?.companyId);
            }
            return Promise.resolve([]);
          });
          const employeeReceiptsArrays = await Promise.all(employeeReceiptPromises);
          const receiptsByEmployee = employeeReceiptsArrays.flat();
          
          // Combine and deduplicate receipts
          const receiptMap = new Map<string, ProcessedReceipt>();
          [...receiptsBySupervisor, ...receiptsByEmployee].forEach(receipt => {
            if (receipt.id) {
              receiptMap.set(receipt.id, receipt);
            }
          });
          const allReceipts = Array.from(receiptMap.values());
          
          // Perform real-time fraud analysis (same logic as fraud alerts page)
          // Only count receipts that require action (pending or investigating), not approved/rejected
          const fraudAlerts: ProcessedReceipt[] = [];
          for (const receipt of allReceipts) {
            if (analyzeReceiptForFraud(receipt, allReceipts)) {
              // Only include if status is pending_approval or not yet resolved
              const status = receipt.status || 'pending_approval';
              if (status === 'pending_approval' || status === 'pending' || !['approved', 'rejected', 'resolved'].includes(status)) {
                fraudAlerts.push(receipt);
              }
            }
          }
          
          setFraudAlertsCount(fraudAlerts.length);
        } else {
          // Employees don't have fraud alerts badge
          setFraudAlertsCount(null);
        }

        // Load unread notifications count from Firestore
        try {
          const userId = user.email || user.id || '';
          const unreadCount = await getUnreadNotificationCount(userId, user.companyId);
          setNotificationsCount(unreadCount);
        } catch (error) {
          console.error('Error loading unread notification count:', error);
          setNotificationsCount(0);
        }
      } catch (error) {
        console.error('Error loading notification counts:', error);
        setFraudAlertsCount(0);
        setNotificationsCount(0);
      }
    };

    loadCounts();
  }, [user, userRole]);

  const getNavigationItems = () => {
    const basePath = userRole === "employee" ? "/employee" : 
                    userRole === "manager" ? "/manager" : 
                    userRole === "admin" ? "/admin" : "/employee";

    switch (userRole) {
      case "employee":
        return [
          {
            href: `${basePath}/dashboard`,
            label: "Dashboard",
            icon: Home,
            badge: null
          },
          {
            href: `${basePath}/receipts`,
            label: "My Receipts",
            icon: ReceiptText,
            badge: null
          },
          {
            href: `${basePath}/upload`,
            label: "Upload Receipt",
            icon: ReceiptText,
            badge: null
          },
          {
            href: `${basePath}/analytics`,
            label: "Analytics",
            icon: BarChart3,
            badge: null
          }
        ];
      
      case "manager":
        return [
          {
            href: `${basePath}/dashboard`,
            label: "Team Dashboard",
            icon: Home,
            badge: null
          },
          {
            href: `${basePath}/team`,
            label: "Team Management",
            icon: Users,
            badge: null
          },
          {
            href: `${basePath}/analytics`,
            label: "Team Analytics",
            icon: BarChart3,
            badge: null
          },
          {
            href: `${basePath}/fraud-alerts`,
            label: "Fraud Alerts",
            icon: ShieldAlert,
            badge: fraudAlertsCount
          }
        ];
      
      case "admin": {
        const adminItems = [
          // Platform Dashboard for platform admins
          ...(user?.isPlatformAdmin ? [{
            href: "/platform/dashboard",
            label: "Platform Dashboard",
            icon: Globe,
            badge: null
          }] : []),
          {
            href: `${basePath}/dashboard`,
            label: "Overview",
            icon: Home,
            badge: null
          },
          {
            href: `${basePath}/users`,
            label: "User Management",
            icon: Users,
            badge: null
          },
          ...(user?.isPlatformAdmin ? [{
            href: `${basePath}/check-user`,
            label: "Check User Company",
            icon: Building2,
            badge: null
          }] : []),
          {
            href: `${basePath}/analytics`,
            label: "Organization Analytics",
            icon: BarChart3,
            badge: null
          },
          // Only show System Monitoring for platform admins
          ...(user?.isPlatformAdmin ? [{
            href: `${basePath}/monitoring`,
            label: "System Monitoring",
            icon: Activity,
            badge: null
          }] : []),
          {
            href: `${basePath}/fraud-alerts`,
            label: "Fraud Detection",
            icon: ShieldAlert,
            badge: fraudAlertsCount
          }
        ];
        return adminItems;
      }
      
      default:
        return [];
    }
  };

  const navigationItems = getNavigationItems();

  // Build utility items with conditional subscription link
  const utilityItems = [
    {
      href: "/profile",
      label: "Profile",
      icon: User,
      badge: null
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      badge: notificationsCount
    },
    // Show subscription link for company owners or users with subscription management permission
    ...(user && (user.isCompanyOwner || user.canManageSubscription) ? [{
      href: "/settings/subscription",
      label: "Subscription",
      icon: CreditCard,
      badge: null
    }] : []),
    {
      href: "/help",
      label: "Help",
      icon: HelpCircle,
      badge: null
    }
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const NavItem = ({ 
    href, 
    label, 
    icon: Icon, 
    badge, 
    onClick 
  }: {
    href: string;
    label: string;
    icon: any;
    badge: number | null;
    onClick?: () => void;
  }) => {
    const active = isActive(href);
    
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
          "hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
          active && "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-l-4 border-[var(--color-primary)]",
          isCollapsed && "justify-center px-2"
        )}
      >
        {/* Active indicator */}
        {active && !isCollapsed && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-[var(--color-primary)] rounded-r-full" />
        )}
        
        <div className="flex items-center space-x-3 flex-1">
          <Icon className={cn(
            "h-5 w-5 flex-shrink-0 text-[var(--color-text-secondary)]",
            active && "text-[var(--color-primary)]"
          )} />
          
          {!isCollapsed && (
            <>
              <span className="font-medium text-sm text-[var(--color-text)]">{label}</span>
              {badge && badge > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-auto h-5 w-5 flex items-center justify-center text-xs"
                >
                  {badge > 99 ? "99+" : badge}
                </Badge>
              )}
            </>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-[var(--color-bg)] bg-opacity-80 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out",
        "bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]",
        "lg:translate-x-0 lg:static lg:inset-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "w-16" : "w-60",
        className
      )} style={{ zIndex: 50 }}>
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--color-border)] relative" style={{ zIndex: 9999 }}>
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg">
                <ShieldAlert className="h-6 w-6 text-[var(--color-primary)]" />
              </div>
              <span className="text-xl font-bold text-[var(--color-text)]">Receipt Shield</span>
            </div>
          )}
          
          {isCollapsed && (
            <div className="flex items-center justify-center w-full">
              <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg">
                <ShieldAlert className="h-6 w-6 text-[var(--color-primary)]" />
              </div>
            </div>
          )}

          {/* Mobile close button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMobileOpen(false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMobileOpen(false);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              setIsMobileOpen(false);
            }}
            className="lg:hidden p-3 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] active:bg-[var(--color-bg)] relative z-[9999] pointer-events-auto cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{ zIndex: 9999, position: 'relative' }}
            type="button"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Company Name Badge */}
        {companyName && !isCollapsed && (
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-primary truncate">{companyName}</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigationItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              onClick={() => setIsMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Divider */}
        <div className="px-3">
          <div className="border-t border-[var(--color-border)]" />
        </div>

        {/* Utility Items */}
        <nav className="px-3 py-4 space-y-1">
          {utilityItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              onClick={() => setIsMobileOpen(false)}
            />
          ))}
        </nav>

        {/* AI Assistant Button */}
        <div className="px-3 py-2">
          <Button
            onClick={handleChatbotToggle}
            className={cn(
              "w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white",
              isCollapsed && "px-2"
            )}
            size="sm"
          >
            <Bot className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">AI Assistant</span>}
          </Button>
        </div>

        {/* Theme Toggle */}
        <div className="px-3 py-2">
          <div className={cn(
            "flex items-center space-x-2 p-2 rounded-lg bg-[var(--color-bg)]",
            isCollapsed && "justify-center"
          )}>
            {!isCollapsed && (
              <span className="text-sm font-medium text-[var(--color-text)]">Theme</span>
            )}
            <div className="flex space-x-1">
              <Button
                variant={theme === 'light' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleThemeChange('light')}
                className={cn(
                  "p-1 h-6 w-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white",
                  theme !== 'light' && "bg-[var(--color-bg)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text)]"
                )}
              >
                <Sun className="h-3 w-3" />
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleThemeChange('dark')}
                className={cn(
                  "p-1 h-6 w-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white",
                  theme !== 'dark' && "bg-[var(--color-bg)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text)]"
                )}
              >
                <Moon className="h-3 w-3" />
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleThemeChange('system')}
                className={cn(
                  "p-1 h-6 w-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white",
                  theme !== 'system' && "bg-[var(--color-bg)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text)]"
                )}
              >
                <Monitor className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* User Profile */}
        {user && (
          <div className="p-3 border-t border-[var(--color-border)]">
            <div className={cn(
              "flex items-center space-x-3 p-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors",
              isCollapsed && "justify-center"
            )}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm font-medium">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate capitalize">
                    {user.role}
                  </p>
                  {companyName && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3 text-primary flex-shrink-0" />
                      <p className="text-xs font-medium text-primary truncate">{companyName}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sign Out Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className={cn(
                "w-full mt-2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10",
                isCollapsed && "px-2"
              )}
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">Sign Out</span>}
            </Button>
          </div>
        )}

        {/* Collapse Toggle (Desktop) */}
        {onToggle && (
          <div className="hidden lg:block p-3 border-t border-[var(--color-border)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="w-full text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
              {!isCollapsed && <span className="ml-2">Collapse</span>}
            </Button>
          </div>
        )}
      </div>

      {/* Chatbot Component */}
      <Chatbot isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} />
    </>
  );
}

// Mobile Menu Button Component
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

// Tooltip Component for Collapsed State
export function SidebarTooltip({ 
  children, 
  content 
}: { 
  children: React.ReactNode; 
  content: string; 
}) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-[var(--color-card)] text-[var(--color-text)] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-[var(--color-border)]">
        {content}
      </div>
    </div>
  );
}
