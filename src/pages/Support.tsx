import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bug, Package, MessageSquareWarning } from "lucide-react";
import { BugReportsSection } from "@/components/support/BugReportsSection";
import { AssetRequestsSection } from "@/components/support/AssetRequestsSection";
import { GrievanceSection } from "@/components/support/GrievanceSection";

const Support = () => {
  const [activeTab, setActiveTab] = useState("bugs");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Support & Requests</h1>
          <p className="text-muted-foreground mt-1">Report bugs or request assets and IT support</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="grievances" className="flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4" />
              Grievances
            </TabsTrigger>
            <TabsTrigger value="bugs" className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Bug Reports
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Request Assets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bugs" className="space-y-6">
            <BugReportsSection />
          </TabsContent>

          <TabsContent value="assets" className="space-y-6">
            <AssetRequestsSection />
          </TabsContent>

          <TabsContent value="grievances" className="space-y-6">
            <GrievanceSection />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Support;
