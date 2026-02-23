import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FileText,
  Upload,
  Search,
  FolderOpen,
  File,
  FileImage,
  FileSpreadsheet,
  Download,
  MoreHorizontal,
  Clock,
  Loader2,
  Lock,
  User,
  CalendarCheck,
  Users,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useDocuments, Document, PRIVATE_CATEGORIES, LEAVE_EVIDENCE_CATEGORY } from "@/hooks/useDocuments";
import { toast } from "@/hooks/use-toast";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { DocumentViewDialog } from "@/components/documents/DocumentViewDialog";
import { RenameDocumentDialog } from "@/components/documents/RenameDocumentDialog";
import { DeleteDocumentDialog } from "@/components/documents/DeleteDocumentDialog";
import { ShareDocumentDialog } from "@/components/documents/ShareDocumentDialog";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/hooks/useEmployees";

// Mock data for display when no real documents exist
const mockDocuments = [
  {
    id: "1",
    name: "Offer Letter - Michael Chen.pdf",
    file_path: "",
    file_type: "pdf",
    file_size: 245000,
    category: "Contracts",
    created_at: "2025-12-20",
    updated_at: "2025-12-20",
    status: "signed",
    uploaded_by: "",
    employee_id: null,
  },
  {
    id: "2",
    name: "Employee Handbook 2025.pdf",
    file_path: "",
    file_type: "pdf",
    file_size: 1200000,
    category: "Policies",
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
    status: "active",
    uploaded_by: "",
    employee_id: null,
  },
  {
    id: "3",
    name: "Background Check Results.pdf",
    file_path: "",
    file_type: "pdf",
    file_size: 312000,
    category: "Compliance",
    created_at: "2025-12-05",
    updated_at: "2025-12-05",
    status: "approved",
    uploaded_by: "",
    employee_id: null,
  },
  {
    id: "4",
    name: "Medical Certificate - John Doe.pdf",
    file_path: "",
    file_type: "pdf",
    file_size: 156000,
    category: "Leave Evidence",
    created_at: "2025-01-15",
    updated_at: "2025-01-15",
    status: "active",
    uploaded_by: "",
    employee_id: null,
  },
];

const categories = [
  { name: "All Documents", icon: FolderOpen },
  { name: "Contracts", icon: FileText },
  { name: "Policies", icon: File },
  { name: "Compliance", icon: File },
  { name: "Leave Evidence", icon: CalendarCheck },
];

const getFileIcon = (type: string | null) => {
  switch (type) {
    case "pdf":
      return <FileText className="h-5 w-5 text-destructive" />;
    case "xlsx":
    case "xls":
      return <FileSpreadsheet className="h-5 w-5 text-success" />;
    case "doc":
    case "docx":
      return <File className="h-5 w-5 text-info" />;
    case "jpg":
    case "jpeg":
    case "png":
      return <FileImage className="h-5 w-5 text-purple-500" />;
    default:
      return <File className="h-5 w-5 text-muted-foreground" />;
  }
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface DisplayDocument {
  id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
  uploaded_by: string;
  employee_id: string | null;
}

const Documents = () => {
  const { user, isAdmin, isVP, isManager, isLineManager } = useAuth();
  const { employees } = useEmployees();
  const {
    documents: realDocuments,
    loading,
    uploadDocument,
    deleteDocument,
    renameDocument,
    downloadDocument,
    getDownloadUrl,
    getUploaderName,
    isPrivateCategory,
    isLeaveEvidenceCategory,
    isRestrictedCategory,
    uploadComplianceDocuments,
  } = useDocuments();
  const [selectedCategory, setSelectedCategory] = useState("All Documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<DisplayDocument | null>(null);
  const [renameDoc, setRenameDoc] = useState<DisplayDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DisplayDocument | null>(null);
  const [shareDoc, setShareDoc] = useState<DisplayDocument | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Use real documents if available, otherwise use mock data
  const documents: DisplayDocument[] = realDocuments.length > 0 ? realDocuments : mockDocuments;

  // Check if current category uses employee-first view
  const isEmployeeFirstCategory = selectedCategory === "Contracts" || selectedCategory === "Compliance";

  // Get employees that have documents in the selected category
  const employeesWithDocs = useMemo(() => {
    if (!isEmployeeFirstCategory) return [];
    const categoryDocs = documents.filter((doc) => doc.category === selectedCategory && doc.employee_id);
    const empIds = [...new Set(categoryDocs.map((d) => d.employee_id).filter(Boolean))];
    return employees
      .filter((emp) => empIds.includes(emp.id))
      .map((emp) => ({
        ...emp,
        docCount: categoryDocs.filter((d) => d.employee_id === emp.id).length,
      }));
  }, [documents, employees, selectedCategory, isEmployeeFirstCategory]);

  // Get selected employee's name
  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Filter documents based on category, search, and selected employee
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesCategory = selectedCategory === "All Documents" || doc.category === selectedCategory;
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesEmployee = !selectedEmployeeId || doc.employee_id === selectedEmployeeId;
      return matchesCategory && matchesSearch && matchesEmployee;
    });
  }, [documents, selectedCategory, searchQuery, selectedEmployeeId]);

  // Handle category change - reset employee selection
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedEmployeeId(null);
    setSearchQuery("");
  };

  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { "All Documents": documents.length };
    documents.forEach((doc) => {
      if (doc.category) {
        counts[doc.category] = (counts[doc.category] || 0) + 1;
      }
    });
    return counts;
  }, [documents]);

  const handleUpload = async (docData: {
    name: string;
    type: string;
    category: string;
    size: string;
    date: string;
    status: string;
    file?: File;
    employeeId?: string;
    complianceData?: {
      bankAccountNumber?: string;
      citizenshipPhoto?: File;
      panCardPhoto?: File;
      otherDocument?: File;
    };
  }) => {
    // Handle compliance category with multiple files
    if (docData.category === "Compliance" && docData.complianceData && docData.employeeId) {
      await uploadComplianceDocuments(docData.employeeId, docData.complianceData);
      toast({ title: "Compliance Documents Uploaded", description: "All compliance documents have been uploaded." });
    } else if (docData.file) {
      await uploadDocument(docData.file, docData.category, docData.employeeId);
    }
    setUploadDialogOpen(false);
  };

  const handleDownload = async (doc: DisplayDocument) => {
    if (doc.file_path) {
      await downloadDocument(doc as Document);
    }
  };

  const handleView = (doc: DisplayDocument) => {
    setViewDocument(doc);
  };

  const handleRename = async (doc: any, newName: string) => {
    if (doc.file_path) {
      await renameDocument(doc as Document, newName);
    }
    setRenameDoc(null);
  };

  const handleDelete = async (doc: any) => {
    if (doc.file_path) {
      await deleteDocument(doc as Document);
    }
    setDeleteDoc(null);
  };

  const handleShare = async (doc: DisplayDocument) => {
    if (doc.file_path) {
      const url = await getDownloadUrl(doc.file_path);
      setShareUrl(url);
    } else {
      setShareUrl(`${window.location.origin}/documents/${doc.id}`);
    }
    setShareDoc(doc);
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Search happens automatically via filteredDocuments
  };

  const getVisibilityTooltip = (category: string | null) => {
    if (isLeaveEvidenceCategory(category)) {
      return "Restricted - Visible to uploader, manager, line manager, VP, and admins";
    }
    if (isPrivateCategory(category)) {
      return "Private - Only visible to uploader and admins";
    }
    return null;
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1">Manage employee documents and templates</p>
        </div>
        <Button className="gap-2 shadow-md" onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <Card
          className="lg:col-span-1 h-fit animate-slide-up opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <CardHeader>
            <CardTitle className="font-display text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {categories.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.name;
              const isRestricted = isRestrictedCategory(category.name);
              return (
                <button
                  key={category.name}
                  onClick={() => handleCategoryChange(category.name)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all",
                    isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{category.name}</span>
                    {isRestricted && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {isLeaveEvidenceCategory(category.name) ? (
                            <Users className="h-3 w-3 text-blue-500" />
                          ) : (
                            <Lock className="h-3 w-3 text-warning" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getVisibilityTooltip(category.name)}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Badge variant={isSelected ? "secondary" : "outline"} className="text-xs">
                    {categoryCounts[category.name] || 0}
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card
          className="lg:col-span-3 animate-slide-up opacity-0"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isEmployeeFirstCategory && selectedEmployeeId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedEmployeeId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <CardTitle className="font-display text-lg">
                  {isEmployeeFirstCategory && selectedEmployeeId && selectedEmployee
                    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name} — ${selectedCategory}`
                    : selectedCategory}
                </CardTitle>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={isEmployeeFirstCategory && !selectedEmployeeId ? "Search employees..." : "Search documents..."}
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isEmployeeFirstCategory && !selectedEmployeeId ? (
              /* Employee List View */
              (() => {
                const filtered = employeesWithDocs.filter((emp) =>
                  `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
                );
                return filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No employees with {selectedCategory.toLowerCase()} documents</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((emp, index) => (
                      <button
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                              {emp.first_name?.[0]}{emp.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <p className="font-medium text-foreground">{emp.first_name} {emp.last_name}</p>
                            <p className="text-sm text-muted-foreground">{emp.department || "No department"} · {emp.job_title || "No title"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">
                            {emp.docCount} {emp.docCount === 1 ? "document" : "documents"}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents found</p>
                {isEmployeeFirstCategory && selectedEmployeeId && (
                  <Button variant="outline" className="mt-4" onClick={() => setSelectedEmployeeId(null)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Employees
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc, index) => {
                      const uploaderName = doc.uploaded_by === user?.id ? "You" : getUploaderName(doc.uploaded_by);
                      return (
                        <TableRow
                          key={doc.id}
                          className="group cursor-pointer animate-fade-in"
                          style={{ animationDelay: `${300 + index * 50}ms` }}
                        >
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                {getFileIcon(doc.file_type)}
                                <span className="font-medium">{doc.name}</span>
                                {isRestrictedCategory(doc.category) && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      {isLeaveEvidenceCategory(doc.category) ? (
                                        <Users className="h-3 w-3 text-blue-500" />
                                      ) : (
                                        <Lock className="h-3 w-3 text-warning" />
                                      )}
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{getVisibilityTooltip(doc.category)}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              {isEmployeeFirstCategory && selectedEmployee && (
                                <span className="text-xs text-muted-foreground ml-8">
                                  Uploaded by {uploaderName} for {selectedEmployee.first_name} {selectedEmployee.last_name}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal">
                              {doc.category || "Uncategorized"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="text-sm">{uploaderName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(doc.created_at), "MMM d, yyyy")}
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
                                doc.status === "approved" && "border-success text-success bg-success/10",
                              )}
                            >
                              {doc.status || "active"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleView(doc)}>View</DropdownMenuItem>
                                  {(doc.category !== "Contracts" || isVP) && (
                                    <DropdownMenuItem onClick={() => setRenameDoc(doc)}>Rename</DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleShare(doc)}>Share</DropdownMenuItem>
                                  {(doc.category !== "Contracts" || isVP) && (
                                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDoc(doc)}>
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <UploadDocumentDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} onUpload={handleUpload} />

      <DocumentViewDialog
        document={viewDocument}
        open={!!viewDocument}
        onOpenChange={(open) => !open && setViewDocument(null)}
        onDownload={() => viewDocument && handleDownload(viewDocument)}
      />

      <RenameDocumentDialog
        document={renameDoc}
        open={!!renameDoc}
        onOpenChange={(open) => !open && setRenameDoc(null)}
        onRename={(doc, newName) => handleRename(renameDoc, newName)}
      />

      <DeleteDocumentDialog
        document={deleteDoc}
        open={!!deleteDoc}
        onOpenChange={(open) => !open && setDeleteDoc(null)}
        onConfirm={() => handleDelete(deleteDoc)}
      />

      <ShareDocumentDialog
        document={shareDoc}
        open={!!shareDoc}
        onOpenChange={(open) => !open && setShareDoc(null)}
        shareUrl={shareUrl}
      />
    </DashboardLayout>
  );
};

export default Documents;
