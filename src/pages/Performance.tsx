import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Sparkles, Clock, BarChart3, Target, Award } from "lucide-react";

const PerformanceMetrics = () => {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] animate-fade-in">
        <Card className="max-w-2xl w-full border-primary/20">
          <CardContent className="pt-12 pb-12 px-8 text-center">
            {/* Animated Icon */}
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
              <div className="absolute inset-2 rounded-full bg-primary/20 animate-pulse [animation-delay:200ms]" />
              <div className="relative w-full h-full rounded-full bg-primary/15 flex items-center justify-center">
                <Wrench className="h-10 w-10 text-primary animate-bounce [animation-duration:2s]" />
              </div>
            </div>

            {/* Badge */}
            <Badge className="mb-4 bg-primary/15 text-primary border-primary/30 border">
              <Sparkles className="h-3 w-3 mr-1" />
              Work in Progress
            </Badge>

            {/* Heading */}
            <h1 className="heading-page font-display font-bold mb-3">Performance Metrics — Coming Soon</h1>

            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              We're rebuilding this page with smarter scoring, real-time pacing, and leave-adjusted targets. Hang tight
              — it'll be worth the wait.
            </p>

            {/* Feature preview grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <Clock className="h-5 w-5 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium">Live Pacing</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <BarChart3 className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                <p className="text-xs font-medium">6-Dim Scoring</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <Target className="h-5 w-5 text-green-500 mx-auto mb-2" />
                <p className="text-xs font-medium">Goal Tracking</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <Award className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                <p className="text-xs font-medium">Feedback Loop</p>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground">Currently under active development · Check back soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PerformanceMetrics;
