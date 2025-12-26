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
  // US Team
  { id: 1, name: "Adish Dahal", email: "adish@focusyourfinance.com", role: "Vice President", department: "Executive", location: "US", status: "active", initials: "AD", phone: "" },
  { id: 2, name: "Julie Moreno", email: "julie@focusyourfinance.com", role: "Executive Assistant", department: "Executive", location: "US", status: "active", initials: "JM", phone: "" },
  { id: 3, name: "Sambridhi Regmi", email: "sambridhi@focusyourfinance.com", role: "Accountant", department: "Accounting", location: "US", status: "active", initials: "SR", phone: "" },
  { id: 4, name: "Anjila Shrestha", email: "anjila@focusyourfinance.com", role: "Operations Associate", department: "Operations", location: "US", status: "active", initials: "AS", phone: "" },
  { id: 5, name: "Rick Leonard", email: "rick@focusyourfinance.com", role: "Healthcare", department: "Healthcare", location: "US", status: "active", initials: "RL", phone: "" },
  { id: 6, name: "Jamie Alcantar", email: "jamie@focusyourfinance.com", role: "Healthcare", department: "Healthcare", location: "US", status: "active", initials: "JA", phone: "" },
  
  // Nepal Team
  { id: 7, name: "Ganesh Dahal", email: "ganesh.dahal@focusyourfinance.com", role: "VP - Nepal Operations", department: "Executive", location: "Nepal", status: "active", initials: "GD", phone: "" },
  { id: 8, name: "Salmon Adhikari", email: "salmon@focusyourfinance.com", role: "Chief Operations Officer", department: "Operations", location: "Nepal", status: "active", initials: "SA", phone: "" },
  { id: 9, name: "Guinness Lakhe", email: "guinness@focusyourfinance.com", role: "Sr. Accountant Officer", department: "Accounting", location: "Nepal", status: "active", initials: "GL", phone: "" },
  { id: 10, name: "Hemant Rai", email: "operations@focusyourfinance.com", role: "Sr Operations Officer", department: "Operations", location: "Nepal", status: "active", initials: "HR", phone: "" },
  { id: 11, name: "Resham Karki", email: "nepalfocus2@gmail.com", role: "Administration Officer", department: "Operations", location: "Nepal", status: "active", initials: "RK", phone: "" },
  { id: 12, name: "Shree Gauli", email: "shree@focusyourfinance.com", role: "Sr Marketing Officer", department: "Marketing", location: "Nepal", status: "active", initials: "SG", phone: "" },
  { id: 13, name: "Bikash Neupane", email: "hello@focusyourfinance.com", role: "Digitization/IT Officer", department: "IT", location: "Nepal", status: "active", initials: "BN", phone: "" },
  { id: 14, name: "Kalash Shrestha", email: "kalash@focusyourfinance.com", role: "Tax Accountant", department: "Tax", location: "Nepal", status: "active", initials: "KS", phone: "" },
  { id: 15, name: "Sandesh Rai", email: "sandesh.rai@focusyourfinance.com", role: "Sr. Accountant", department: "Accounting", location: "Nepal", status: "active", initials: "SR", phone: "" },
  { id: 16, name: "Ishika Jha", email: "ishika@focusyourfinance.com", role: "Accounting Associate", department: "Accounting", location: "Nepal", status: "active", initials: "IJ", phone: "" },
  { id: 17, name: "Sapana Regmi", email: "sapana@focusyourfinance.com", role: "Accounting Associate", department: "Accounting", location: "Nepal", status: "active", initials: "SR", phone: "" },
  { id: 18, name: "Sajiya Banu", email: "sajiya@focusyourfinance.com", role: "Tax Associate", department: "Tax", location: "Nepal", status: "active", initials: "SB", phone: "" },
  { id: 19, name: "Sushant Maskey", email: "sushant@focusyourfinance.com", role: "Staff Accountant", department: "Accounting", location: "Nepal", status: "active", initials: "SM", phone: "" },
  { id: 20, name: "Bhaskar Rokka", email: "bhaskar@focusyourfinance.com", role: "Staff Accountant", department: "Accounting", location: "Nepal", status: "active", initials: "BR", phone: "" },
  { id: 21, name: "Tika Rai", email: "tika.rai@focusyourfinance.com", role: "Staff Accountant", department: "Accounting", location: "Nepal", status: "active", initials: "TR", phone: "" },
  { id: 22, name: "Sonu Sagar Dongol", email: "sonu@focusyourfinance.com", role: "Paid Ads Specialist", department: "Marketing", location: "Nepal", status: "active", initials: "SD", phone: "" },
  { id: 23, name: "Bijesh Khadgi", email: "bijesh@focusyourfinance.com", role: "Social Media Manager", department: "Marketing", location: "Nepal", status: "active", initials: "BK", phone: "" },
  { id: 24, name: "Sumit Sharma", email: "sumit@focusyourfinance.com", role: "SEO Manager", department: "Marketing", location: "Nepal", status: "active", initials: "SS", phone: "" },
  { id: 25, name: "Rahul Roy", email: "rahul@focusyourfinance.com", role: "Content Writer", department: "Marketing", location: "Nepal", status: "active", initials: "RR", phone: "" },
  { id: 26, name: "Puspa Gautam", email: "lifeatfocus6@gmail.com", role: "Accounting Intern", department: "Accounting", location: "Nepal", status: "probation", initials: "PG", phone: "" },
  { id: 27, name: "Bidhitsha Khadka", email: "designerfocus08@gmail.com", role: "Graphics Designer Intern", department: "Marketing", location: "Nepal", status: "probation", initials: "BK", phone: "" },
  { id: 28, name: "Swanim Rai", email: "lifeatfocus8@gmail.com", role: "Intern", department: "Operations", location: "Nepal", status: "probation", initials: "SR", phone: "" },
  
  // Focus Data Team
  { id: 29, name: "Aavash Rimal", email: "aavash@focusdata.io", role: "Chief Operations Officer", department: "Focus Data", location: "Nepal", status: "active", initials: "AR", phone: "" },
  { id: 30, name: "Sarju Maharjan", email: "hello@focusdata.io", role: "Operations Coordinator", department: "Focus Data", location: "Nepal", status: "active", initials: "SM", phone: "" },
  { id: 31, name: "Asesh Khanal", email: "aseshkhanal999@gmail.com", role: "Sr. Project Associate", department: "Focus Data", location: "Nepal", status: "active", initials: "AK", phone: "" },
  { id: 32, name: "Krisha Maharjan", email: "krishamaharjan110@gmail.com", role: "Jr. Project Associate", department: "Focus Data", location: "Nepal", status: "active", initials: "KM", phone: "" },
  { id: 33, name: "Purnima Bogati", email: "Bogateepurnima17@gmail.com", role: "Project Associate", department: "Focus Data", location: "Nepal", status: "active", initials: "PB", phone: "" },
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
            <SelectItem value="Executive">Executive</SelectItem>
            <SelectItem value="Accounting">Accounting</SelectItem>
            <SelectItem value="Tax">Tax</SelectItem>
            <SelectItem value="Operations">Operations</SelectItem>
            <SelectItem value="Marketing">Marketing</SelectItem>
            <SelectItem value="IT">IT</SelectItem>
            <SelectItem value="Healthcare">Healthcare</SelectItem>
            <SelectItem value="Focus Data">Focus Data</SelectItem>
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
