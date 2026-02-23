// Admin authentication page (sign in, sign up, magic link, reset password)
// Accessibility: Semantic HTML, clear headings, accessible controls, ARIA labels
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");

export default function Auth() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    user,
    isLoading: authLoading,
    signIn,
    signInWithMagicLink,
    signUp,
    resetPassword,
  } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [magicLinkCooldown, setMagicLinkCooldown] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);

  const supabaseHost = (() => {
    try {
      const url = new URL(import.meta.env.VITE_SUPABASE_URL || "");
      return url.host;
    } catch {
      return "Not configured";
    }
  })();

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/admin");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (magicLinkCooldown <= 0 && resetCooldown <= 0) return;
    const interval = setInterval(() => {
      setMagicLinkCooldown((current) => (current > 0 ? current - 1 : 0));
      setResetCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [magicLinkCooldown, resetCooldown]);

  const isRateLimitError = (message: string) =>
    /rate limit|too many requests|security purposes/i.test(message);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Invalid input",
          description: err.errors[0].message,
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description:
            'Invalid email or password. Check for extra spaces in email, or use "Reset password".',
        });
      } else if (error.message.includes("Email not confirmed")) {
        toast({
          variant: "destructive",
          title: "Email not confirmed",
          description: "Please verify your email address before signing in.",
        });
      } else if (error.message.includes("Email logins are disabled")) {
        toast({
          variant: "destructive",
          title: "Auth disabled",
          description: "Email/password login is disabled in Supabase Auth settings.",
        });
      } else if (error.message.includes("Too many requests")) {
        toast({
          variant: "destructive",
          title: "Too many attempts",
          description: "Please wait a few minutes and try again.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message,
        });
      }
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
      nameSchema.parse(signupName);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Invalid input",
          description: err.errors[0].message,
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);

    if (error) {
      if (error.message.includes("User already registered")) {
        toast({
          variant: "destructive",
          title: "Sign up failed",
          description:
            "An account with this email already exists. Please sign in instead.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sign up failed",
          description: error.message,
        });
      }
    } else {
      toast({
        title: "Account created",
        description: "Please check your email to verify your account.",
      });
      setSignupEmail("");
      setSignupPassword("");
      setSignupName("");
    }

    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    try {
      emailSchema.parse(loginEmail);
    } catch {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Enter your email in the Sign In form first, then click Reset password.",
      });
      return;
    }

    if (resetCooldown > 0) {
      toast({
        variant: "destructive",
        title: "Please wait",
        description: `Please wait ${resetCooldown}s before requesting another reset email.`,
      });
      return;
    }

    setIsLoading(true);
    const { error } = await resetPassword(loginEmail);
    setIsLoading(false);

    if (error) {
      if (isRateLimitError(error.message)) {
        setResetCooldown(60);
        toast({
          variant: "destructive",
          title: "Rate limit exceeded",
          description:
            "Please wait about 60 seconds before trying reset again.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Reset failed",
          description: error.message,
        });
      }
      return;
    }

    setResetCooldown(60);
    toast({
      title: "Reset email sent",
      description: "Check your inbox and spam folder.",
    });
  };

  const handleMagicLink = async () => {
    try {
      emailSchema.parse(loginEmail);
    } catch {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Enter your email in the Sign In form first, then click Email magic link.",
      });
      return;
    }

    if (magicLinkCooldown > 0) {
      toast({
        variant: "destructive",
        title: "Please wait",
        description: `Please wait ${magicLinkCooldown}s before requesting another magic link.`,
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signInWithMagicLink(loginEmail);
    setIsLoading(false);

    if (error) {
      if (isRateLimitError(error.message)) {
        setMagicLinkCooldown(60);
        toast({
          variant: "destructive",
          title: "Rate limit exceeded",
          description:
            "Please wait about 60 seconds before requesting another magic link.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Magic link failed",
          description: error.message,
        });
      }
      return;
    }

    setMagicLinkCooldown(60);
    toast({
      title: "Magic link sent",
      description: "Open it from your email to sign in instantly.",
    });
  };

  if (authLoading) {
    return (
      <div className="admin-shell-bg min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="admin-shell-bg min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden lg:flex rounded-3xl border border-border/70 bg-card/90 p-10 shadow-[0_20px_60px_rgba(15,23,42,0.10)] flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-3 text-primary">
              <BarChart3 className="h-10 w-10" />
              <span className="text-3xl font-bold tracking-tight">FeedbackHub</span>
            </div>
            <h1 className="mt-10 text-4xl font-bold text-foreground leading-tight">
              Professional campaign intelligence for client feedback.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Build campaigns, collect trusted responses, and deliver executive-ready insights.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Secure admin access with role-based permissions.
          </p>
        </div>

        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-6 lg:hidden">
            <div className="inline-flex items-center gap-2 text-primary">
              <BarChart3 className="h-10 w-10" />
              <span className="text-2xl font-bold">FeedbackHub</span>
            </div>
            <p className="mt-2 text-muted-foreground">Admin Portal</p>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-[0_20px_55px_rgba(15,23,42,0.12)]">
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>Sign in to access the admin dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="admin@company.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="********"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="link"
                      className="w-full"
                      onClick={handleMagicLink}
                      disabled={isLoading || magicLinkCooldown > 0}
                    >
                      {magicLinkCooldown > 0
                        ? `Email magic link (${magicLinkCooldown}s)`
                        : "Email magic link"}
                    </Button>

                    <Button
                      type="button"
                      variant="link"
                      className="w-full"
                      onClick={handleResetPassword}
                      disabled={isLoading || resetCooldown > 0}
                    >
                      {resetCooldown > 0
                        ? `Reset password (${resetCooldown}s)`
                        : "Reset password"}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      If rate-limited, use password sign-in and avoid repeated email requests for ~60 seconds.
                    </p>

                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="admin@company.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="********"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
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

          <p className="text-center text-xs text-muted-foreground mt-6">
            New admin accounts require role assignment by a super admin.
          </p>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Connected Supabase: {supabaseHost}
          </p>
        </div>
      </div>
    </div>
  );
}
