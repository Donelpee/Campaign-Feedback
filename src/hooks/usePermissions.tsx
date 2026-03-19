import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AdminPermission =
  | "overview"
  | "companies"
  | "campaigns"
  | "links"
  | "responses"
  | "users"
  | "settings"
  | string;

export const ALL_PERMISSIONS: AdminPermission[] = [
  "overview",
  "companies",
  "campaigns",
  "links",
  "responses",
  "users",
  "settings",
];

export const PERMISSION_LABELS: Record<string, string> = {
  overview: "Dashboard Overview",
  companies: "Companies",
  campaigns: "Campaigns",
  links: "Links",
  responses: "Responses",
  users: "Admin/Users",
  settings: "Settings",
};

export function usePermissions() {
  const { user, bypassAuth, isLoading: isAuthLoading } = useAuth();

  const { data: userRole, isLoading: isRoleLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "super_admin"]);
      if (data && data.length > 0) {
        // Return highest role
        return data.some((r) => r.role === "super_admin")
          ? "super_admin"
          : "admin";
      }
      return null;
    },
    enabled: !!user?.id && !bypassAuth,
  });

  const isSuperAdmin = bypassAuth || userRole === "super_admin";
  const isAdminRole = userRole === "admin" || userRole === "super_admin";

  const { data: permissions = [], isLoading: isPermissionsLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (bypassAuth) return ALL_PERMISSIONS;
      if (!user?.id) return [];
      // Super admins have all permissions
      if (isSuperAdmin) return ALL_PERMISSIONS;

      const { data, error } = await supabase
        .from("user_module_permissions")
        .select("module_key")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching permissions:", error);
        return [];
      }
      return (data || []).map((d) => d.module_key as AdminPermission);
    },
    enabled: !!user?.id && !bypassAuth && (isAdminRole || isSuperAdmin),
  });

  const hasPermission = (permission: AdminPermission): boolean => {
    if (bypassAuth) return true;
    if (isSuperAdmin) return true;
    return permissions.includes(permission);
  };

  return {
    permissions: bypassAuth ? ALL_PERMISSIONS : permissions,
    hasPermission,
    isSuperAdmin,
    isLoading: bypassAuth
      ? false
      : isAuthLoading || isRoleLoading || (isAdminRole && isPermissionsLoading),
  };
}
