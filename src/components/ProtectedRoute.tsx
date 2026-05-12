import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  /** @deprecated Use requiredPermission instead for granular access */
  requiredRole?: "admin" | "vp" | "manager" | "employee";
  /** Permission key(s) — user needs at least ONE to access */
  requiredPermission?: Permission | Permission[];
}

export function ProtectedRoute({ children, requiredRole, requiredPermission }: ProtectedRouteProps) {
  const { user, loading, isManager, isAdmin, isVP } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();

  if (loading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check permission-based access (new system)
  if (requiredPermission) {
    const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasAccess = perms.some((p) => hasPermission(p));
    
    // Also allow if user has the old role-based access (CEO/Admin always pass)
    if (!hasAccess && !isVP && !isAdmin) {
      return <Navigate to="/" replace />;
    }
  }

  // Legacy role check (keep for backward compat)
  if (requiredRole && !requiredPermission) {
    const hasAccess = 
      requiredRole === "admin" ? isAdmin :
      requiredRole === "vp" ? isVP :
      requiredRole === "manager" ? isManager :
      true;

    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
