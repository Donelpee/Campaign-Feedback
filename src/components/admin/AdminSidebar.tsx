import { Link, useLocation } from "react-router-dom";
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
import {
  BarChart3,
  Building2,
  Calendar,
  Link2,
  FileText,
  LogOut,
  Settings,
  Users,
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
];

const managementItems: MenuItem[] = [
  {
    title: "Admin Users",
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

  void onResumeDraft;

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="[&_[data-sidebar=sidebar]]:bg-[#1f252d] [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-r-[#2e3742] [&_[data-sidebar=sidebar]]:rounded-none [&_[data-sidebar=sidebar]]:shadow-none"
    >
      <SidebarHeader className="border-b border-[#2e3742]">
        <div className="flex items-center gap-3 px-3 py-5">
          <div className="rounded-lg bg-white/10 p-2">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight text-white">
              FeedbackHub
            </h1>
            <p className="text-xs text-white/65">
              Intelligence Console
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
                      className="rounded-md bg-transparent text-white/90 hover:bg-white/10 data-[active=true]:bg-white/14 data-[active=true]:text-white"
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

      <SidebarFooter className="border-t border-[#2e3742]">
        <div className="px-2 py-4 space-y-3">
          <div className="flex items-center gap-3 rounded-md border border-white/15 bg-white/5 p-3">
            <div className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
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
                className="text-[10px] mt-0.5 bg-white/15 text-white border-white/20"
              >
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </Badge>
            </div>
          </div>
          <Button
            className="w-full justify-start rounded-md bg-white/12 text-white hover:bg-white/18 border border-white/20"
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
