import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, File, X, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (document: {
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
  }) => void;
}

const CATEGORY_INFO: Record<string, string> = {
  Contracts: "Private - Only VP can upload. Visible to assigned employee and admins.",
  Policies: "Public - Visible to all employees",
  Compliance: "Private - Only you and admins can view. Requires employee selection.",
  "Leave Evidence": "Restricted - Visible to you, managers, line managers, VPs, and admins",
};

interface EmployeeOption {
  id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  employee_id: string | null;
}

export function UploadDocumentDialog({ open, onOpenChange, onUpload }: UploadDocumentDialogProps) {
  const { user, isAdmin, isVP, isManager, isLineManager } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Compliance-specific fields
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [citizenshipPhoto, setCitizenshipPhoto] = useState<File | null>(null);
  const [panCardPhoto, setPanCardPhoto] = useState<File | null>(null);
  const [otherDocument, setOtherDocument] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const citizenshipRef = useRef<HTMLInputElement>(null);
  const panCardRef = useRef<HTMLInputElement>(null);
  const otherDocRef = useRef<HTMLInputElement>(null);

  const allowedTypes = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];

  // Fetch employees when dialog opens
  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, profile_id, first_name, last_name, employee_id")
      .eq("status", "active")
      .order("first_name");

    if (!error && data) {
      setEmployees(data);
    }
    setLoadingEmployees(false);
  };

  // Determine which categories user can see
  const getAvailableCategories = () => {
    const cats: { value: string; label: string }[] = [];

    // Contracts - VP only
    if (isVP) {
      cats.push({ value: "Contracts", label: "Contracts" });
    }

    // Policies - any manager+
    cats.push({ value: "Policies", label: "Policies" });

    // Compliance - Line Manager, Manager, Admin, VP
    if (isLineManager || isManager || isAdmin || isVP) {
      cats.push({ value: "Compliance", label: "Compliance" });
    }

    // Leave Evidence - anyone
    cats.push({ value: "Leave Evidence", label: "Leave Evidence" });

    return cats;
  };

  const requiresEmployeeSelection = category === "Compliance" || category === "Contracts";
  const isComplianceCategory = category === "Compliance";

  const validateFile = (selectedFile: File): boolean => {
    const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      toast({
        title: "Invalid File Type",
        description: "Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files are allowed.",
        variant: "destructive",
      });
      return false;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      } else {
        e.target.value = "";
      }
    }
  };

  const handleComplianceFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void
  ) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setter(selectedFile);
      } else {
        e.target.value = "";
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileType = (filename: string) => {
    return filename.split(".").pop()?.toLowerCase() || "file";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast({ title: "Missing Information", description: "Please select a category.", variant: "destructive" });
      return;
    }

    if (requiresEmployeeSelection && !selectedEmployeeId) {
      toast({ title: "Employee Required", description: "Please select an employee for this category.", variant: "destructive" });
      return;
    }

    // For compliance, we need at least one file
    if (isComplianceCategory) {
      if (!file && !citizenshipPhoto && !panCardPhoto && !otherDocument) {
        toast({ title: "Missing Files", description: "Please upload at least one document.", variant: "destructive" });
        return;
      }
    } else if (!file) {
      toast({ title: "Missing File", description: "Please select a file.", variant: "destructive" });
      return;
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    const mainFile = file || citizenshipPhoto || panCardPhoto || otherDocument;

    onUpload({
      name: mainFile?.name || "Compliance Documents",
      type: mainFile ? getFileType(mainFile.name) : "pdf",
      category,
      size: mainFile ? formatFileSize(mainFile.size) : "0 B",
      date: dateStr,
      status: "active",
      file: mainFile || undefined,
      employeeId: requiresEmployeeSelection ? selectedEmployeeId : undefined,
      complianceData: isComplianceCategory
        ? {
            bankAccountNumber: bankAccountNumber || undefined,
            citizenshipPhoto: citizenshipPhoto || undefined,
            panCardPhoto: panCardPhoto || undefined,
            otherDocument: otherDocument || undefined,
          }
        : undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setFile(null);
    setCategory("");
    setSelectedEmployeeId("");
    setBankAccountNumber("");
    setCitizenshipPhoto(null);
    setPanCardPhoto(null);
    setOtherDocument(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const availableCategories = getAvailableCategories();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Upload Document</DialogTitle>
          <DialogDescription>Upload a new document to the system.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Document Category *</Label>
            <Select value={category} onValueChange={(val) => { setCategory(val); setSelectedEmployeeId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Info Alert */}
          {category && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{CATEGORY_INFO[category]}</AlertDescription>
            </Alert>
          )}

          {/* Employee Selection - for Compliance and Contracts */}
          {requiresEmployeeSelection && (
            <div className="space-y-2">
              <Label>Select Employee *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingEmployees ? "Loading employees..." : "Select an employee"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} {emp.employee_id ? `(${emp.employee_id})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Compliance-specific fields */}
          {isComplianceCategory && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium text-sm">Compliance Documents</h4>

              {/* Bank Account Number */}
              <div className="space-y-2">
                <Label>Bank Account Number</Label>
                <Input
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Enter bank account number"
                />
              </div>

              {/* Citizenship Photo */}
              <div className="space-y-2">
                <Label>Citizenship Photo</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => citizenshipRef.current?.click()}>
                    {citizenshipPhoto ? citizenshipPhoto.name : "Choose file"}
                  </Button>
                  {citizenshipPhoto && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCitizenshipPhoto(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  <input ref={citizenshipRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => handleComplianceFileChange(e, setCitizenshipPhoto)} />
                </div>
              </div>

              {/* PAN Card Photo */}
              <div className="space-y-2">
                <Label>PAN Card Photo</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => panCardRef.current?.click()}>
                    {panCardPhoto ? panCardPhoto.name : "Choose file"}
                  </Button>
                  {panCardPhoto && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPanCardPhoto(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  <input ref={panCardRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => handleComplianceFileChange(e, setPanCardPhoto)} />
                </div>
              </div>

              {/* Other Document */}
              <div className="space-y-2">
                <Label>Other Document</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => otherDocRef.current?.click()}>
                    {otherDocument ? otherDocument.name : "Choose file"}
                  </Button>
                  {otherDocument && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOtherDocument(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  <input ref={otherDocRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(e) => handleComplianceFileChange(e, setOtherDocument)} />
                </div>
              </div>
            </div>
          )}

          {/* Main File Upload Zone - not shown for Compliance (has its own fields) */}
          {!isComplianceCategory && (
            <div className="space-y-2">
              <Label>Document File *</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <File className="h-10 w-10 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">Click to upload a file</p>
                    <p className="text-sm text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG up to 10MB</p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Upload Document</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
