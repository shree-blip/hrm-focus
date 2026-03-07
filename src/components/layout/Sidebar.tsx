import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
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
  UserPlus,
  ClipboardList,
  Bug,
  Landmark,
  Megaphone,
  Shield,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import focusLogo from "@/assets/focus-logo.png";

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
}

/**
 * Single unified menu — visibility controlled by effective permissions.
 * Items with `alwaysVisible` show for everyone.
 * Items with `permissions` show when user has ANY of the listed permissions.
 * Items with `managerOnly` show for manager/vp/admin roles (legacy fallback).
 */
const ALL_MENU_ITEMS: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", alwaysVisible: true },
  { icon: CheckSquare, label: "Approvals", href: "/approvals", permissions: ["approve_leave"] },
  { icon: Users, label: "Team", href: "/employees", permissions: ["manage_employees", "view_employees_all", "view_employees_reports_only"] },
  { icon: Clock, label: "Attendance", href: "/attendance", alwaysVisible: true },
  { icon: Calendar, label: "Leave", href: "/leave", alwaysVisible: true },
  { icon: CheckSquare, label: "Tasks", href: "/tasks", alwaysVisible: true },
  { icon: ClipboardList, label: "Log Sheet", href: "/log-sheet", alwaysVisible: true },
  { icon: TrendingUp, label: "Reports", href: "/reports", permissions: ["view_reports"] },
  { icon: Megaphone, label: "Announcements", href: "/announcements", permissions: ["add_announcement", "edit_announcement", "delete_announcement", "view_announcements"] },
  { icon: FileText, label: "Documents", href: "/documents", alwaysVisible: true },
  { icon: UserPlus, label: "Onboarding", href: "/onboarding", permissions: ["manage_onboarding"] },
  { icon: Wallet, label: "Payroll", href: "/payroll", permissions: ["manage_payroll", "view_payroll"] },
  { icon: Landmark, label: "Loans", href: "/loans", alwaysVisible: true },
  { icon: Bug, label: "Support", href: "/support", alwaysVisible: true },
  { icon: Users, label: "Profile", href: "/profile", alwaysVisible: true },
  { icon: Shield, label: "Access Control", href: "/access-control", permissions: ["manage_access"] },
];

const bottomMenuItems: MenuItem[] = [{ icon: Settings, label: "Settings", href: "/settings", alwaysVisible: true }];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isManager, isVP } = useAuth();
  const { hasPermission } = usePermissions();

  const isItemVisible = (item: MenuItem): boolean => {
    if (item.alwaysVisible) return true;
    if (item.permissions) {
      // Check effective permissions (role + overrides)
      const hasEffective = item.permissions.some((p) => hasPermission(p));
      if (hasEffective) return true;
    }
    // Legacy fallback: managers+ see manager-only items
    if (item.managerOnly && isManager) return true;
    return false;
  };

  const visibleMenuItems = ALL_MENU_ITEMS.filter(isItemVisible);

  const handleNavClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out",
        "bg-sidebar text-sidebar-foreground flex flex-col",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border mt-2">
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {visibleMenuItems.map((item, index) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            const linkContent = (
              <Link
                to={item.href}
                onClick={handleNavClick}
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
              </Link>
            );

            return (
              <li key={item.href + item.label} className="animate-slide-in-left" style={{ animationDelay: `${index * 50}ms` }}>
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

      {/* Bottom Menu */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {bottomMenuItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          const linkContent = (
            <Link
              to={item.href}
              onClick={handleNavClick}
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

        {/* Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            !collapsed && "justify-start px-3",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
