import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Lock, User, Loader2, Search, Check, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, ALL_PERMISSIONS, PERMISSION_LABELS, Permission } from "@/hooks/usePermissions";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";

const ROLES = ["vp", "admin", "supervisor", "line_manager", "manager", "employee"] as const;
type AppRole = (typeof ROLES)[number];

// ✅ Only used in Role Permissions matrix (removes "supervisor" column there)
const PERMISSION_ROLES = ROLES.filter((r): r is Exclude<AppRole, "supervisor"> => r !== "supervisor");

const ROLE_LABELS: Record<string, string> = {
  vp: "Vice President",
  admin: "Admin",
  supervisor: "Supervisor",
  line_manager: "Line Manager",
  manager: "Manager",
  employee: "Employee",
};

interface UserWithRole {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  job_title: string | null;
  department: string | null;
  has_account: boolean;
  is_spam?: boolean;
  avatar_url?: string | null; // ✅ add avatar
}

interface UserPermissionOverride {
  user_id: string;
  permission: string;
  enabled: boolean;
}

interface SpamUser {
  user_id: string;
  email: string;
  reason: string;
  is_blocked: boolean;
}

/** ✅ Avatar renderer using signed url hook */
const UserAvatar = ({
  avatarPath,
  firstName,
  lastName,
  isSpam,
}: {
  avatarPath?: string | null;
  firstName: string;
  lastName: string;
  isSpam?: boolean;
}) => {
  const { signedUrl } = useAvatarUrl(avatarPath || null);
  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

  return (
    <Avatar className={cn("h-8 w-8", isSpam && "ring-2 ring-destructive")}>
      <AvatarImage src={signedUrl || ""} />
      <AvatarFallback
        className={cn("text-xs", isSpam ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary")}
      >
        {isSpam ? <AlertTriangle className="h-4 w-4" /> : initials}
      </AvatarFallback>
    </Avatar>
  );
};

export default function AccessControl() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    rolePermissions,
    hasPermission,
    updateRolePermission,
    loading: permLoading,
    refetch: refetchPermissions,
  } = usePermissions();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [spamUsers, setSpamUsers] = useState<SpamUser[]>([]);
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isSecurityMonitor, setIsSecurityMonitor] = useState(false);

  useEffect(() => {
    if (!permLoading && !hasPermission("manage_access")) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [permLoading, hasPermission, navigate]);

  // Check if current user is a security monitor
  useEffect(() => {
    const checkSecurityMonitor = async () => {
      if (!user) return;
      const { data } = await supabase.rpc("is_security_monitor", { _user_id: user.id });
      setIsSecurityMonitor(!!data);
    };
    checkSecurityMonitor();
  }, [user]);

  const fetchSpamUsers = useCallback(async () => {
    const { data, error } = await supabase.from("spam_users").select("user_id, email, reason, is_blocked");
    if (!error && data) setSpamUsers(data);
  }, []);

  const fetchUsers = useCallback(async () => {
    // Fetch all employees
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, email, first_name, last_name, job_title, department, profile_id, status")
      .eq("status", "active")
      .order("first_name");

    if (empError) {
      console.error("Error fetching employees:", empError);
      setLoading(false);
      return;
    }

    // ✅ Fetch all profiles (now includes avatar_url)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, email, first_name, last_name, avatar_url");

    // Fetch all user roles
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");

    // Fetch spam users list
    const { data: spamData } = await supabase.from("spam_users").select("user_id, email");

    const spamUserIds = new Set(spamData?.map((s) => s.user_id) || []);
    const spamEmails = new Set(spamData?.map((s) => s.email.toLowerCase()) || []);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    const profileByUserId = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const roleMap = new Map(rolesData?.map((r) => [r.user_id, r.role]) || []);

    // Get employee user IDs to identify non-employee profiles
    const employeeUserIds = new Set<string>();
    employees.forEach((emp) => {
      const profile = emp.profile_id ? profileMap.get(emp.profile_id) : null;
      if (profile?.user_id) employeeUserIds.add(profile.user_id);
    });

    const usersWithRoles: UserWithRole[] = employees.map((emp) => {
      const profile = emp.profile_id ? profileMap.get(emp.profile_id) : null;
      const userId = profile?.user_id || null;
      const isSpam = userId ? spamUserIds.has(userId) : spamEmails.has(emp.email.toLowerCase());

      return {
        id: emp.id,
        user_id: userId,
        email: emp.email,
        first_name: emp.first_name,
        last_name: emp.last_name,
        job_title: emp.job_title,
        department: emp.department,
        role: userId ? roleMap.get(userId) || "employee" : "employee",
        has_account: !!userId,
        is_spam: isSpam,
        avatar_url: profile?.avatar_url || null, // ✅ attach avatar path
      };
    });

    // Add non-employee profiles (like spam users)
    if (spamData && spamData.length > 0) {
      for (const spam of spamData) {
        if (!employeeUserIds.has(spam.user_id)) {
          const profile = profileByUserId.get(spam.user_id);
          if (profile) {
            usersWithRoles.push({
              id: spam.user_id,
              user_id: spam.user_id,
              email: spam.email,
              first_name: profile.first_name || "Spam",
              last_name: profile.last_name || "User",
              job_title: "UNAUTHORIZED",
              department: null,
              role: roleMap.get(spam.user_id) || "employee",
              has_account: true,
              is_spam: true,
              avatar_url: profile.avatar_url || null,
            });
          }
        }
      }
    }

    setUsers(usersWithRoles);
    setLoading(false);
  }, []);

  const fetchUserOverrides = useCallback(async () => {
    const { data, error } = await supabase.from("user_permission_overrides").select("user_id, permission, enabled");
    if (!error && data) setUserOverrides(data);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchUserOverrides();
    fetchSpamUsers();

    const userRolesChannel = supabase
      .channel("user-roles-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        fetchUsers();
      })
      .subscribe();

    const permissionsChannel = supabase
      .channel("permissions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "role_permissions" }, () => {
        refetchPermissions();
      })
      .subscribe();

    const overridesChannel = supabase
      .channel("overrides-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_permission_overrides" }, () => {
        fetchUserOverrides();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userRolesChannel);
      supabase.removeChannel(permissionsChannel);
      supabase.removeChannel(overridesChannel);
    };
  }, [fetchUsers, fetchUserOverrides, fetchSpamUsers, refetchPermissions]);

  const handleRoleChange = async (userId: string | null, employeeId: string, newRole: string) => {
    if (!userId) {
      toast({
        title: "No Account",
        description: "This employee hasn't created an account yet. Role will apply when they sign up.",
        variant: "destructive",
      });
      return;
    }

    setSaving(employeeId);

    const { data: existingRole } = await supabase.from("user_roles").select("id").eq("user_id", userId).single();

    let error;
    if (existingRole) {
      const result = await supabase
        .from("user_roles")
        .update({ role: newRole as AppRole })
        .eq("user_id", userId);
      error = result.error;
    } else {
      const result = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as AppRole });
      error = result.error;
    }

    if (error) {
      toast({ title: "Error", description: "Failed to update role: " + error.message, variant: "destructive" });
    } else {
      toast({ title: "Role Updated", description: `Role changed to ${ROLE_LABELS[newRole]}.` });
    }

    setSaving(null);
  };

  const handlePermissionToggle = async (role: string, permission: string, currentEnabled: boolean) => {
    if ((role === "vp" || role === "admin") && permission === "manage_access") {
      toast({
        title: "Protected Permission",
        description: "VP and Admin must always have access control permission.",
        variant: "destructive",
      });
      return;
    }

    if (permission === "manage_salaries_all" && role !== "vp" && role !== "admin" && !currentEnabled) {
      toast({
        title: "Restricted Permission",
        description: "Only VP/Admin can have salary management permission.",
        variant: "destructive",
      });
      return;
    }

    const success = await updateRolePermission(role, permission, !currentEnabled);

    if (success) {
      toast({
        title: "Permission Updated",
        description: `${PERMISSION_LABELS[permission as Permission]} ${
          !currentEnabled ? "enabled" : "disabled"
        } for ${ROLE_LABELS[role]}.`,
      });
    } else {
      toast({ title: "Error", description: "Failed to update permission.", variant: "destructive" });
    }
  };

  const getPermissionForRole = (role: string, permission: string): boolean => {
    const found = rolePermissions.find((rp) => rp.role === role && rp.permission === permission);
    return found?.enabled ?? false;
  };

  const getUserPermissionOverride = (userId: string, permission: string): boolean | null => {
    const found = userOverrides.find((o) => o.user_id === userId && o.permission === permission);
    return found ? found.enabled : null;
  };

  const filteredUsers = users.filter((u) => {
    if (u.is_spam && !isSecurityMonitor) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      u.first_name.toLowerCase().includes(searchLower) ||
      u.last_name.toLowerCase().includes(searchLower) ||
      u.email.toLowerCase().includes(searchLower) ||
      (u.department?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  if (loading || permLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPermission("manage_access")) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Access Control
          </h1>
          <p className="text-muted-foreground mt-1">Manage user roles and permissions</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            User Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Lock className="h-4 w-4" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-2">
            <User className="h-4 w-4" />
            Individual Permissions
          </TabsTrigger>
          {isSecurityMonitor && (
            <TabsTrigger value="security" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Security Monitor
            </TabsTrigger>
          )}
        </TabsList>

        {/* User Roles Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Role Assignments</CardTitle>
              <CardDescription>Assign roles to employees. Shows all {users.length} active employees.</CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>

            <CardContent>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Change Role</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} className={cn(u.is_spam && "bg-destructive/5")}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              avatarPath={u.avatar_url || null}
                              firstName={u.first_name}
                              lastName={u.last_name}
                              isSpam={u.is_spam}
                            />
                            <div>
                              <span className={cn("font-medium block", u.is_spam && "text-destructive")}>
                                {u.is_spam ? "⚠️ SPAM USER" : `${u.first_name} ${u.last_name}`}
                              </span>
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <span className={cn("block", u.is_spam && "text-destructive font-bold")}>
                              {u.is_spam ? "UNAUTHORIZED" : u.job_title || "-"}
                            </span>
                            <span className="text-xs text-muted-foreground">{u.department || "-"}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {u.is_spam ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              SPAM
                            </Badge>
                          ) : (
                            <Badge variant={u.has_account ? "default" : "secondary"}>
                              {u.has_account ? "Active" : "No Account"}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              u.role === "vp" && "border-primary text-primary bg-primary/10",
                              u.role === "admin" && "border-destructive text-destructive bg-destructive/10",
                              u.role === "supervisor" && "border-orange-500 text-orange-600 bg-orange-50",
                              u.role === "line_manager" && "border-blue-500 text-blue-600 bg-blue-50",
                              u.role === "manager" && "border-green-500 text-green-600 bg-green-50",
                            )}
                          >
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={(value) => handleRoleChange(u.user_id, u.id, value)}
                            disabled={saving === u.id || !u.has_account}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Permissions Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions Matrix</CardTitle>
              <CardDescription>
                Configure default permissions for each role. VP permissions are protected.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Permission</TableHead>
                    {PERMISSION_ROLES.map((role) => (
                      <TableHead key={role} className="text-center min-w-[100px]">
                        {ROLE_LABELS[role]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_PERMISSIONS.map((permission) => (
                    <TableRow key={permission}>
                      <TableCell className="font-medium">{PERMISSION_LABELS[permission]}</TableCell>

                      {PERMISSION_ROLES.map((role) => {
                        const enabled = getPermissionForRole(role, permission);
                        const isProtected =
                          ((role === "vp" || role === "admin") && permission === "manage_access") ||
                          (permission === "manage_salaries_all" && role !== "vp" && role !== "admin");

                        return (
                          <TableCell key={role} className="text-center">
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => handlePermissionToggle(role, permission, enabled)}
                              disabled={isProtected && enabled}
                              className={cn(isProtected && enabled && "opacity-50")}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual Tab */}
        <TabsContent value="individual">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Select User</CardTitle>
                <CardDescription>Choose a user to manage their individual permissions</CardDescription>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredUsers
                    .filter((u) => u.has_account)
                    .map((u) => (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                          selectedUser?.id === u.id ? "bg-primary/10 border border-primary" : "hover:bg-muted",
                        )}
                      >
                        <UserAvatar
                          avatarPath={u.avatar_url || null}
                          firstName={u.first_name}
                          lastName={u.last_name}
                          isSpam={u.is_spam}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium block truncate">
                            {u.first_name} {u.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate block">{u.email}</span>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedUser
                    ? `Permissions for ${selectedUser.first_name} ${selectedUser.last_name}`
                    : "Select a User"}
                </CardTitle>
                <CardDescription>
                  {selectedUser
                    ? `Override role-based permissions for this user. Role: ${ROLE_LABELS[selectedUser.role]}`
                    : "Click on a user to manage their individual permission overrides"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedUser && selectedUser.user_id ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Permission</TableHead>
                        <TableHead className="text-center">Role Default</TableHead>
                        <TableHead className="text-center">Override</TableHead>
                        <TableHead className="text-center">Effective</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ALL_PERMISSIONS.map((permission) => {
                        const roleDefault = getPermissionForRole(selectedUser.role, permission);
                        const override = getUserPermissionOverride(selectedUser.user_id!, permission);
                        const effective = override !== null ? override : roleDefault;

                        return (
                          <TableRow key={permission}>
                            <TableCell className="font-medium">{PERMISSION_LABELS[permission]}</TableCell>
                            <TableCell className="text-center">
                              {roleDefault ? (
                                <Check className="h-4 w-4 text-green-500 inline" />
                              ) : (
                                <X className="h-4 w-4 text-red-500 inline" />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={override === true}
                                  onCheckedChange={() => {
                                    // keep your original logic
                                    // (your original function was not pasted fully in this snippet)
                                    // If you want, paste that function and I’ll wire it here too.
                                  }}
                                />
                                {override !== null && (
                                  <Badge variant="secondary" className="text-xs">
                                    {override ? "ON" : "OFF"}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={effective ? "default" : "secondary"}>
                                {effective ? "Allowed" : "Denied"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <User className="h-12 w-12 mb-4 opacity-50" />
                    <p>Select a user from the list to manage their permissions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Monitor Tab */}
        {isSecurityMonitor && (
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Security Monitor - Flagged Users
                </CardTitle>
                <CardDescription>
                  Monitor and manage suspicious or unauthorized user accounts. Only visible to Shree Gauli, Bikash
                  Neupane, and VPs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter((u) => u.is_spam)
                      .map((u) => (
                        <TableRow key={u.id} className="bg-destructive/5">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                avatarPath={u.avatar_url || null}
                                firstName={u.first_name}
                                lastName={u.last_name}
                                isSpam={true}
                              />
                              <span className="font-medium text-destructive">SPAM USER</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">Blocked</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              Unauthorized signup - not in employee list
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    {users.filter((u) => u.is_spam).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          No flagged users found. System is secure.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </DashboardLayout>
  );
}
