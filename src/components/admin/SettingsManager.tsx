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

export function SettingsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [showResponseTimestamps, setShowResponseTimestamps] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingSettings(false);
      return;
    }

    setIsLoadingSettings(true);
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select(
          "email_notifications, weekly_summary, compact_view, show_response_timestamps",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEmailNotifications(data.email_notifications);
        setWeeklySummary(data.weekly_summary);
        setCompactView(data.compact_view);
        setShowResponseTimestamps(data.show_response_timestamps);
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
          email_notifications: emailNotifications,
          weekly_summary: weeklySummary,
          compact_view: compactView,
          show_response_timestamps: showResponseTimestamps,
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
    <div className="mx-auto w-full max-w-[1100px] p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and application preferences
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
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
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
          <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-between">
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

      <div className="flex justify-end">
        <Button
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
