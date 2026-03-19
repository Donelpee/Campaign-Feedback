import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, AdminPermission } from "@/hooks/usePermissions";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Building2,
  Calendar,
  Link2,
  FileText,
  LogOut,
  Settings,
  Users,
  Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
// import { DraftsManager } from "./campaign-wizard/DraftsManager";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  permission: AdminPermission;
}

const menuItems: MenuItem[] = [
  { title: "Overview", url: "/admin", icon: BarChart3, permission: "overview" },
  {
    title: "Companies",
    url: "/admin/companies",
    icon: Building2,
    permission: "companies",
  },
  {
    title: "Campaigns",
    url: "/admin/campaigns",
    icon: Calendar,
    permission: "campaigns",
  },
  { title: "Links", url: "/admin/links", icon: Link2, permission: "links" },
  {
    title: "Responses",
    url: "/admin/responses",
    icon: FileText,
    permission: "responses",
  },
  {
    title: "Notifications",
    url: "/admin/notifications",
    icon: Bell,
    permission: "responses",
  },
];

const managementItems: MenuItem[] = [
  {
    title: "Admin/Users",
    url: "/admin/users",
    icon: Users,
    permission: "users",
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    permission: "settings",
  },
];

import type { WizardData } from "./campaign-wizard/CampaignWizard";
export function AdminSidebar({
  onResumeDraft,
}: {
  onResumeDraft?: (draft: WizardData) => void;
}) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const visibleMenu = menuItems.filter((item) =>
    hasPermission(item.permission),
  );
  const visibleManagement = managementItems.filter((item) =>
    hasPermission(item.permission),
  );
  const visibleNavigation = [...visibleMenu, ...visibleManagement];

  useEffect(() => {
    if (!user?.id) return;

    const applyAppearance = (darkMode: boolean, colorTheme: string) => {
      const root = document.documentElement;
      root.classList.remove("admin-mode-dark", "admin-palette-ocean", "admin-palette-meadow");
      if (darkMode) root.classList.add("admin-mode-dark");
      root.classList.add(
        colorTheme === "meadow" ? "admin-palette-meadow" : "admin-palette-ocean",
      );
    };

    const loadAppearance = async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("dark_mode_enabled, color_theme")
        .eq("user_id", user.id)
        .maybeSingle();

      applyAppearance(
        data?.dark_mode_enabled ?? false,
        data?.color_theme || "ocean",
      );
    };

    loadAppearance();

    const appearanceChannel = supabase
      .channel(`user-settings-appearance-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_settings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            dark_mode_enabled?: boolean;
            color_theme?: string;
          };
          applyAppearance(
            row.dark_mode_enabled ?? false,
            row.color_theme || "ocean",
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appearanceChannel);
    };
  }, [user?.id]);

  void onResumeDraft;

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="[&_[data-sidebar=sidebar]]:bg-[linear-gradient(180deg,#1e3a50_0%,#1a3245_48%,#162c3e_100%)] [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-r-[#2b4860] [&_[data-sidebar=sidebar]]:rounded-none [&_[data-sidebar=sidebar]]:shadow-none"
    >
      <SidebarHeader className="border-b border-[#2b4860]">
        <div className="flex items-center gap-3 px-3 py-5">
          <div className="rounded-xl bg-white/12 p-2.5 shadow-inner">
            <BarChart3 className="h-6 w-6 text-[#9fe8ff]" />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight text-white">
              FeedbackHub
            </h1>
            <p className="text-xs text-[#cde9f6]/80">
              Easy Admin Console
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-1">
        {visibleNavigation.length > 0 && (
          <SidebarGroup className="pb-1">
            <SidebarGroupLabel className="uppercase tracking-wide">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNavigation.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      variant="default"
                      size="lg"
                      className="rounded-xl bg-transparent text-[#e7f5ff] hover:bg-white/12 data-[active=true]:bg-[#4fc1d8]/25 data-[active=true]:text-white data-[active=true]:shadow-[inset_0_0_0_1px_rgba(159,232,255,0.45)]"
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-[#2b4860]">
        <div className="px-2 py-4 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-3">
            <div className="w-8 h-8 rounded-full bg-white/20 ring-1 ring-white/25 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.email}
              </p>
              <Badge
                variant={isSuperAdmin ? "default" : "secondary"}
                className="text-[10px] mt-0.5 bg-white/18 text-white border-white/25"
              >
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </Badge>
            </div>
          </div>
          <Button
            className="w-full justify-start rounded-xl bg-white/14 text-white hover:bg-white/22 border border-white/25"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
