import { TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Link } from "react-router-dom";

const data = [
  { name: "Jan", billable: 120, nonBillable: 40 },
  { name: "Feb", billable: 135, nonBillable: 35 },
  { name: "Mar", billable: 180, nonBillable: 60 },
  { name: "Apr", billable: 150, nonBillable: 45 },
  { name: "May", billable: 140, nonBillable: 38 },
  { name: "Jun", billable: 155, nonBillable: 42 },
  { name: "Jul", billable: 145, nonBillable: 40 },
  { name: "Aug", billable: 160, nonBillable: 35 },
  { name: "Sep", billable: 175, nonBillable: 45 },
  { name: "Oct", billable: 185, nonBillable: 50 },
  { name: "Nov", billable: 190, nonBillable: 48 },
  { name: "Dec", billable: 200, nonBillable: 55 },
];

export function PerformanceChart() {
  return (
    <Card className="col-span-2 animate-slide-up opacity-0" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Billable Hours Overview
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Team utilization trends for the year
            </p>
          </div>
          <Link to="/performance">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1">
              Details
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="billableGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(192, 82%, 28%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(192, 82%, 28%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="nonBillableGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="billable"
                stroke="hsl(192, 82%, 28%)"
                strokeWidth={2}
                fill="url(#billableGradient)"
                name="Billable Hours"
              />
              <Area
                type="monotone"
                dataKey="nonBillable"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fill="url(#nonBillableGradient)"
                name="Non-Billable"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Billable Hours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">Non-Billable</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
