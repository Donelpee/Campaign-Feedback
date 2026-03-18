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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, KeyRound, Bell, Palette } from "lucide-react";

type CreationMode =
  | "guided_buddy"
  | "quick_start"
  | "template_story"
  | "conversation_builder";

export function SettingsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingSettings(false);
      return;
    }

    setIsLoadingSettings(true);
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setInAppCampaignNotifications(data.in_app_campaign_notifications ?? true);
        setDarkModeEnabled(data.dark_mode_enabled ?? false);
        setColorTheme((data.color_theme as "ocean" | "meadow") || "ocean");
        setEmailNotifications(data.email_notifications);
        setWeeklySummary(data.weekly_summary);
        setCompactView(data.compact_view);
        setShowResponseTimestamps(data.show_response_timestamps);
        setDefaultCreationMode(
          (data.default_creation_mode as CreationMode) || "guided_buddy",
        );
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

  const saveSettings = async () => {
    if (!user?.id) return;

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

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 p-3 sm:p-4 md:p-8">
      <div className="easy-form-shell">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Settings</h1>
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
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
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
              onCheckedChange={setDarkModeEnabled}
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
                onClick={() => setColorTheme("ocean")}
                disabled={isLoadingSettings || isSavingSettings}
                className="justify-start"
              >
                Ocean Calm
              </Button>
              <Button
                type="button"
                variant={colorTheme === "meadow" ? "default" : "outline"}
                onClick={() => setColorTheme("meadow")}
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
              New campaigns will open with this mode automatically.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={
                  defaultCreationMode === "guided_buddy" ? "default" : "outline"
                }
                onClick={() => setDefaultCreationMode("guided_buddy")}
                disabled={isLoadingSettings || isSavingSettings}
                className="justify-start"
              >
                Guided Buddy
              </Button>
              <Button
                type="button"
                variant={
                  defaultCreationMode === "quick_start" ? "default" : "outline"
                }
                onClick={() => setDefaultCreationMode("quick_start")}
                disabled={isLoadingSettings || isSavingSettings}
                className="justify-start"
              >
                Quick Start
              </Button>
              <Button
                type="button"
                variant={
                  defaultCreationMode === "template_story"
                    ? "default"
                    : "outline"
                }
                onClick={() => setDefaultCreationMode("template_story")}
                disabled={isLoadingSettings || isSavingSettings}
                className="justify-start"
              >
                Template Story
              </Button>
              <Button
                type="button"
                variant={
                  defaultCreationMode === "conversation_builder"
                    ? "default"
                    : "outline"
                }
                onClick={() => setDefaultCreationMode("conversation_builder")}
                disabled={isLoadingSettings || isSavingSettings}
                className="justify-start"
              >
                Conversation Builder
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
  );
}
