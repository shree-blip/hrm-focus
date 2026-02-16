import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "vp" | "manager" | "employee" | "supervisor" | "line_manager";

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  department?: string;
  job_title?: string;
  location?: string;
  status?: string;
  date_of_birth?: string;
  joining_date?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isManager: boolean;
  isAdmin: boolean;
  isVP: boolean;
  isLineManager: boolean;
  isSupervisor: boolean;
  canCreateEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLineManager, setIsLineManager] = useState(false);
  const [canCreateEmployee, setCanCreateEmployee] = useState(false);


  // Check if email exists as an allowed signup/login email (uses a backend RPC to avoid RLS issues)
  const checkAllowlist = async (email: string): Promise<boolean> => {
    const safeEmail = normalizeEmail(email);

    try {
      const { data, error } = await supabase.rpc("verify_signup_email", {
        check_email: safeEmail,
      });

      if (error) {
        console.error("Allowlist check (verify_signup_email) error:", error);
        return false;
      }

      // verify_signup_email is primarily for signup; for existing users it may return allowed=false with reason=already_used.
      const result = data as { allowed?: boolean; reason?: string };
      if (result?.allowed) return true;
      if (result?.reason === "already_used") return true; // already registered => should be allowed to log in

      return false;
    } catch (err) {
      console.error("Allowlist check exception:", err);
      return false;
    }
  };


  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Check allowlist for any login event
      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        const email = session.user.email;
        if (email) {
          // Use setTimeout to prevent deadlock, then check allowlist
          setTimeout(async () => {
            const isAllowed = await checkAllowlist(email);
            if (!isAllowed) {
              // Sign out immediately if not on allowlist
              console.warn(`Email ${email} not on allowlist, signing out`);
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
              setProfile(null);
              setRole(null);
              setIsLineManager(false);
              setCanCreateEmployee(false);
              // Store rejection reason for UI to display
              sessionStorage.setItem("auth_rejected", "not_allowed");
              return;
            }

            // Allowed - fetch profile and role
            fetchProfile(session.user.id);
            fetchRole(session.user.id);
            fetchLineManagerStatus(session.user.id);
          }, 0);
        }
      } else if (!session?.user) {
        setProfile(null);
        setRole(null);
        setIsLineManager(false);
        setCanCreateEmployee(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const email = session.user.email;
        if (email) {
          const isAllowed = await checkAllowlist(email);
          if (!isAllowed) {
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            sessionStorage.setItem("auth_rejected", "not_allowed");
          } else {
            fetchProfile(session.user.id);
            fetchRole(session.user.id);
            fetchLineManagerStatus(session.user.id);
          }
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      setProfile(data);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      setRole(data.role as AppRole);
    }
  };

  const fetchLineManagerStatus = async (userId: string) => {
    // Check if user is a line manager via RPC (job_title based) OR via role
    const { data: lineManagerCheck } = await supabase.rpc('is_line_manager', {
      _user_id: userId
    });
    
    // Also check if the user has the line_manager role in user_roles
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "line_manager")
      .maybeSingle();
    
    setIsLineManager(!!lineManagerCheck || !!roleCheck);

    // Check if user can create employees
    const { data: createCheck } = await supabase.rpc('can_create_employee', {
      _user_id: userId
    });
    setCanCreateEmployee(!!createCheck);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    sessionStorage.removeItem('auth_rejected');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const isManager = role === "manager" || role === "vp" || role === "admin" || role === "supervisor" || role === "line_manager";
  const isAdmin = role === "admin";
  const isVP = role === "vp" || role === "admin";
  const isSupervisor = role === "supervisor";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        isManager,
        isAdmin,
        isVP,
        isLineManager,
        isSupervisor,
        canCreateEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
