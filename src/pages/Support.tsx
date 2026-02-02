import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bug, Package } from "lucide-react";
import { BugReportsSection } from "@/components/support/BugReportsSection";
import { AssetRequestsSection } from "@/components/support/AssetRequestsSection";

const Support = () => {
  const [activeTab, setActiveTab] = useState("bugs");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Support & Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            Report bugs or request assets and IT support
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Support;
