import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, KeyRound, Bell, Palette } from "lucide-react";
import type {
  ProfileAccountType,
  RespondentNamePreference,
} from "@/lib/supabase-types";

type CreationMode =
  | "guided_buddy";

export function SettingsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [accountType, setAccountType] =
    useState<ProfileAccountType>("organization");
  const [respondentNamePreference, setRespondentNamePreference] =
    useState<RespondentNamePreference>("organization_name");
  const [inAppCampaignNotifications, setInAppCampaignNotifications] =
    useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [colorTheme, setColorTheme] = useState<"ocean" | "meadow">("ocean");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [showResponseTimestamps, setShowResponseTimestamps] = useState(true);
  const [defaultCreationMode, setDefaultCreationMode] =
    useState<CreationMode>("guided_buddy");

  const applyAppearance = useCallback(
    (darkMode: boolean, theme: "ocean" | "meadow") => {
      const root = document.documentElement;
      root.classList.remove(
        "admin-mode-dark",
        "admin-palette-ocean",
        "admin-palette-meadow",
      );
      if (darkMode) root.classList.add("admin-mode-dark");
      root.classList.add(
        theme === "meadow" ? "admin-palette-meadow" : "admin-palette-ocean",
      );
    },
    [],
  );

  const persistAppearance = useCallback(
    async (darkMode: boolean, theme: "ocean" | "meadow") => {
      if (!user?.id) return;
      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          dark_mode_enabled: darkMode,
          color_theme: theme,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        toast({
          title: "Error",
          description: "Failed to apply appearance settings.",
          variant: "destructive",
        });
      }
    },
    [toast, user?.id],
  );

  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingSettings(false);
      return;
    }

    setIsLoadingSettings(true);
    try {
      const [settingsRes, profileRes] = await Promise.all([
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("username, full_name, organization_name, account_type, respondent_name_preference")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (profileRes.error) throw profileRes.error;
      setUsername(profileRes.data?.username || "");
      setFullName(profileRes.data?.full_name || "");
      setOrganizationName(profileRes.data?.organization_name || "");
      setAccountType(
        (profileRes.data?.account_type as ProfileAccountType) || "organization",
      );
      setRespondentNamePreference(
        (profileRes.data?.respondent_name_preference as RespondentNamePreference) ||
          "organization_name",
      );

      if (settingsRes.data) {
        setInAppCampaignNotifications(
          settingsRes.data.in_app_campaign_notifications ?? true,
        );
        setDarkModeEnabled(settingsRes.data.dark_mode_enabled ?? false);
        setColorTheme((settingsRes.data.color_theme as "ocean" | "meadow") || "ocean");
        setEmailNotifications(settingsRes.data.email_notifications);
        setWeeklySummary(settingsRes.data.weekly_summary);
        setCompactView(settingsRes.data.compact_view);
        setShowResponseTimestamps(settingsRes.data.show_response_timestamps);
        setDefaultCreationMode("guided_buddy");
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSettings(false);
    }
  }, [toast, user?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    applyAppearance(darkModeEnabled, colorTheme);
  }, [applyAppearance, colorTheme, darkModeEnabled]);

  const saveSettings = async () => {
    if (!user?.id) return;

    const normalizedFullName = fullName.trim();
    const normalizedOrganizationName = organizationName.trim();
    const normalizedPreference =
      accountType === "individual" ? "individual_name" : respondentNamePreference;

    if (normalizedFullName.length < 2) {
      toast({
        title: "Full name required",
        description: "Please provide the name to use in your profile and thank-you note.",
        variant: "destructive",
      });
      return;
    }

    if (accountType === "organization" && normalizedOrganizationName.length < 2) {
      toast({
        title: "Organization name required",
        description: "Please provide the profile organization name you want responders to see.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingSettings(true);
    try {
      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          in_app_campaign_notifications: inAppCampaignNotifications,
          dark_mode_enabled: darkModeEnabled,
          color_theme: colorTheme,
          email_notifications: emailNotifications,
          weekly_summary: weeklySummary,
          compact_view: compactView,
          show_response_timestamps: showResponseTimestamps,
          default_creation_mode: defaultCreationMode,
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      const normalizedUsername = username.trim();
      const profileUpdates: {
        full_name: string | null;
        organization_name: string | null;
        account_type: ProfileAccountType;
        respondent_name_preference: RespondentNamePreference;
        username?: string;
      } = {
        full_name: normalizedFullName,
        organization_name:
          accountType === "organization" ? normalizedOrganizationName : null,
        account_type: accountType,
        respondent_name_preference: normalizedPreference,
      };

      if (normalizedUsername.length > 0) {
        profileUpdates.username = normalizedUsername;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      toast({ title: "Settings saved" });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsChangingPassword(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Password updated successfully" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleDarkModeChange = (nextValue: boolean) => {
    setDarkModeEnabled(nextValue);
    void persistAppearance(nextValue, colorTheme);
  };

  const handleColorThemeChange = (nextTheme: "ocean" | "meadow") => {
    setColorTheme(nextTheme);
    void persistAppearance(darkModeEnabled, nextTheme);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="glass-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Settings</h1>
      </header>
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1100px] space-y-6 p-3 sm:p-4 md:p-8">
      <div className="easy-form-shell">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences in one simple place.
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Account
          </CardTitle>
          <CardDescription>Your account details and security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              disabled={isLoadingSettings || isSavingSettings}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your.username"
              disabled={isLoadingSettings || isSavingSettings}
            />
          </div>
          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select
              value={accountType}
              onValueChange={(value: ProfileAccountType) => {
                setAccountType(value);
                if (value === "individual") {
                  setRespondentNamePreference("individual_name");
                }
              }}
              disabled={isLoadingSettings || isSavingSettings}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Organization profiles can show either the linked company name or your personal name
              in the responder thank-you note.
            </p>
          </div>
          {accountType === "organization" && (
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Advisory"
                disabled={isLoadingSettings || isSavingSettings}
              />
              <p className="text-xs text-muted-foreground">
                This is a profile/display name only. It does not rename your client companies or campaigns.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Thank-You Note Signoff</Label>
            <Select
              value={
                accountType === "individual"
                  ? "individual_name"
                  : respondentNamePreference
              }
              onValueChange={(value: RespondentNamePreference) =>
                setRespondentNamePreference(value)
              }
              disabled={isLoadingSettings || isSavingSettings || accountType === "individual"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose signoff style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization_name">Organization name</SelectItem>
                <SelectItem value="individual_name">Individual name</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {accountType === "individual"
                ? "Individual accounts always use your personal profile name."
                : "Organization name uses the organization name saved in your profile on the published feedback form."}
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Change Password</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="********"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="********"
                />
              </div>
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword}
            >
              {isChangingPassword ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="easy-field-row">
            <div>
              <p className="text-sm font-medium">In-app response alerts</p>
              <p className="text-xs text-muted-foreground">
                Show an admin alert when a campaign form is submitted
              </p>
            </div>
            <Switch
              checked={inAppCampaignNotifications}
              onCheckedChange={setInAppCampaignNotifications}
              disabled={isLoadingSettings || isSavingSettings}
            />
          </div>
          <Separator />
          <div className="easy-field-row">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">
                Receive email when new feedback is submitted
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              disabled={isLoadingSettings || isSavingSettings}
            />
          </div>
          <Separator />
          <div className="easy-field-row">
            <div>
              <p className="text-sm font-medium">Weekly summary</p>
              <p className="text-xs text-muted-foreground">
                Get a weekly digest of feedback activity
              </p>
            </div>
            <Switch
              checked={weeklySummary}
              onCheckedChange={setWeeklySummary}
              disabled={isLoadingSettings || isSavingSettings}
            />
          </div>
        </CardContent>
      </Card>

      {/* App Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" /> Preferences
          </CardTitle>
          <CardDescription>Application display settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="easy-field-row">
            <div>
              <p className="text-sm font-medium">Dark mode</p>
              <p className="text-xs text-muted-foreground">
                Softer low-light experience with accessible contrast
              </p>
            </div>
            <Switch
              checked={darkModeEnabled}
              onCheckedChange={handleDarkModeChange}
              disabled={isLoadingSettings || isSavingSettings}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Color theme</p>
            <p className="text-xs text-muted-foreground">
              Choose the color palette that feels most comfortable.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={colorTheme === "ocean" ? "default" : "outline"}
                onClick={() => handleColorThemeChange("ocean")}
                disabled={isLoadingSettings || isSavingSettings}
                className="justify-start"
              >
                Ocean Calm
              </Button>
              <Button
                type="button"
                variant={colorTheme === "meadow" ? "default" : "outline"}
                onClick={() => handleColorThemeChange("meadow")}
                disabled={isLoadingSettings || isSavingSettings}
                className="justify-start"
              >
                Meadow Soft
              </Button>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
              <p className="text-sm font-medium">Default campaign creation mode</p>
              <p className="text-xs text-muted-foreground">
                Brady Guide is currently the only available creation mode for new campaigns.
              </p>
            <div className="grid gap-2 sm:max-w-sm">
              <Button
                type="button"
                variant={
                  defaultCreationMode === "guided_buddy" ? "default" : "outline"
                }
                onClick={() => setDefaultCreationMode("guided_buddy")}
                disabled={isLoadingSettings || isSavingSettings}
                className="justify-start"
              >
                Brady Guide
                </Button>
              </div>
          </div>
          <Separator />
          <div className="easy-field-row">
            <div>
              <p className="text-sm font-medium">Compact view</p>
              <p className="text-xs text-muted-foreground">
                Use a denser layout in tables and lists
              </p>
            </div>
            <Switch
              checked={compactView}
              onCheckedChange={setCompactView}
              disabled={isLoadingSettings || isSavingSettings}
            />
          </div>
          <Separator />
          <div className="easy-field-row">
            <div>
              <p className="text-sm font-medium">Show response timestamps</p>
              <p className="text-xs text-muted-foreground">
                Display exact times on feedback entries
              </p>
            </div>
            <Switch
              checked={showResponseTimestamps}
              onCheckedChange={setShowResponseTimestamps}
              disabled={isLoadingSettings || isSavingSettings}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-stretch sm:justify-end">
        <Button
          className="w-full sm:w-auto"
          onClick={saveSettings}
          disabled={isSavingSettings || isLoadingSettings || !user?.id}
        >
          {isSavingSettings ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Preferences
        </Button>
      </div>
      </div>
      </main>
    </div>
  );
}
