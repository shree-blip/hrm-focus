import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "vp" | "employee" | "supervisor" | "line_manager";

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

  // Track whether the user was already validated in this browser session
  // so TOKEN_REFRESHED doesn't re-check allowlist (the main cause of random logouts)
  const allowlistValidatedRef = useRef(false);

  // Prevent running init logic from both getSession and onAuthStateChange simultaneously
  const initRunRef = useRef(false);

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


  // Helper to load profile, role, line-manager status for a user
  const initUserData = async (userId: string) => {
    await Promise.all([
      fetchProfile(userId),
      fetchRole(userId),
      fetchLineManagerStatus(userId),
    ]);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      // Always keep session/user state in sync
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        const email = currentSession.user.email;
        const userId = currentSession.user.id;

        if (event === "TOKEN_REFRESHED") {
          // On token refresh, SKIP allowlist re-check — the user was already
          // validated on SIGNED_IN or session restore. Re-checking the allowlist
          // RPC on every token refresh caused random logouts when the RPC
          // returned an error (network blip, rate-limit, timeout).
          // Still refresh profile/role in case they changed.
          setTimeout(() => initUserData(userId), 0);
          return;
        }

        if (event === "INITIAL_SESSION") {
          // This fires when getSession() resolves — handled in getSession block below.
          // Skip to avoid double-init.
          return;
        }

        // SIGNED_IN — first login in this tab
        if (email) {
          setTimeout(async () => {
            // Check if employee is deactivated
            try {
              const { data: activeCheck } = await supabase.rpc("check_employee_active", { check_email: email });
              const activeResult = activeCheck as { active?: boolean; reason?: string } | null;
              if (activeResult && !activeResult.active && activeResult.reason === "deactivated") {
                console.warn(`Employee ${email} is deactivated, signing out`);
                await supabase.auth.signOut();
                setUser(null);
                setSession(null);
                setProfile(null);
                setRole(null);
                setIsLineManager(false);
                setCanCreateEmployee(false);
                sessionStorage.setItem("auth_rejected", "account_deactivated");
                return;
              }
            } catch {
              // Don't block login on RPC failure
            }

            const isAllowed = await checkAllowlist(email);
            if (!isAllowed) {
              console.warn(`Email ${email} not on allowlist, signing out`);
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
              setProfile(null);
              setRole(null);
              setIsLineManager(false);
              setCanCreateEmployee(false);
              sessionStorage.setItem("auth_rejected", "not_allowed");
              return;
            }

            allowlistValidatedRef.current = true;
            await initUserData(userId);
          }, 0);
        }
      } else if (!currentSession?.user) {
        setProfile(null);
        setRole(null);
        setIsLineManager(false);
        setCanCreateEmployee(false);
        allowlistValidatedRef.current = false;
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (initRunRef.current) {
        // onAuthStateChange already handled this
        setLoading(false);
        return;
      }
      initRunRef.current = true;

      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        // SKIP allowlist on session restore — user was already validated when
        // they first signed in. Re-checking on every refresh causes logouts
        // when the RPC fails (network blip, mobile wake-up, rate-limit).
        allowlistValidatedRef.current = true;
        await initUserData(existingSession.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name, email, phone, avatar_url, department, job_title, location, status, date_of_birth, joining_date")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      // Defensive: ensure fetched profile matches the requested user
      if (data.user_id !== userId) {
        console.error(`Profile mismatch: requested ${userId} but got ${data.user_id}`);
        setProfile(null);
        return;
      }
      setProfile(data);
    } else if (error) {
      // Fallback: use cached session data instead of calling getUser() which
      // can fail with 403 "missing sub claim" on stale JWTs during refresh
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const sessionUser = currentSession?.user;
      if (sessionUser && sessionUser.id === userId) {
        setProfile({
          id: '',
          user_id: userId,
          first_name: sessionUser.user_metadata?.first_name || sessionUser.email?.split('@')[0] || 'User',
          last_name: sessionUser.user_metadata?.last_name || '',
          email: sessionUser.email || '',
        });
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const fetchRole = async (userId: string) => {
    // Fetch ALL roles for the user (they may have multiple, e.g. employee + line_manager)
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!error && data && data.length > 0) {
      // Pick the highest-priority role
      const priority: AppRole[] = ["admin", "vp", "supervisor", "line_manager", "employee"];
      const roles = data.map((d) => d.role as AppRole);
      const bestRole = priority.find((p) => roles.includes(p)) || roles[0];
      setRole(bestRole);
    }
  };

  const fetchLineManagerStatus = async (userId: string) => {
    // Check line manager via RPC + can_create_employee in parallel
    const [lineManagerResult, createResult] = await Promise.all([
      supabase.rpc('is_line_manager', { _user_id: userId }),
      supabase.rpc('can_create_employee', { _user_id: userId }),
    ]);

    // Also check the role (already fetched by fetchRole, use role state)
    setIsLineManager(!!lineManagerResult.data);
    setCanCreateEmployee(!!createResult.data);
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
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
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    sessionStorage.removeItem('auth_rejected');
    // Dynamically import to avoid circular dependency
    import("@/hooks/useEmployees").then(m => m.clearEmployeesCache());
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setIsLineManager(false);
    setCanCreateEmployee(false);
  }, []);

  const refreshProfileCb = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user]);

  const isManager = useMemo(() => role === "vp" || role === "admin" || role === "supervisor" || role === "line_manager", [role]);
  const isAdmin = useMemo(() => role === "admin", [role]);
  const isVP = useMemo(() => role === "vp" || role === "admin", [role]);
  const isSupervisor = useMemo(() => role === "supervisor", [role]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    role,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refreshProfile: refreshProfileCb,
    isManager,
    isAdmin,
    isVP,
    isLineManager,
    isSupervisor,
    canCreateEmployee,
  }), [user, session, profile, role, loading, signIn, signUp, signInWithGoogle, signOut, refreshProfileCb, isManager, isAdmin, isVP, isLineManager, isSupervisor, canCreateEmployee]);

  return (
    <AuthContext.Provider value={value}>
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
