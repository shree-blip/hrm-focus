import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Shield, Building2, Loader2, Camera, Upload, X, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Settings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { preferences, updateProfile, updatePreferences, updatePassword, loading } = useSettings();

  // Get signed URL for avatar
  const { signedUrl: avatarSignedUrl } = useAvatarUrl(profile?.avatar_url);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notification preferences state
  const [leaveNotifications, setLeaveNotifications] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [payrollNotifications, setPayrollNotifications] = useState(true);
  const [performanceNotifications, setPerformanceNotifications] = useState(false);
  const [emailDigest, setEmailDigest] = useState(false);

  // Company settings state
  const [companyName, setCompanyName] = useState("Focus Your Finance");
  const [timezone, setTimezone] = useState("America/New_York (EST)");
  const [fiscalYear, setFiscalYear] = useState("January 1");
  const [payFrequency, setPayFrequency] = useState("Semi-Monthly");
  const [companySettingsChanged, setCompanySettingsChanged] = useState(false);

  // Add state for visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  // Initialize preferences
  useEffect(() => {
    if (preferences) {
      setLeaveNotifications(preferences.leave_notifications ?? true);
      setTaskNotifications(preferences.task_notifications ?? true);
      setPayrollNotifications(preferences.payroll_notifications ?? true);
      setPerformanceNotifications(preferences.performance_notifications ?? false);
      setEmailDigest(preferences.email_digest ?? false);
    }
  }, [preferences]);

  const handleSaveProfile = async () => {
    setSaving(true);
    await updateProfile({
      first_name: firstName,
      last_name: lastName,
      phone,
    });
    setSaving(false);
  };

  const handleChangePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploadingAvatar(true);

    try {
      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.includes("/avatars/")
          ? profile.avatar_url.split("/avatars/")[1]
          : profile.avatar_url;
        if (oldPath) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Update profile with new avatar path
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: fileName,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      toast({
        title: "Photo Updated",
        description: "Your profile photo has been updated successfully.",
      });

      // Refresh profile to get new avatar URL everywhere
      if (refreshProfile) {
        await refreshProfile();
      }

      // Clear preview after successful upload
      setAvatarPreview(null);
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload profile photo.",
        variant: "destructive",
      });
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile?.avatar_url) return;

    setIsUploadingAvatar(true);
    try {
      // Delete from storage
      const oldPath = profile.avatar_url.includes("/avatars/")
        ? profile.avatar_url.split("/avatars/")[1]
        : profile.avatar_url;
      if (oldPath) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setAvatarPreview(null);
      toast({
        title: "Photo Removed",
        description: "Your profile photo has been removed.",
      });

      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove profile photo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const result = await updatePassword(currentPassword, newPassword);
    if (!result.error) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  };

  const handleNotificationChange = async (key: string, value: boolean) => {
    switch (key) {
      case "leave_notifications":
        setLeaveNotifications(value);
        break;
      case "task_notifications":
        setTaskNotifications(value);
        break;
      case "payroll_notifications":
        setPayrollNotifications(value);
        break;
      case "performance_notifications":
        setPerformanceNotifications(value);
        break;
      case "email_digest":
        setEmailDigest(value);
        break;
    }

    await updatePreferences({ [key]: value });
  };

  const handleSaveCompanySettings = () => {
    if (!companySettingsChanged) {
      return;
    }
    toast({
      title: "Company Settings Saved",
      description: "Your company settings have been updated",
    });
    setCompanySettingsChanged(false);
  };

  const handleCompanyFieldChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setCompanySettingsChanged(true);
  };

  const getInitials = () => {
    return `${firstName?.[0] || "J"}${lastName?.[0] || "D"}`.toUpperCase();
  };

  // Display avatar preview if uploading, otherwise signed URL
  const displayAvatarUrl = avatarPreview || avatarSignedUrl || "";

  return (
    <DashboardLayout>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
      />

      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and system preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList
          className="animate-slide-up opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            Company
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="profile"
          className="space-y-6 animate-slide-up opacity-0"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Profile Information</CardTitle>
              <CardDescription>Update your personal details and profile picture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="h-20 w-20 cursor-pointer overflow-hidden rounded-full" onClick={handleChangePhoto}>
                    {isUploadingAvatar ? (
                      <div className="h-full w-full flex items-center justify-center bg-muted">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <>
                        <AvatarImage src={displayAvatarUrl} className="h-full w-full object-cover" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                          {getInitials()}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>

                  {!isUploadingAvatar && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={handleChangePhoto}
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleChangePhoto} disabled={isUploadingAvatar}>
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Change Photo
                        </>
                      )}
                    </Button>
                    {profile?.avatar_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveAvatar}
                        disabled={isUploadingAvatar}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF. Max 5MB.</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={profile?.email || ""} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={profile?.job_title || "Employee"} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" value={profile?.department || "General"} disabled className="bg-muted" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Photo Guidelines */}
          <Card className="border-dashed">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Camera className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Profile Photo Guidelines</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Use a professional headshot or clear photo of yourself</li>
                    <li>Supported formats: JPG, PNG, WebP, GIF</li>
                    <li>Maximum file size: 5MB</li>
                    <li>Your photo will be visible across all pages and to your colleagues</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="notifications"
          className="space-y-6 animate-slide-up opacity-0"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Leave Requests</p>
                    <p className="text-sm text-muted-foreground">Get notified when team members request leave</p>
                  </div>
                  <Switch
                    checked={leaveNotifications}
                    onCheckedChange={(checked) => handleNotificationChange("leave_notifications", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Task Assignments</p>
                    <p className="text-sm text-muted-foreground">Receive alerts for new task assignments</p>
                  </div>
                  <Switch
                    checked={taskNotifications}
                    onCheckedChange={(checked) => handleNotificationChange("task_notifications", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Payroll Reminders</p>
                    <p className="text-sm text-muted-foreground">Get reminded before payroll deadlines</p>
                  </div>
                  <Switch
                    checked={payrollNotifications}
                    onCheckedChange={(checked) => handleNotificationChange("payroll_notifications", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Performance Reviews</p>
                    <p className="text-sm text-muted-foreground">Notifications for review cycles</p>
                  </div>
                  <Switch
                    checked={performanceNotifications}
                    onCheckedChange={(checked) => handleNotificationChange("performance_notifications", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Digest</p>
                    <p className="text-sm text-muted-foreground">Receive daily summary of activities</p>
                  </div>
                  <Switch
                    checked={emailDigest}
                    onCheckedChange={(checked) => handleNotificationChange("email_digest", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="security"
          className="space-y-6 animate-slide-up opacity-0"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Badge variant="outline" className="border-success text-success">
                    Enabled
                  </Badge>
                </div>

                <label>Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <label>New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <label>Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleUpdatePassword} disabled={saving || !newPassword}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="company"
          className="space-y-6 animate-slide-up opacity-0"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Company Settings</CardTitle>
              <CardDescription>Manage company-wide configurations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => handleCompanyFieldChange(setCompanyName, e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={timezone}
                    onChange={(e) => handleCompanyFieldChange(setTimezone, e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscalYear">Fiscal Year Start</Label>
                  <Input
                    id="fiscalYear"
                    value={fiscalYear}
                    onChange={(e) => handleCompanyFieldChange(setFiscalYear, e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payFrequency">Pay Frequency</Label>
                  <Input
                    id="payFrequency"
                    value={payFrequency}
                    onChange={(e) => handleCompanyFieldChange(setPayFrequency, e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Regional Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-accent/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🇺🇸</span>
                      <p className="font-medium">US Operations</p>
                    </div>
                    <p className="text-sm text-muted-foreground">32 employees • FLSA Compliant</p>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🇳🇵</span>
                      <p className="font-medium">Nepal Operations</p>
                    </div>
                    <p className="text-sm text-muted-foreground">16 employees • Nepal Labor Act</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveCompanySettings} disabled={!companySettingsChanged}>
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Settings;
