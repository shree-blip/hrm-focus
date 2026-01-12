import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2, Mail, Lock, User, ArrowRight, Quote } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import focusLogo from "@/assets/focus-logo.png";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

interface QuoteData {
  text: string;
  author: string;
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithGoogle, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  // Quote state
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Signup form state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Email validation state
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Fetch inspirational quote
  useEffect(() => {
    const fetchQuote = async () => {
      setQuoteLoading(true);
      try {
        // Try quotable.io first (has 1000+ quotes)
        const response = await fetch("https://api.quotable.io/random?tags=inspirational|motivational|success|wisdom");
        if (response.ok) {
          const data = await response.json();
          setQuote({ text: data.content, author: data.author });
        } else {
          // Fallback to type.fit API
          const fallbackResponse = await fetch("https://type.fit/api/quotes");
          if (fallbackResponse.ok) {
            const quotes = await fallbackResponse.json();
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            setQuote({
              text: randomQuote.text,
              author: randomQuote.author?.replace(", type.fit", "") || "Unknown",
            });
          }
        }
      } catch (error) {
        // Use a default quote if both APIs fail
        setQuote({
          text: "The only way to do great work is to love what you do.",
          author: "Steve Jobs",
        });
      }
      setQuoteLoading(false);
    };

    fetchQuote();
  }, []);

  // Check for auth rejection on mount
  useEffect(() => {
    const rejected = sessionStorage.getItem("auth_rejected");
    if (rejected === "not_allowed") {
      sessionStorage.removeItem("auth_rejected");
      toast({
        title: "Access Denied",
        description: "Your email is not authorized to access this system. Please contact your administrator.",
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Check if email is in allowed list when user types - with proper debouncing
  useEffect(() => {
    const normalized = normalizeEmail(signupEmail);

    // Reset validation state immediately if email is empty or invalid format
    if (!normalized || !emailSchema.safeParse(normalized).success) {
      setEmailValid(null);
      setEmailError("");
      return;
    }

    // Set checking state before the debounce timeout
    const checkingTimeout = setTimeout(() => {
      setEmailChecking(true);
    }, 400);

    const debounce = setTimeout(async () => {
      const { data, error } = await supabase.rpc("verify_signup_email", {
        check_email: normalized,
      });

      if (error) {
        setEmailValid(false);
        setEmailError("Error checking email. Please try again.");
        setEmailChecking(false);
        return;
      }

      const result = data as { allowed: boolean; reason?: string; employee_id?: string };

      if (!result.allowed) {
        setEmailValid(false);
        if (result.reason === "already_used") {
          setEmailError("This email has already been registered. Please login instead.");
        } else {
          setEmailError("This email is not authorized to sign up. Please contact your VP or manager.");
        }
        setEmailChecking(false);
        return;
      }

      if (result.employee_id) {
        const { data: employeeData } = await supabase
          .from("employee_directory")
          .select("first_name, last_name")
          .eq("id", result.employee_id)
          .single();

        if (employeeData) {
          setFirstName(employeeData.first_name || "");
          setLastName(employeeData.last_name || "");
        }
      }

      setEmailValid(true);
      setEmailError("");
      setEmailChecking(false);
    }, 800);

    return () => {
      clearTimeout(checkingTimeout);
      clearTimeout(debounce);
    };
  }, [signupEmail]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalized = normalizeEmail(loginEmail);

    if (!normalized) {
      toast({ title: "Email Required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }

    if (!loginPassword) {
      toast({ title: "Password Required", description: "Please enter your password.", variant: "destructive" });
      return;
    }

    const emailResult = emailSchema.safeParse(normalized);
    if (!emailResult.success) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(normalized, loginPassword);

    if (error) {
      const message = error.message.includes("Invalid login credentials")
        ? "Invalid email or password. Please try again."
        : error.message;
      toast({ title: "Login Failed", description: message, variant: "destructive" });
    } else {
      toast({ title: "Welcome back!", description: "You have been logged in successfully." });
      navigate("/");
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({ title: "Google Sign-In Failed", description: error.message, variant: "destructive" });
      setIsGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const normalized = normalizeEmail(signupEmail);

    if (!emailValid) {
      toast({
        title: "Sign Up Not Allowed",
        description: emailError || "This email is not authorized.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      emailSchema.parse(normalized);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: "Validation Error", description: err.errors[0].message, variant: "destructive" });
        setIsLoading(false);
        return;
      }
    }

    if (signupPassword !== signupConfirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are the same.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(normalized, signupPassword, firstName, lastName);

    if (error) {
      const message = error.message.includes("already registered")
        ? "This email is already registered. Please try logging in instead."
        : error.message;
      toast({ title: "Sign Up Failed", description: message, variant: "destructive" });
    } else {
      await supabase.rpc("mark_signup_used", { check_email: normalized });
      toast({ title: "Account Created!", description: "You have been registered successfully." });
      navigate("/");
    }
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );

  // Mobile view - stacked layout
  const mobileAuthView = (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header with logo */}
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 py-8 px-6">
        <div className="flex flex-col items-center space-y-3">
          <img src={focusLogo} alt="Focus Logo" className="w-16 h-16 object-contain" />
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-foreground tracking-tight">FOCUS</h2>
            <p className="text-primary-foreground/80 text-sm">Human Resource Management</p>
          </div>
        </div>
      </div>

      {/* Toggle Tabs */}
      <div className="bg-card mx-4 -mt-4 rounded-t-2xl shadow-lg">
        <div className="flex border-b border-border">
          <button
            onClick={() => setIsRightPanelActive(false)}
            className={cn(
              "flex-1 py-4 text-sm font-medium transition-colors",
              !isRightPanelActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground",
            )}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsRightPanelActive(true)}
            className={cn(
              "flex-1 py-4 text-sm font-medium transition-colors",
              isRightPanelActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground",
            )}
          >
            Sign Up
          </button>
        </div>

        <div className="p-6">
          {!isRightPanelActive ? (
            // Sign In Form
            <div className="space-y-5">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 gap-3 text-base font-medium border-2 hover:bg-muted/50 transition-colors"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading || isLoading}
              >
                {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground">or</span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="mobile-login-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="mobile-login-email"
                      type="email"
                      placeholder="you@company.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10 h-12"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile-login-password" className="text-sm font-medium">
                    Password
                  </Label>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                    <Input
                      id="mobile-login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10 h-12"
                      autoComplete="current-password"
                    />

                    {/* Eye Button */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <a href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={isLoading || isGoogleLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
                    </>
                  ) : (
                    <>
                      Sign In <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          ) : (
            // Sign Up Form
            <div className="space-y-5">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 gap-3 text-base font-medium border-2 hover:bg-muted/50 transition-colors"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading || isLoading}
              >
                {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground">or</span>
                </div>
              </div>

              <form onSubmit={handleSignup} className="space-y-3" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="mobile-signup-email" className="text-sm font-medium">
                    Work Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="mobile-signup-email"
                      type="email"
                      placeholder="you@company.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className={cn(
                        "pl-10 h-12",
                        emailValid === false && "border-destructive focus-visible:ring-destructive",
                        emailValid === true && "border-green-500 focus-visible:ring-green-500",
                      )}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {emailChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {!emailChecking && emailValid === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {!emailChecking && emailValid === false && <AlertCircle className="h-4 w-4 text-destructive" />}
                    </div>
                  </div>
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </div>

                {emailValid && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-first-name" className="text-sm font-medium">
                          First Name
                        </Label>
                        <Input
                          id="mobile-first-name"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="h-12"
                          readOnly
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-last-name" className="text-sm font-medium">
                          Last Name
                        </Label>
                        <Input
                          id="mobile-last-name"
                          placeholder="Doe"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="h-12"
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="mobile-signup-password" className="text-sm font-medium">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="mobile-signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="pl-10 h-12"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Min 8 chars, uppercase, lowercase, number & special char
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="mobile-confirm-password" className="text-sm font-medium">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="mobile-confirm-password"
                          type="password"
                          placeholder="••••••••"
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className="pl-10 h-12"
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={isLoading || isGoogleLoading || !emailValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...
                    </>
                  ) : (
                    <>
                      Create Account <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Quote Section */}
      <div className="flex-1 px-6 py-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 space-y-3">
          <Quote className="h-6 w-6 text-primary/60 mx-auto" />
          {quoteLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/60" />
            </div>
          ) : quote ? (
            <>
              <p className="text-sm text-white/90 font-medium leading-relaxed italic text-center">"{quote.text}"</p>
              <p className="text-xs text-white/60 text-center">— {quote.author}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  // Desktop view - sliding panels
  const desktopAuthView = (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 overflow-hidden">
      <div className="relative w-full max-w-5xl h-[650px] bg-card rounded-3xl shadow-2xl overflow-hidden">
        {/* Sign In Form */}
        <div
          className={cn(
            "absolute top-0 left-0 w-1/2 h-full flex flex-col items-center justify-center px-12 transition-all duration-700 ease-in-out z-10",
            isRightPanelActive ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100",
          )}
        >
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome Back</h1>
              <p className="text-muted-foreground">Sign in to continue to Focus</p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-3 text-base font-medium border-2 hover:bg-muted/50 transition-colors"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">or sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-10 h-11"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile-login-password" className="text-sm font-medium">
                  Password
                </Label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                  <Input
                    id="mobile-login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 pr-10 h-12"
                    autoComplete="current-password"
                  />

                  {/* Eye Button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <a href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Sign Up Form */}
        <div
          className={cn(
            "absolute top-0 left-0 w-1/2 h-full flex flex-col items-center justify-center px-12 transition-all duration-700 ease-in-out",
            isRightPanelActive
              ? "translate-x-full opacity-100 z-20"
              : "translate-x-0 opacity-0 pointer-events-none z-0",
          )}
        >
          <div className="w-full max-w-sm space-y-5">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Account</h1>
              <p className="text-muted-foreground">Join Focus to get started</p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-3 text-base font-medium border-2 hover:bg-muted/50 transition-colors"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">or register with email</span>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-3" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-sm font-medium">
                  Work Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@company.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className={cn(
                      "pl-10 h-10",
                      emailValid === false && "border-destructive focus-visible:ring-destructive",
                      emailValid === true && "border-green-500 focus-visible:ring-green-500",
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {emailChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!emailChecking && emailValid === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {!emailChecking && emailValid === false && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              </div>

              {emailValid && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="first-name" className="text-sm font-medium">
                        First Name
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="first-name"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="pl-10 h-10"
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="last-name" className="text-sm font-medium">
                        Last Name
                      </Label>
                      <Input
                        id="last-name"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-10"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password" className="text-sm font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="pl-10 h-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Min 8 chars, uppercase, lowercase, number & special char
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-sm font-medium">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="pl-10 h-10"
                      />
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={isLoading || isGoogleLoading || !emailValid}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...
                  </>
                ) : (
                  <>
                    Create Account <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Sliding Overlay Panel */}
        <div
          className={cn(
            "absolute top-0 left-1/2 w-1/2 h-full bg-gradient-to-br from-primary via-primary/90 to-primary/80 transition-transform duration-700 ease-in-out z-30",
            isRightPanelActive ? "-translate-x-full" : "translate-x-0",
          )}
        >
          <div className="relative h-full flex flex-col items-center justify-center px-12 text-primary-foreground">
            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
              <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
              <div className="absolute top-1/2 right-8 w-32 h-32 rounded-full bg-white/5" />
            </div>

            <div className="relative z-10 text-center space-y-8 max-w-md">
              {/* Logo */}
              <div className="flex flex-col items-center space-y-3">
                <img src={focusLogo} alt="Focus Logo" className="w-20 h-20 object-contain" />
                <h2 className="text-3xl font-bold tracking-tight">FOCUS</h2>
                <p className="text-primary-foreground/80 text-sm">Human Resource Management</p>
              </div>

              {/* Daily Quote */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 space-y-4">
                <Quote className="h-8 w-8 text-primary-foreground/60 mx-auto" />
                {quoteLoading ? (
                  <div className="flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : quote ? (
                  <>
                    <p className="text-lg font-medium leading-relaxed italic">"{quote.text}"</p>
                    <p className="text-sm text-primary-foreground/70">— {quote.author}</p>
                  </>
                ) : null}
              </div>

              {/* Toggle Button */}
              {isRightPanelActive ? (
                <div className="space-y-3">
                  <p className="text-primary-foreground/80">Already have an account?</p>
                  <Button
                    variant="outline"
                    className="border-2 border-white/30 bg-transparent hover:bg-white/10 text-white h-11 px-8 font-medium"
                    onClick={() => setIsRightPanelActive(false)}
                  >
                    Sign In
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-primary-foreground/80">New to Focus?</p>
                  <Button
                    variant="outline"
                    className="border-2 border-white/30 bg-transparent hover:bg-white/10 text-white h-11 px-8 font-medium"
                    onClick={() => setIsRightPanelActive(true)}
                  >
                    Create Account
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden">{mobileAuthView}</div>
      {/* Desktop View */}
      <div className="hidden md:block">{desktopAuthView}</div>
    </>
  );
}
