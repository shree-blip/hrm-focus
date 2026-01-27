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
  Share2,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments, Document, PRIVATE_CATEGORIES } from "@/hooks/useDocuments";
import { useSharedDocuments } from "@/hooks/useSharedDocuments";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { DocumentViewDialog } from "@/components/documents/DocumentViewDialog";
import { RenameDocumentDialog } from "@/components/documents/RenameDocumentDialog";
import { DeleteDocumentDialog } from "@/components/documents/DeleteDocumentDialog";
import { ShareDocumentDialog } from "@/components/documents/ShareDocumentDialog";
import { SendDocumentDialog } from "@/components/documents/SendDocumentDialog";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

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
    name: "NDA Agreement.pdf",
    file_path: "",
    file_type: "pdf",
    file_size: 89000,
    category: "Contracts",
    created_at: "2025-11-15",
    updated_at: "2025-11-15",
    status: "active",
    uploaded_by: "",
    employee_id: null,
  },
  {
    id: "4",
    name: "Code of Conduct Policy.pdf",
    file_path: "",
    file_type: "pdf",
    file_size: 456000,
    category: "Policies",
    created_at: "2025-12-18",
    updated_at: "2025-12-18",
    status: "draft",
    uploaded_by: "",
    employee_id: null,
  },
  {
    id: "5",
    name: "Compliance Checklist.pdf",
    file_path: "",
    file_type: "pdf",
    file_size: 178000,
    category: "Compliance",
    created_at: "2025-12-10",
    updated_at: "2025-12-10",
    status: "completed",
    uploaded_by: "",
    employee_id: null,
  },
  {
    id: "6",
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
];

const categories = [
  { name: "All Documents", icon: FolderOpen },
  { name: "Shared with me", icon: Share2 },
  { name: "Contracts", icon: FileText },
  { name: "Policies", icon: File },
  { name: "Compliance", icon: File },
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
  const { user, isAdmin } = useAuth();
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
  } = useDocuments();
  const {
    sharedDocuments,
    loading: sharedLoading,
    downloadSharedDocument,
    markAsRead,
    unreadCount,
  } = useSharedDocuments();
  const [selectedCategory, setSelectedCategory] = useState("All Documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<DisplayDocument | null>(null);
  const [renameDoc, setRenameDoc] = useState<DisplayDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DisplayDocument | null>(null);
  const [shareDoc, setShareDoc] = useState<DisplayDocument | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [sendDoc, setSendDoc] = useState<DisplayDocument | null>(null);

  // Check if viewing shared documents
  const isSharedView = selectedCategory === "Shared with me";

  // Use real documents if available, otherwise use mock data
  const documents: DisplayDocument[] = realDocuments.length > 0 ? realDocuments : mockDocuments;

  // Filter documents based on category and search
  const filteredDocuments = useMemo(() => {
    if (isSharedView) return []; // Don't show regular docs in shared view
    return documents.filter((doc) => {
      const matchesCategory = selectedCategory === "All Documents" || doc.category === selectedCategory;
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [documents, selectedCategory, searchQuery, isSharedView]);

  // Filter shared documents based on search
  const filteredSharedDocuments = useMemo(() => {
    if (!isSharedView) return [];
    return sharedDocuments.filter((doc) =>
      doc.document_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.sender_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sharedDocuments, searchQuery, isSharedView]);

  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 
      "All Documents": documents.length,
      "Shared with me": sharedDocuments.length,
    };
    documents.forEach((doc) => {
      if (doc.category) {
        counts[doc.category] = (counts[doc.category] || 0) + 1;
      }
    });
    return counts;
  }, [documents, sharedDocuments]);

  const handleUpload = async (docData: {
    name: string;
    type: string;
    category: string;
    size: string;
    date: string;
    status: string;
    file?: File;
  }) => {
    if (docData.file) {
      await uploadDocument(docData.file, docData.category);
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
              const isSharedCategory = category.name === "Shared with me";
              const hasUnread = isSharedCategory && unreadCount > 0;
              return (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all",
                    isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{category.name}</span>
                    {hasUnread && !isSelected && (
                      <Badge variant="destructive" className="text-xs h-5 min-w-5 flex items-center justify-center">
                        {unreadCount}
                      </Badge>
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
              <CardTitle className="font-display text-lg">{selectedCategory}</CardTitle>
              <div className="flex gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(loading || (isSharedView && sharedLoading)) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isSharedView ? (
              // Shared documents view
              filteredSharedDocuments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No shared documents</p>
                  <p className="text-sm mt-2">Documents sent to you will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Name</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSharedDocuments.map((doc, index) => (
                        <TableRow
                          key={doc.id}
                          className={cn(
                            "group cursor-pointer animate-fade-in",
                            !doc.is_read && "bg-primary/5"
                          )}
                          style={{ animationDelay: `${300 + index * 50}ms` }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {getFileIcon(doc.file_type)}
                              <span className={cn("font-medium", !doc.is_read && "font-semibold")}>
                                {doc.document_name}
                              </span>
                              {!doc.is_read && (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span className="text-sm">{doc.sender_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal">
                              {doc.category || "Uncategorized"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatFileSize(doc.file_size)}
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
                                doc.is_read
                                  ? "border-muted-foreground text-muted-foreground"
                                  : "border-primary text-primary bg-primary/10"
                              )}
                            >
                              {doc.is_read ? "Read" : "Unread"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => downloadSharedDocument(doc)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {!doc.is_read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => markAsRead(doc.id)}
                                >
                                  Mark as read
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents found</p>
                <Button variant="outline" className="mt-4" onClick={() => setUploadDialogOpen(true)}>
                  Upload your first document
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc, index) => (
                      <TableRow
                        key={doc.id}
                        className="group cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${300 + index * 50}ms` }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getFileIcon(doc.file_type)}
                            <span className="font-medium">{doc.name}</span>
                            {isPrivateCategory(doc.category) && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Lock className="h-3 w-3 text-warning" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Private - Only visible to uploader and admins</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-normal">
                              {doc.category || "Uncategorized"}
                            </Badge>
                            {isPrivateCategory(doc.category) && <Lock className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="text-sm">
                              {doc.uploaded_by === user?.id ? "You" : getUploaderName(doc.uploaded_by)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatFileSize(doc.file_size)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(doc.updated_at || doc.created_at), "MMM d, yyyy")}
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
                                <DropdownMenuItem onClick={() => setRenameDoc(doc)}>Rename</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleShare(doc)}>Copy Link</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSendDoc(doc)}>Send to Employee</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDoc(doc)}>
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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

      <SendDocumentDialog
        document={sendDoc}
        open={!!sendDoc}
        onOpenChange={(open) => !open && setSendDoc(null)}
      />
    </DashboardLayout>
  );
};

export default Documents;
