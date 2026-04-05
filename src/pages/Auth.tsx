// Admin authentication page (sign in, sign up, magic link, reset password)
// Accessibility: Semantic HTML, clear headings, accessible controls, ARIA labels
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProfileAccountType } from "@/lib/supabase-types";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");

const accountTypeOptions: Array<{
  value: ProfileAccountType;
  label: string;
  description: string;
}> = [
  {
    value: "organization",
    label: "Organization",
    description: "Use your company context across campaigns and thank-you messages.",
  },
  {
    value: "individual",
    label: "Individual",
    description: "Use your personal identity as the default responder-facing signoff.",
  },
];

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
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupOrganizationName, setSignupOrganizationName] = useState("");
  const [signupAccountType, setSignupAccountType] =
    useState<ProfileAccountType>("organization");
  const [signupShowThankYouSignoff, setSignupShowThankYouSignoff] = useState(true);
  const [magicLinkCooldown, setMagicLinkCooldown] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [onboardingToken, setOnboardingToken] = useState("");
  const [onboardingUsername, setOnboardingUsername] = useState("");
  const [onboardingFullName, setOnboardingFullName] = useState("");
  const [onboardingOrganizationName, setOnboardingOrganizationName] = useState("");
  const [onboardingPassword, setOnboardingPassword] = useState("");
  const [onboardingAccountType, setOnboardingAccountType] =
    useState<ProfileAccountType>("organization");
  const [onboardingShowThankYouSignoff, setOnboardingShowThankYouSignoff] = useState(true);

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
    const params = new URLSearchParams(window.location.search);
    setOnboardingToken(params.get("onboarding_token") || "");
  }, []);

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
      if (!loginIdentifier.trim()) {
        throw new Error("identifier_required");
      }
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
      if (err instanceof Error && err.message === "identifier_required") {
        toast({
          variant: "destructive",
          title: "Invalid input",
          description: "Please enter your email or username.",
        });
        return;
      }
    }

    setIsLoading(true);
    let emailToUse = loginIdentifier.trim();
    if (!emailToUse.includes("@")) {
      const { data, error: lookupError } = await supabase.rpc(
        "get_email_by_username",
        {
          p_username: emailToUse,
        },
      );
      if (lookupError || !data) {
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: "Invalid username or password.",
        });
        return;
      }
      emailToUse = data;
    }

    const { error } = await signIn(emailToUse, loginPassword);

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
      if (signupAccountType === "organization") {
        nameSchema.parse(signupOrganizationName);
      }
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
    const { error } = await signUp(signupEmail, signupPassword, signupName, {
      accountType: signupAccountType,
      organizationName:
        signupAccountType === "organization" ? signupOrganizationName : undefined,
      showThankYouSignoff: signupShowThankYouSignoff,
    });

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
      setSignupOrganizationName("");
      setSignupAccountType("organization");
      setSignupShowThankYouSignoff(true);
    }

    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    try {
      emailSchema.parse(loginIdentifier);
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
    const { error } = await resetPassword(loginIdentifier);
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
      emailSchema.parse(loginIdentifier);
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
    const { error } = await signInWithMagicLink(loginIdentifier);
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

  const handleOnboardingComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingToken) return;
    if (onboardingUsername.trim().length < 2) {
      toast({
        variant: "destructive",
        title: "Invalid username",
        description: "Username must be at least 2 characters.",
      });
      return;
    }
    try {
      nameSchema.parse(onboardingFullName);
      if (onboardingAccountType === "organization") {
        nameSchema.parse(onboardingOrganizationName);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Invalid name",
          description: err.errors[0].message,
        });
        return;
      }
    }
    if (onboardingPassword.trim().length < 6) {
      toast({
        variant: "destructive",
        title: "Invalid password",
        description: "Password must be at least 6 characters.",
      });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.functions.invoke("consume-onboarding-invite", {
      body: {
        token: onboardingToken,
        username: onboardingUsername,
        fullName: onboardingFullName,
        accountType: onboardingAccountType,
        organizationName:
          onboardingAccountType === "organization"
            ? onboardingOrganizationName
            : undefined,
        showThankYouSignoff: onboardingShowThankYouSignoff,
        password: onboardingPassword,
      },
    });
    setIsLoading(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Onboarding failed",
        description: error.message,
      });
      return;
    }
    toast({
      title: "Onboarding complete",
      description: "Your account is ready. Please sign in.",
    });
    setOnboardingToken("");
    setOnboardingFullName("");
    setOnboardingOrganizationName("");
    setOnboardingAccountType("organization");
    setOnboardingShowThankYouSignoff(true);
    window.history.replaceState({}, "", "/auth");
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
              <div className="inline-flex flex-col items-start text-primary">
                <img
                  src="/illustrations/mascot/nkowa_logo.png"
                  alt="Nkọwa logo"
                  className="h-28 w-auto object-contain lg:h-36"
                />
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.32em] text-slate-500">
                  Campaign Intelligence Platform
                </p>
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
              <div className="inline-flex flex-col items-center justify-center text-primary">
                <img
                  src="/illustrations/mascot/nkowa_logo.png"
                  alt="Nkọwa logo"
                  className="h-24 w-auto object-contain"
                />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Campaign Intelligence Platform
                </p>
              </div>
            <p className="mt-2 text-muted-foreground">Admin Portal</p>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-[0_20px_55px_rgba(15,23,42,0.12)]">
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>Sign in to access the admin dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              {onboardingToken ? (
                <form onSubmit={handleOnboardingComplete} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="onboard-full-name">Full Name</Label>
                    <Input
                      id="onboard-full-name"
                      type="text"
                      placeholder="Jane Doe"
                      value={onboardingFullName}
                      onChange={(e) => setOnboardingFullName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-username">Username</Label>
                    <Input
                      id="onboard-username"
                      type="text"
                      placeholder="your.username"
                      value={onboardingUsername}
                      onChange={(e) => setOnboardingUsername(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-account-type">Account Type</Label>
                      <Select
                        value={onboardingAccountType}
                        onValueChange={(value: ProfileAccountType) => {
                          setOnboardingAccountType(value);
                        }}
                        disabled={isLoading}
                      >
                      <SelectTrigger id="onboard-account-type">
                        <SelectValue placeholder="Choose account type" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {
                        accountTypeOptions.find(
                          (option) => option.value === onboardingAccountType,
                        )?.description
                      }
                    </p>
                  </div>
                  {onboardingAccountType === "organization" && (
                    <div className="space-y-2">
                      <Label htmlFor="onboard-organization-name">Organization Name</Label>
                      <Input
                        id="onboard-organization-name"
                        type="text"
                        placeholder="Acme Advisory"
                        value={onboardingOrganizationName}
                        onChange={(e) => setOnboardingOrganizationName(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        This is a profile display name only and does not change your client company records.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="onboard-thank-you-mode">
                      Thank-you note signoff
                    </Label>
                    <Select
                      value={onboardingShowThankYouSignoff ? "yes" : "no"}
                      onValueChange={(value) =>
                        setOnboardingShowThankYouSignoff(value === "yes")
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger id="onboard-thank-you-mode">
                        <SelectValue placeholder="Choose yes or no" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {onboardingShowThankYouSignoff
                        ? onboardingAccountType === "individual"
                          ? "Responders will see your personal profile name on the thank-you page."
                          : "Responders will see the organization name saved in your profile on the thank-you page."
                        : "The thank-you page will not show your personal or organization signoff name."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-password">Set Password</Label>
                    <Input
                      id="onboard-password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={onboardingPassword}
                      onChange={(e) => setOnboardingPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      "Complete Onboarding"
                    )}
                  </Button>
                </form>
              ) : (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email or Username</Label>
                      <Input
                        id="login-email"
                        type="text"
                        placeholder="admin@company.com or username"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
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
                    <div className="space-y-2">
                      <Label htmlFor="signup-account-type">Account Type</Label>
                      <Select
                        value={signupAccountType}
                        onValueChange={(value: ProfileAccountType) => {
                          setSignupAccountType(value);
                        }}
                        disabled={isLoading}
                      >
                        <SelectTrigger id="signup-account-type">
                          <SelectValue placeholder="Choose account type" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {
                          accountTypeOptions.find(
                            (option) => option.value === signupAccountType,
                          )?.description
                        }
                      </p>
                    </div>
                    {signupAccountType === "organization" && (
                      <div className="space-y-2">
                        <Label htmlFor="signup-organization-name">Organization Name</Label>
                        <Input
                          id="signup-organization-name"
                          type="text"
                          placeholder="Acme Advisory"
                          value={signupOrganizationName}
                          onChange={(e) => setSignupOrganizationName(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                          This is a profile display name only and does not change your client company records.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="signup-thank-you-mode">
                        Thank-you note signoff
                      </Label>
                      <Select
                        value={signupShowThankYouSignoff ? "yes" : "no"}
                        onValueChange={(value) =>
                          setSignupShowThankYouSignoff(value === "yes")
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger id="signup-thank-you-mode">
                          <SelectValue placeholder="Choose yes or no" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {signupShowThankYouSignoff
                          ? signupAccountType === "individual"
                            ? "Responders will see your personal profile name on the thank-you page."
                            : "Responders will see the organization name saved in your profile on the thank-you page."
                          : "The thank-you page will not show your personal or organization signoff name."}
                      </p>
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
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            New user accounts require role assignment by an admin.
          </p>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Connected Supabase: {supabaseHost}
          </p>
        </div>
      </div>
    </div>
  );
}
