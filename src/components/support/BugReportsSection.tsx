import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBugReports } from "@/hooks/useBugReports";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Bug, ImagePlus, X, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";

// IT team user IDs (Sagar and Bikash)
const IT_TEAM_IDS = [
  "744c4e71-96bf-4c43-a225-dcbb3b762080",
];

export function BugReportsSection() {
  const { bugReports, loading, submitBugReport, updateBugStatus, getScreenshotUrl } = useBugReports();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isITTeam = user && IT_TEAM_IDS.includes(user.id);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshot(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    
    setSubmitting(true);
    const result = await submitBugReport(title, description, screenshot || undefined);
    setSubmitting(false);

    if (result.success) {
      setTitle("");
      setDescription("");
      removeScreenshot();
      setIsDialogOpen(false);
    }
  };

  const handleViewScreenshot = async (path: string) => {
    const url = await getScreenshotUrl(path);
    if (url) {
      setViewingScreenshot(url);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400";
      case "in_progress":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400";
      case "resolved":
        return "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400";
      case "closed":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Submit Bug Report Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-destructive" />
            Report a Bug
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Bug Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Report a Bug</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Brief description of the issue"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide detailed steps to reproduce the bug..."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Screenshot (optional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {previewUrl ? (
                    <div className="relative">
                      <img
                        src={previewUrl}
                        alt="Screenshot preview"
                        className="w-full h-40 object-cover rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={removeScreenshot}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-20 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="h-6 w-6 mr-2 text-muted-foreground" />
                      <span className="text-muted-foreground">Add Screenshot</span>
                    </Button>
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!title.trim() || !description.trim() || submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Bug Report"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Found a bug? Report it here and our IT team will look into it.
          </p>
        </CardContent>
      </Card>

      {/* Bug Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isITTeam ? "All Bug Reports" : "My Bug Reports"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bugReports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No bug reports found
            </p>
          ) : (
            <div className="space-y-4">
              {bugReports.map((report) => (
                <div
                  key={report.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{report.title}</h4>
                      {isITTeam && (
                        <p className="text-sm text-muted-foreground">
                          Reported by: {report.reporter_name} ({report.reporter_email})
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Badge className={getStatusColor(report.status)}>
                      {report.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm">{report.description}</p>
                  <div className="flex items-center gap-2">
                    {report.screenshot_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewScreenshot(report.screenshot_url!)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Screenshot
                      </Button>
                    )}
                    {isITTeam && (
                      <Select
                        value={report.status}
                        onValueChange={(value) => updateBugStatus(report.id, value)}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Screenshot Viewer Dialog */}
      <Dialog open={!!viewingScreenshot} onOpenChange={() => setViewingScreenshot(null)}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          {viewingScreenshot && (
            <img
              src={viewingScreenshot}
              alt="Bug screenshot"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
