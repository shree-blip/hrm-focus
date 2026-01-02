import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Announcement Banner - Above everything */}
      <AnnouncementBanner />
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
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

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        "lg:pl-64",
        "pt-14 lg:pt-0"
      )}>
        {/* Desktop Header */}
        <div className="hidden lg:block">
          <Header />
        </div>
        {/* Mobile-friendly Header */}
        <div className="lg:hidden">
          <Header isMobile />
        </div>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
