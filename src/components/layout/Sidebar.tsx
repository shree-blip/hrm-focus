import { useState, useMemo, memo, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/App";
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  CheckSquare,
  Wallet,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  UserPlus,
  UserMinus,
  ClipboardList,
  Bug,
  Landmark,
  Megaphone,
  Shield,
  Receipt,
  Globe,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import focusLogo from "@/assets/focus-logo.png";
import { useTheme } from "@/components/dashboard/ThemeContext";

interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  /** If set, item shows only when user has at least one of these permissions */
  permissions?: Permission[];
  /** If true, always visible to all authenticated users */
  alwaysVisible?: boolean;
  /** Only for roles that are managers+ (legacy, used as fallback) */
  managerOnly?: boolean;
  /** Hide this item when user has ANY of these higher-level permissions */
  hideIfHas?: Permission[];
}

/**
 * Single unified menu — visibility controlled by effective permissions.
 * Items with `alwaysVisible` show for everyone.
 * Items with `permissions` show when user has ANY of the listed permissions.
 * Items with `managerOnly` show for manager/vp/admin roles (legacy fallback).
 */
const ALL_MENU_ITEMS: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", alwaysVisible: true },
  { icon: ClipboardList, label: "Log Sheet", href: "/log-sheet", permissions: ["view_log_sheet"] },
  {
    icon: Clock,
    label: "Attendance",
    href: "/attendance",
    permissions: ["view_attendance_all", "view_attendance_reports_only", "view_own_attendance"],
  },
  { icon: CheckSquare, label: "Approvals", href: "/approvals", permissions: ["approve_leave"] },
  {
    icon: Users,
    label: "Team",
    href: "/employees",
    permissions: ["manage_employees", "view_employees_all", "view_employees_reports_only"],
  },

  { icon: Calendar, label: "Leave", href: "/leave", permissions: ["view_leave", "approve_leave"] },
  { icon: CheckSquare, label: "Tasks", href: "/tasks", permissions: ["manage_tasks", "view_tasks"] },

  { icon: TrendingUp, label: "Reports", href: "/reports", permissions: ["view_reports"] },
  { icon: Award, label: "Performance", href: "/performance", permissions: ["view_performance"] },
  {
    icon: Megaphone,
    label: "Announcements",
    href: "/announcements",
    permissions: ["add_announcement", "edit_announcement", "delete_announcement", "view_announcements"],
  },
  { icon: FileText, label: "Documents", href: "/documents", permissions: ["manage_documents", "view_documents"] },
  { icon: Receipt, label: "Invoices", href: "/invoices", permissions: ["view_invoices", "manage_invoices"] },
  { icon: UserPlus, label: "Onboarding", href: "/onboarding", permissions: ["manage_onboarding"] },
  {
    icon: UserPlus,
    label: "My Onboarding",
    href: "/my-onboarding",
    permissions: ["view_onboarding"],
    hideIfHas: ["manage_onboarding"],
  },
  {
    icon: UserMinus,
    label: "My Offboarding",
    href: "/my-offboarding",
    permissions: ["view_onboarding"],
    hideIfHas: ["manage_onboarding"],
  },
  { icon: Wallet, label: "Payroll", href: "/payroll", permissions: ["manage_payroll", "view_payroll"] },
  {
    icon: Wallet,
    label: "Payroll",
    href: "/my-payslips",
    permissions: ["view_payslips"],
    hideIfHas: ["manage_payroll", "view_payroll"],
  },
  { icon: Landmark, label: "Loans", href: "/loans", permissions: ["manage_loans", "view_loans"] },
  { icon: Bug, label: "Support", href: "/support", permissions: ["manage_support", "view_support"] },
  {
    icon: Users,
    label: "Profile",
    href: "/profile",
    alwaysVisible: false,
    permissions: ["view_leave", "view_own_attendance"],
    hideIfHas: ["manage_access"],
  },
  { icon: Shield, label: "Access Control", href: "/access-control", permissions: ["manage_access"] },
  { icon: Globe, label: "Timezones", href: "/timezone-management", permissions: ["manage_access"] },
];

const bottomMenuItems: MenuItem[] = [{ icon: Settings, label: "Settings", href: "/settings", alwaysVisible: true }];

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  embedded?: boolean;
}

export const Sidebar = memo(function Sidebar({
  onNavigate,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  embedded = false,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (v: boolean) => {
    setInternalCollapsed(v);
    onCollapsedChange?.(v);
  };
  const location = useLocation();
  const { isManager } = useAuth();
  const { hasPermission } = usePermissions();
  const { getBadgeCount, clearBadge } = useSidebarBadges();
  const { theme, toggleTheme } = useTheme();

  const isItemVisible = (item: MenuItem): boolean => {
    if (item.hideIfHas?.some((p) => hasPermission(p))) return false;
    if (item.alwaysVisible) return true;
    if (item.permissions) {
      const hasEffective = item.permissions.some((p) => hasPermission(p));
      if (hasEffective) return true;
    }
    if (item.managerOnly && isManager) return true;
    return false;
  };

  const visibleMenuItems = useMemo(
    () => ALL_MENU_ITEMS.filter(isItemVisible),
    [hasPermission, isManager],
  );

  const handleNavClick = useCallback(
    (href: string) => {
      clearBadge(href);
      onNavigate?.();
    },
    [clearBadge, onNavigate],
  );

  const handlePrefetch = useCallback((href: string) => {
    const key = href === "/" ? "" : href.replace(/^\//, "");
    if (key) prefetchRoute(key);
  }, []);

  return (
    <aside
      className={cn(
        "z-40 flex flex-col bg-sidebar text-sidebar-foreground overflow-hidden transition-all duration-300 ease-in-out will-change-transform",
        embedded ? "relative h-full w-full" : "fixed left-0 top-0 h-screen",
        collapsed ? "w-[72px]" : "w-64",
        embedded && "max-w-full",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center justify-between border-b border-sidebar-border px-4",
          !embedded && "mt-2",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-3 animate-fade-in">
            <img src={focusLogo} alt="Focus Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="font-display font-bold text-sm leading-tight">FOCUS</h1>
              <p className="text-xs opacity-80">HRM System</p>
            </div>
          </div>
        )}
        {collapsed && <img src={focusLogo} alt="Focus Logo" className="h-9 w-9 mx-auto object-contain" />}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleMenuItems.map((item, index) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            const badgeCount = getBadgeCount(item.href);

            const linkContent = (
              <Link
                to={item.href}
                onClick={() => handleNavClick(item.href)}
                onMouseEnter={() => handlePrefetch(item.href)}
                onFocus={() => handlePrefetch(item.href)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  "hover:bg-sidebar-accent",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground",
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Icon className={cn("h-5 w-5 shrink-0", collapsed && "mx-auto")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {badgeCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none text-destructive-foreground">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );

            return (
              <li
                key={item.href + item.label}
                className="animate-slide-in-left"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        {bottomMenuItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          const linkContent = (
            <Link
              to={item.href}
              onClick={() => handleNavClick(item.href)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:text-sidebar-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", collapsed && "mx-auto")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          return collapsed ? (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div key={item.href}>{linkContent}</div>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            !collapsed && "justify-start px-3",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="mr-2 h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </Button>

        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="w-full justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-full justify-start px-3 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {theme === "dark" ? <Sun className="mr-2 h-5 w-5" /> : <Moon className="mr-2 h-5 w-5" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </Button>
        )}
      </div>
    </aside>
  );
});
