import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import AnnouncementBanner from "@/components/dashboard/AnnouncementBanner";
import { ChatWidget } from "@/components/chat/ChatWidget";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Announcement Banner - Above header, inside content area */}
        <div className="sticky top-0 z-40">
          <AnnouncementBanner />
        </div>

        {/* Mobile Header with Hamburger */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-4 border-b border-border bg-card/95 backdrop-blur-md">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-display font-bold text-sm">Focus HRMS</span>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:block">
          <Header />
        </div>
        
        {/* Mobile Header (below fixed bar) */}
        <div className="lg:hidden pt-14">
          <Header isMobile />
        </div>
        
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}
