import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Shield, Users, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, ALL_PERMISSIONS, PERMISSION_LABELS, Permission } from "@/hooks/usePermissions";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const ROLES = ['vp', 'admin', 'supervisor', 'line_manager', 'manager', 'employee'] as const;

const ROLE_LABELS: Record<string, string> = {
  vp: 'Vice President',
  admin: 'Admin',
  supervisor: 'Supervisor',
  line_manager: 'Line Manager',
  manager: 'Manager',
  employee: 'Employee',
};

interface UserWithRole {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function AccessControl() {
  const navigate = useNavigate();
  const { user, isVP } = useAuth();
  const { rolePermissions, hasPermission, updateRolePermission, loading: permLoading } = usePermissions();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not VP
    if (!permLoading && !hasPermission('manage_access')) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [permLoading, hasPermission, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, first_name, last_name');

    if (profilesError) {
      setLoading(false);
      return;
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const roleMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

    const usersWithRoles: UserWithRole[] = profilesData.map(p => ({
      id: p.user_id,
      email: p.email,
      first_name: p.first_name,
      last_name: p.last_name,
      role: roleMap.get(p.user_id) || 'employee',
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setSaving(userId);
    
    // First try to update
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingRole) {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as any })
        .eq('user_id', userId);
      
      if (error) {
        toast({
          title: "Error",
          description: "Failed to update role.",
          variant: "destructive",
        });
        setSaving(null);
        return;
      }
    } else {
      // Insert new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole as any });
      
      if (insertError) {
        toast({
          title: "Error",
          description: "Failed to assign role.",
          variant: "destructive",
        });
        setSaving(null);
        return;
      }
    }

    toast({
      title: "Role Updated",
      description: `User role changed to ${ROLE_LABELS[newRole]}.`,
    });

    await fetchUsers();
    setSaving(null);
  };

  const handlePermissionToggle = async (role: string, permission: string, currentEnabled: boolean) => {
    // Prevent modifying VP/admin manage_access
    if ((role === 'vp' || role === 'admin') && permission === 'manage_access') {
      toast({
        title: "Protected Permission",
        description: "VP and Admin must always have access control permission.",
        variant: "destructive",
      });
      return;
    }

    // Prevent giving manage_salaries_all to non-VP
    if (permission === 'manage_salaries_all' && role !== 'vp' && role !== 'admin' && !currentEnabled) {
      toast({
        title: "Restricted Permission",
        description: "Only VP can have salary management permission.",
        variant: "destructive",
      });
      return;
    }

    const success = await updateRolePermission(role, permission, !currentEnabled);
    
    if (success) {
      toast({
        title: "Permission Updated",
        description: `${PERMISSION_LABELS[permission as Permission]} ${!currentEnabled ? 'enabled' : 'disabled'} for ${ROLE_LABELS[role]}.`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update permission.",
        variant: "destructive",
      });
    }
  };

  const getPermissionForRole = (role: string, permission: string): boolean => {
    const found = rolePermissions.find(rp => rp.role === role && rp.permission === permission);
    return found?.enabled ?? false;
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  if (loading || permLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPermission('manage_access')) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Access Control
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage user roles and permissions
          </p>
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
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Role Assignments</CardTitle>
              <CardDescription>
                Assign roles to users. Each user can have one role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Change Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(u.first_name, u.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.first_name} {u.last_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          u.role === 'vp' && "border-primary text-primary bg-primary/10",
                          u.role === 'admin' && "border-destructive text-destructive bg-destructive/10",
                          u.role === 'supervisor' && "border-warning text-warning bg-warning/10",
                          u.role === 'line_manager' && "border-info text-info bg-info/10",
                          u.role === 'manager' && "border-success text-success bg-success/10"
                        )}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(value) => handleRoleChange(u.id, value)}
                          disabled={saving === u.id}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions Matrix</CardTitle>
              <CardDescription>
                Configure which permissions each role has. VP permissions are protected.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Permission</TableHead>
                    {ROLES.map((role) => (
                      <TableHead key={role} className="text-center min-w-[100px]">
                        {ROLE_LABELS[role]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_PERMISSIONS.map((permission) => (
                    <TableRow key={permission}>
                      <TableCell className="font-medium">
                        {PERMISSION_LABELS[permission]}
                      </TableCell>
                      {ROLES.map((role) => {
                        const enabled = getPermissionForRole(role, permission);
                        const isProtected = 
                          ((role === 'vp' || role === 'admin') && permission === 'manage_access') ||
                          (permission === 'manage_salaries_all' && role !== 'vp' && role !== 'admin');
                        
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
      </Tabs>
    </DashboardLayout>
  );
}
