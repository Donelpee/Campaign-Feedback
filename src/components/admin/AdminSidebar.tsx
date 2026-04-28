import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, AdminPermission } from "@/hooks/usePermissions";
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
import { Badge } from "@/components/ui/badge";
import { NkowaLogo } from "@/components/branding/NkowaLogo";
import {
  BarChart3,
  Building2,
  Calendar,
  Link2,
  FileText,
  ScrollText,
  Activity,
  LogOut,
  Settings,
  Users,
  Bell,
} from "lucide-react";
import type { WizardData } from "./campaign-wizard/CampaignWizard";

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
    title: "Audit Log",
    url: "/admin/audit-logs",
    icon: ScrollText,
    permission: "audit_logs",
  },
  {
    title: "Notifications",
    url: "/admin/notifications",
    icon: Bell,
    permission: "responses",
  },
  {
    title: "Monitoring",
    url: "/admin/monitoring",
    icon: Activity,
    permission: "audit_logs",
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

export function AdminSidebar({
  onResumeDraft,
}: {
  onResumeDraft?: (draft: WizardData) => void;
}) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canAccessResponses = hasPermission("responses") || hasPermission("campaigns");

  const visibleMenu = menuItems.filter((item) => {
    if (item.url === "/admin/responses") {
      return canAccessResponses;
    }
    return hasPermission(item.permission);
  });
  const visibleManagement = managementItems.filter((item) =>
    hasPermission(item.permission),
  );
  const visibleNavigation = [...visibleMenu, ...visibleManagement];

  useEffect(() => {
    if (!user?.id) return;

    const applyAppearance = (darkMode: boolean, colorTheme: string) => {
      const root = document.documentElement;
      root.classList.remove(
        "admin-mode-dark",
        "admin-palette-ocean",
        "admin-palette-meadow",
      );
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
      <SidebarHeader className="border-b border-[#2b4860] bg-[radial-gradient(circle_at_top,rgba(100,184,218,0.2),transparent_58%),linear-gradient(180deg,rgba(35,71,95,0.94)_0%,rgba(28,57,77,0.98)_100%)]">
        <div className="flex items-center justify-center px-2 py-3.5">
          <NkowaLogo
            align="center"
            className="w-full max-w-[260px]"
            showTagline
            size="lg"
            taglineVariant="prominent"
            theme="dark"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-0.5">
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
                      size="default"
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
        <div className="space-y-2 px-2 py-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/25">
              <span className="text-sm font-medium text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.email}
              </p>
              <Badge
                variant={isSuperAdmin ? "default" : "secondary"}
                className="mt-0.5 border-white/25 bg-white/18 text-[10px] text-white"
              >
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </Badge>
            </div>
          </div>
          <Button
            className="w-full justify-start rounded-xl border border-white/25 bg-white/14 text-white hover:bg-white/22"
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
