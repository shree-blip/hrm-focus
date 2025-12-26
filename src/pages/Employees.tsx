import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Filter, MoreHorizontal, Mail, Phone, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const employees = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah.johnson@focusfinance.com",
    role: "Staff Accountant",
    department: "Bookkeeping",
    location: "US",
    status: "active",
    initials: "SJ",
    phone: "+1 (555) 123-4567",
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "michael.chen@focusfinance.com",
    role: "Tax Associate",
    department: "Tax",
    location: "US",
    status: "active",
    initials: "MC",
    phone: "+1 (555) 234-5678",
  },
  {
    id: 3,
    name: "Emily Davis",
    email: "emily.davis@focusfinance.com",
    role: "Lead Bookkeeper",
    department: "Bookkeeping",
    location: "US",
    status: "active",
    initials: "ED",
    phone: "+1 (555) 345-6789",
  },
  {
    id: 4,
    name: "Ramesh Sharma",
    email: "ramesh.sharma@focusfinance.com",
    role: "Senior Accountant",
    department: "FDA",
    location: "Nepal",
    status: "active",
    initials: "RS",
    phone: "+977 98XXXXXXXX",
  },
  {
    id: 5,
    name: "Lisa Park",
    email: "lisa.park@focusfinance.com",
    role: "Tax Lead",
    department: "Tax",
    location: "US",
    status: "active",
    initials: "LP",
    phone: "+1 (555) 456-7890",
  },
  {
    id: 6,
    name: "James Wilson",
    email: "james.wilson@focusfinance.com",
    role: "Intern",
    department: "Tax",
    location: "US",
    status: "probation",
    initials: "JW",
    phone: "+1 (555) 567-8901",
  },
  {
    id: 7,
    name: "Priya Patel",
    email: "priya.patel@focusfinance.com",
    role: "Associate",
    department: "FDA",
    location: "Nepal",
    status: "active",
    initials: "PP",
    phone: "+977 98XXXXXXXX",
  },
  {
    id: 8,
    name: "David Kim",
    email: "david.kim@focusfinance.com",
    role: "Operations Coordinator",
    department: "Operations",
    location: "US",
    status: "active",
    initials: "DK",
    phone: "+1 (555) 678-9012",
  },
];

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || emp.department === departmentFilter;
    const matchesLocation = locationFilter === "all" || emp.location === locationFilter;
    return matchesSearch && matchesDepartment && matchesLocation;
  });

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground mt-1">
            Manage your team members and their roles
          </p>
        </div>
        <Button className="gap-2 shadow-md">
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Bookkeeping">Bookkeeping</SelectItem>
            <SelectItem value="Tax">Tax</SelectItem>
            <SelectItem value="FDA">FDA</SelectItem>
            <SelectItem value="Operations">Operations</SelectItem>
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[140px]">
            <MapPin className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="US">United States</SelectItem>
            <SelectItem value="Nepal">Nepal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Employee Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Employee</TableHead>
              <TableHead className="font-semibold">Role</TableHead>
              <TableHead className="font-semibold">Department</TableHead>
              <TableHead className="font-semibold">Location</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Contact</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((employee, index) => (
              <TableRow
                key={employee.id}
                className="group cursor-pointer animate-fade-in"
                style={{ animationDelay: `${300 + index * 50}ms` }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {employee.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{employee.name}</p>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{employee.role}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {employee.department}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-lg",
                      employee.location === "US" ? "" : ""
                    )}>
                      {employee.location === "US" ? "🇺🇸" : "🇳🇵"}
                    </span>
                    {employee.location}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      employee.status === "active" && "border-success/50 text-success bg-success/10",
                      employee.status === "probation" && "border-warning/50 text-warning bg-warning/10"
                    )}
                  >
                    {employee.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Profile</DropdownMenuItem>
                      <DropdownMenuItem>Edit Details</DropdownMenuItem>
                      <DropdownMenuItem>View Timesheet</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Stats Footer */}
      <div className="flex items-center justify-between mt-6 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "500ms" }}>
        <p>
          Showing {filteredEmployees.length} of {employees.length} employees
        </p>
        <div className="flex items-center gap-4">
          <span>🇺🇸 {employees.filter(e => e.location === "US").length} US</span>
          <span>🇳🇵 {employees.filter(e => e.location === "Nepal").length} Nepal</span>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Employees;
