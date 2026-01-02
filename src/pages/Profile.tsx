import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  User, Mail, Phone, MapPin, Building2, Briefcase, Calendar, Save, Loader2, 
  Camera, Upload, X 
} from "lucide-react";

const Profile = () => {
  const { user, profile, role, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    location: "",
    job_title: "",
    department: "",
  });

  // Sync form data with profile when profile changes or editing starts
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        location: profile.location || "",
        job_title: profile.job_title || "",
        department: profile.department || "",
      });
    }
  }, [profile, isEditing]);

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
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
        const oldPath = profile.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast({
        title: "Photo Updated",
        description: "Your profile photo has been updated successfully.",
      });

      // Refresh profile to get new avatar URL
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (error: any) {
      console.error('Avatar upload error:', error);
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
      const oldPath = profile.avatar_url.split('/avatars/')[1];
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

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

  const handleSave = async () => {
    if (!user) return;
    
    // Validate required fields
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast({
        title: "Required Fields",
        description: "First name and last name are required.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim() || null,
        location: formData.location.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
      if (refreshProfile) {
        await refreshProfile();
      }
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAvatarPreview(null);
    // Reset form data to original profile values
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        location: profile.location || "",
        job_title: profile.job_title || "",
        department: profile.department || "",
      });
    }
  };

  const getRoleBadgeColor = () => {
    switch (role) {
      case "admin":
        return "bg-destructive text-destructive-foreground";
      case "vp":
        return "bg-primary text-primary-foreground";
      case "manager":
        return "bg-info text-info-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "vp":
        return "VP / HR Director";
      case "manager":
        return "Manager";
      default:
        return "Employee";
    }
  };

  const initials = profile 
    ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`
    : "??";

  const displayAvatarUrl = avatarPreview || profile?.avatar_url || "";

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1">View and manage your personal information</p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <Card className="animate-slide-up">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Avatar Section */}
              <div className="relative group">
                <Avatar 
                  className={`h-28 w-28 border-4 border-background shadow-lg ${isEditing ? 'cursor-pointer' : ''}`}
                  onClick={handleAvatarClick}
                >
                  {isUploadingAvatar ? (
                    <div className="h-full w-full flex items-center justify-center bg-muted">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <AvatarImage src={displayAvatarUrl} />
                      <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                
                {isEditing && !isUploadingAvatar && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={handleAvatarClick}
                  >
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {isEditing && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photo
                    </Button>
                    {profile?.avatar_url && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-destructive hover:text-destructive"
                        onClick={handleRemoveAvatar}
                        disabled={isUploadingAvatar}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex-1 space-y-4">
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-display font-bold">
                        {profile?.first_name} {profile?.last_name}
                      </h2>
                      <Badge className={getRoleBadgeColor()}>{getRoleLabel()}</Badge>
                    </div>
                    <p className="text-muted-foreground">{profile?.job_title || "No title set"}</p>
                    <p className="text-sm text-muted-foreground">{profile?.department || "No department"}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Contact Information
              </CardTitle>
              <CardDescription>Your contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address
                </Label>
                <Input value={profile?.email || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="Enter phone number"
                  className={!isEditing ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Location
                </Label>
                <Input 
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="Enter location (e.g., New York, US)"
                  className={!isEditing ? "bg-muted" : ""}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Employment Information
              </CardTitle>
              <CardDescription>Your employment details (managed by HR)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Department
                </Label>
                <Input value={formData.department || "Not assigned"} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Job Title
                </Label>
                <Input value={formData.job_title || "Not assigned"} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Status
                </Label>
                <Input 
                  value={profile?.status || "Active"} 
                  disabled 
                  className="bg-muted" 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Photo Guidelines */}
        {isEditing && (
          <Card className="animate-fade-in border-dashed">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Camera className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Profile Photo Guidelines</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Use a professional headshot or clear photo of yourself</li>
                    <li>Supported formats: JPG, PNG, WebP, GIF</li>
                    <li>Maximum file size: 5MB</li>
                    <li>Your photo will be visible to your colleagues, line manager, and HR</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Profile;
