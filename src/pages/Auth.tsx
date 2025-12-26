import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Building2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

interface AllowedSignup {
  email: string;
  is_used: boolean;
  employee_id: string | null;
}

interface Employee {
  first_name: string;
  last_name: string;
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Check if email is in allowed list when user types
  useEffect(() => {
    const checkEmail = async () => {
      if (!signupEmail || !emailSchema.safeParse(signupEmail).success) {
        setEmailValid(null);
        setEmailError("");
        return;
      }

      setEmailChecking(true);
      
      // Check allowed_signups table
      const { data: allowedData, error: allowedError } = await supabase
        .from("allowed_signups")
        .select("email, is_used, employee_id")
        .eq("email", signupEmail.toLowerCase())
        .maybeSingle();

      if (allowedError) {
        setEmailValid(false);
        setEmailError("Error checking email. Please try again.");
        setEmailChecking(false);
        return;
      }

      if (!allowedData) {
        setEmailValid(false);
        setEmailError("This email is not authorized to sign up. Please contact your VP or manager to be added to the system.");
        setEmailChecking(false);
        return;
      }

      if (allowedData.is_used) {
        setEmailValid(false);
        setEmailError("This email has already been registered. Please login instead.");
        setEmailChecking(false);
        return;
      }

      // Email is valid - fetch employee details to auto-fill name
      if (allowedData.employee_id) {
        const { data: employeeData } = await supabase
          .from("employees")
          .select("first_name, last_name")
          .eq("id", allowedData.employee_id)
          .single();

        if (employeeData) {
          setFirstName(employeeData.first_name);
          setLastName(employeeData.last_name);
        }
      }

      setEmailValid(true);
      setEmailError("");
      setEmailChecking(false);
    };

    const debounce = setTimeout(checkEmail, 500);
    return () => clearTimeout(debounce);
  }, [signupEmail]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
    }

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      let message = error.message;
      if (error.message.includes("Invalid login credentials")) {
        message = "Invalid email or password. Please try again.";
      }
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      navigate("/");
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate email is in allowed list
    if (!emailValid) {
      toast({
        title: "Sign Up Not Allowed",
        description: emailError || "This email is not authorized to sign up.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
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

    const { error } = await signUp(signupEmail, signupPassword, firstName, lastName);

    if (error) {
      let message = error.message;
      if (error.message.includes("already registered")) {
        message = "This email is already registered. Please try logging in instead.";
      }
      toast({
        title: "Sign Up Failed",
        description: message,
        variant: "destructive",
      });
    } else {
      // Mark the signup as used
      await supabase
        .from("allowed_signups")
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq("email", signupEmail.toLowerCase());

      toast({
        title: "Account Created!",
        description: "You have been registered successfully.",
      });
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md animate-fade-in shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-display">Focus Your Finance</CardTitle>
            <CardDescription>Clarity Care Suite - HR Management System</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@focusyourfinance.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Work Email</Label>
                  <div className="relative">
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@focusyourfinance.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className={emailValid === false ? "border-destructive" : emailValid === true ? "border-green-500" : ""}
                      required
                    />
                    {emailChecking && (
                      <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {!emailChecking && emailValid === true && (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                    )}
                    {!emailChecking && emailValid === false && (
                      <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                </div>

                {emailValid && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first-name">First Name</Label>
                        <Input
                          id="first-name"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last-name">Last Name</Label>
                        <Input
                          id="last-name"
                          placeholder="Doe"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                <Alert variant="default" className="bg-muted/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Only pre-approved employees can sign up. If your email is not recognized, please contact your VP or line manager to be added.
                  </AlertDescription>
                </Alert>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || !emailValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
