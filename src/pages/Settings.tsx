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
import { User, Bell, Shield, Building2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "@/hooks/use-toast";

const Settings = () => {
  const { profile } = useAuth();
  const { preferences, updateProfile, updateAvatar, updatePreferences, updatePassword, loading } = useSettings();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  
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

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url || "");
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
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image under 2MB",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const result = await updateAvatar(file);
    if (result.url) {
      setAvatarUrl(result.url);
    }
    setSaving(false);
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
    // Update local state immediately
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

    // Save to database
    await updatePreferences({ [key]: value });
  };

  const handleSaveCompanySettings = () => {
    // In a real app, this would save to a company_settings table
    toast({
      title: "Company Settings Saved",
      description: "Your company settings have been updated",
    });
  };

  const getInitials = () => {
    return `${firstName?.[0] || 'J'}${lastName?.[0] || 'D'}`.toUpperCase();
  };

  return (
    <DashboardLayout>
      {/* Hidden file input for avatar upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and system preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="animate-slide-up opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
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

        <TabsContent value="profile" className="space-y-6 animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Profile Information</CardTitle>
              <CardDescription>Update your personal details and profile picture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" onClick={handleChangePhoto} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Change Photo
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input 
                    id="firstName" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input 
                    id="lastName" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={profile?.email || ""} 
                    disabled 
                    className="bg-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input 
                    id="role" 
                    value={profile?.job_title || "Employee"} 
                    disabled 
                    className="bg-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input 
                    id="department" 
                    value={profile?.department || "General"} 
                    disabled 
                    className="bg-muted" 
                  />
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
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
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

        <TabsContent value="security" className="space-y-6 animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
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
                  <Badge variant="outline" className="border-success text-success">Enabled</Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input 
                    id="currentPassword" 
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword" 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
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

        <TabsContent value="company" className="space-y-6 animate-slide-up opacity-0" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
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
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input 
                    id="timezone" 
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscalYear">Fiscal Year Start</Label>
                  <Input 
                    id="fiscalYear" 
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payFrequency">Pay Frequency</Label>
                  <Input 
                    id="payFrequency" 
                    value={payFrequency}
                    onChange={(e) => setPayFrequency(e.target.value)}
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
                <Button onClick={handleSaveCompanySettings}>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Settings;
