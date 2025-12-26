import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  FileText,
  Upload,
  Search,
  Filter,
  FolderOpen,
  File,
  FileImage,
  FileSpreadsheet,
  Download,
  MoreHorizontal,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const documents = [
  { id: 1, name: "Offer Letter - Michael Chen.pdf", type: "pdf", category: "Contracts", size: "245 KB", date: "Dec 20, 2025", status: "signed" },
  { id: 2, name: "Employee Handbook 2025.pdf", type: "pdf", category: "Policies", size: "1.2 MB", date: "Jan 1, 2025", status: "active" },
  { id: 3, name: "NDA Template.docx", type: "doc", category: "Templates", size: "89 KB", date: "Nov 15, 2025", status: "active" },
  { id: 4, name: "Q4 Performance Reviews.xlsx", type: "xlsx", category: "Reviews", size: "456 KB", date: "Dec 18, 2025", status: "draft" },
  { id: 5, name: "Tax Form W-4 - Sarah Johnson.pdf", type: "pdf", category: "Tax Forms", size: "178 KB", date: "Dec 10, 2025", status: "completed" },
  { id: 6, name: "Background Check Results.pdf", type: "pdf", category: "Compliance", size: "312 KB", date: "Dec 5, 2025", status: "approved" },
];

const categories = [
  { name: "All Documents", count: 156, icon: FolderOpen },
  { name: "Contracts", count: 34, icon: FileText },
  { name: "Tax Forms", count: 48, icon: FileSpreadsheet },
  { name: "Policies", count: 12, icon: File },
  { name: "Reviews", count: 28, icon: FileText },
  { name: "Templates", count: 8, icon: FileImage },
];

const getFileIcon = (type: string) => {
  switch (type) {
    case "pdf":
      return <FileText className="h-5 w-5 text-destructive" />;
    case "xlsx":
      return <FileSpreadsheet className="h-5 w-5 text-success" />;
    case "doc":
    case "docx":
      return <File className="h-5 w-5 text-info" />;
    default:
      return <File className="h-5 w-5 text-muted-foreground" />;
  }
};

const Documents = () => {
  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Manage employee documents and templates
          </p>
        </div>
        <Button className="gap-2 shadow-md">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <Card className="lg:col-span-1 h-fit animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="font-display text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.name}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all",
                    index === 0
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{category.name}</span>
                  </div>
                  <Badge
                    variant={index === 0 ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {category.count}
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card className="lg:col-span-3 animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="font-display text-lg">All Documents</CardTitle>
              <div className="flex gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search documents..." className="pl-10" />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc, index) => (
                  <TableRow
                    key={doc.id}
                    className="group cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${300 + index * 50}ms` }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.type)}
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {doc.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{doc.size}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {doc.date}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          doc.status === "signed" && "border-success text-success bg-success/10",
                          doc.status === "active" && "border-primary text-primary bg-primary/10",
                          doc.status === "draft" && "border-warning text-warning bg-warning/10",
                          doc.status === "completed" && "border-info text-info bg-info/10",
                          doc.status === "approved" && "border-success text-success bg-success/10"
                        )}
                      >
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View</DropdownMenuItem>
                            <DropdownMenuItem>Rename</DropdownMenuItem>
                            <DropdownMenuItem>Share</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Documents;
