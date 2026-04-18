import { ReactNode, useState, lazy, Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import AnnouncementBanner from "@/components/dashboard/AnnouncementBanner";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";

// Lazy-load ChatWidget — not needed for initial render
const ChatWidget = lazy(() =>
  import("@/components/chat/ChatWidget").then((m) => ({ default: m.ChatWidget }))
);

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      </div>

      {/* Main Content Area */}
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out", sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        {/* Announcement Banner - Above header, inside content area */}
        <div className="sticky top-0 z-40">
          <AnnouncementBanner />
        </div>

        {/* Unified Header (mobile gets a hamburger trigger via slot) */}
        <Header
          isMobile
          mobileMenuSlot={
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden mr-1 shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 max-w-[85vw] overflow-hidden p-0">
                <Sidebar embedded onNavigate={() => setMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
          }
        />

        {/* Notification permission banner */}
        <NotificationPermissionBanner />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 min-w-0 overflow-x-hidden">{children}</main>
      </div>

      {/* Chat Widget (lazy-loaded) */}
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </div>
  );
}
