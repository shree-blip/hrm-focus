import { useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bug, Package, MessageSquareWarning } from "lucide-react";
import { BugReportsSection } from "@/components/support/BugReportsSection";
import { AssetRequestsSection } from "@/components/support/AssetRequestsSection";
import { GrievanceSection } from "@/components/support/GrievanceSection";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { usePersistentState } from "@/hooks/usePersistentState";

const Support = () => {
  const { hasPermission } = usePermissions();
  const { isVP, isAdmin } = useAuth();

  // CEO/Admin bypass — they see everything
  const isSuperUser = isVP || isAdmin;

  const visibleTabs = useMemo(() => {
    const tabs: { value: string; label: string; icon: typeof Bug; permission: string }[] = [];

    if (isSuperUser || hasPermission("view_grievances") || hasPermission("submit_grievances") || hasPermission("manage_support") || hasPermission("view_support")) {
      tabs.push({ value: "grievances", label: "Grievances", icon: MessageSquareWarning, permission: "view_grievances" });
    }
    if (isSuperUser || hasPermission("view_bug_reports") || hasPermission("submit_bug_reports") || hasPermission("manage_support") || hasPermission("view_support")) {
      tabs.push({ value: "bugs", label: "Bug Reports", icon: Bug, permission: "view_bug_reports" });
    }
    if (isSuperUser || hasPermission("view_asset_requests") || hasPermission("submit_asset_requests") || hasPermission("manage_support") || hasPermission("view_support")) {
      tabs.push({ value: "assets", label: "Request Assets", icon: Package, permission: "view_asset_requests" });
    }

    return tabs;
  }, [isSuperUser, hasPermission]);

  const [activeTab, setActiveTab] = usePersistentState("support:activeTab", "bugs");

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const hasActiveTab = visibleTabs.some((tab) => tab.value === activeTab);
    if (!hasActiveTab) {
      setActiveTab(visibleTabs[0].value);
    }
  }, [activeTab, setActiveTab, visibleTabs]);

  if (visibleTabs.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">You don't have permission to access any support sections.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading-page font-display font-bold text-foreground">Support & Requests</h1>
          <p className="text-muted-foreground mt-1">Report bugs or request assets and IT support</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full max-w-lg grid-cols-${visibleTabs.length}`}>
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.some(t => t.value === "bugs") && (
            <TabsContent value="bugs" className="space-y-6">
              <BugReportsSection />
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "assets") && (
            <TabsContent value="assets" className="space-y-6">
              <AssetRequestsSection />
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "grievances") && (
            <TabsContent value="grievances" className="space-y-6">
              <GrievanceSection />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Support;
