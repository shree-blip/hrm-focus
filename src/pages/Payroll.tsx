import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Download,
  Calendar,
  TrendingUp,
  Users,
  FileText,
  Calculator,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const payrollData = [
  { month: "Jul", amount: 125000 },
  { month: "Aug", amount: 128000 },
  { month: "Sep", amount: 132000 },
  { month: "Oct", amount: 135000 },
  { month: "Nov", amount: 138000 },
  { month: "Dec", amount: 142000 },
];

const recentPayrolls = [
  { id: 1, period: "Dec 1-15, 2025", employees: 48, gross: "$71,250", net: "$52,890", status: "completed", date: "Dec 16" },
  { id: 2, period: "Nov 16-30, 2025", employees: 47, gross: "$68,750", net: "$51,025", status: "completed", date: "Dec 1" },
  { id: 3, period: "Nov 1-15, 2025", employees: 47, gross: "$69,250", net: "$51,395", status: "completed", date: "Nov 16" },
  { id: 4, period: "Oct 16-31, 2025", employees: 46, gross: "$67,500", net: "$50,100", status: "completed", date: "Nov 1" },
];

const upcomingPayroll = {
  period: "Dec 16-31, 2025",
  dueDate: "Jan 2, 2026",
  estimatedGross: "$72,500",
  employees: 48,
  daysLeft: 7,
};

const Payroll = () => {
  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Payroll</h1>
          <p className="text-muted-foreground mt-1">
            Manage payroll processing and compensation
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2 shadow-md">
            <Calculator className="h-4 w-4" />
            Run Payroll
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                <p className="text-2xl font-display font-bold mt-1">$142,000</p>
                <p className="text-xs text-success mt-1">+3.0% from last month</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "150ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-display font-bold mt-1">48</p>
                <p className="text-xs text-muted-foreground mt-1">US: 32 • Nepal: 16</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Salary</p>
                <p className="text-2xl font-display font-bold mt-1">$5,917</p>
                <p className="text-xs text-success mt-1">+2.5% YoY growth</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "250ms", animationFillMode: "forwards" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next Payroll</p>
                <p className="text-2xl font-display font-bold mt-1">7 days</p>
                <p className="text-xs text-muted-foreground mt-1">Jan 2, 2026</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payroll Trend Chart */}
        <Card className="lg:col-span-2 animate-slide-up opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Payroll Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payrollData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Payroll"]}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {payrollData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === payrollData.length - 1 ? "hsl(192, 82%, 28%)" : "hsl(192, 82%, 28%, 0.5)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Payroll */}
        <Card className="animate-slide-up opacity-0" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Upcoming Payroll
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl bg-accent/50 border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">{upcomingPayroll.period}</p>
                <Badge variant="outline" className="border-warning text-warning">
                  {upcomingPayroll.daysLeft} days left
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{upcomingPayroll.dueDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Employees</p>
                  <p className="font-medium">{upcomingPayroll.employees}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Estimated Gross</p>
                  <p className="text-xl font-display font-bold text-primary">
                    {upcomingPayroll.estimatedGross}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Quick Actions</p>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Preview Payslips
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Calculator className="h-4 w-4" />
                Run Calculations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payrolls Table */}
      <Card className="mt-6 animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
        <CardHeader>
          <CardTitle className="font-display text-lg">Recent Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Pay Period</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPayrolls.map((payroll, index) => (
                <TableRow key={payroll.id} className="animate-fade-in" style={{ animationDelay: `${500 + index * 50}ms` }}>
                  <TableCell className="font-medium">{payroll.period}</TableCell>
                  <TableCell>{payroll.employees}</TableCell>
                  <TableCell>{payroll.gross}</TableCell>
                  <TableCell>{payroll.net}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-success text-success bg-success/10">
                      {payroll.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{payroll.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default Payroll;
