import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Trash2,
  Shield,
  ShieldCheck,
  Loader2,
  Pencil,
} from "lucide-react";
import { EditUserDialog } from "./EditUserDialog";
import type { AppRole } from "@/lib/supabase-types";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type AdminPermission,
} from "@/hooks/usePermissions";
import { Checkbox } from "@/components/ui/checkbox";

interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  roleId?: string | null;
  hasRole: boolean;
  created_at: string;
  profile?: {
    email: string;
    full_name: string | null;
  };
  permissionCount?: number;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface ModuleOption {
  module_key: string;
  module_name: string;
}

interface RoleOption {
  role_key: string;
  role_name: string;
  is_system: boolean;
}

export function AdminUsersManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isSuperAdmin, hasPermission } = usePermissions();
  const { data: currentUserRole } = useQuery({
    queryKey: ["current-user-admin-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null as AppRole | null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "super_admin"])
        .maybeSingle();
      if (error) throw error;
      return (data?.role as AppRole | undefined) || null;
    },
    enabled: Boolean(user?.id),
  });
  const canManageUsers = Boolean(currentUserRole) && hasPermission("users");
  const [creationMethod, setCreationMethod] = useState<"invite" | "credentials">(
    "invite",
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("admin");
  const [newPermissions, setNewPermissions] = useState<AdminPermission[]>([
    "overview",
    "campaigns",
    "responses",
  ]);
  const [newCompanyIds, setNewCompanyIds] = useState<string[]>([]);
  const [editUser, setEditUser] = useState<UserRoleRow | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newModuleName, setNewModuleName] = useState("");
  const [manageRoleKey, setManageRoleKey] = useState<string>("");
  const [managedRoleModules, setManagedRoleModules] = useState<AdminPermission[]>(
    [],
  );

  const invokeFunction = async (
    functionName: string,
    body: Record<string, unknown>,
    attempt = 0,
  ) => {
    const { error } = await supabase.functions.invoke(functionName, {
      body,
    });
    if (!error) return null;

    const withContext = error as { context?: Response };
    const status = withContext.context?.status;
    let message = error.message || "Request failed";

    if (withContext.context) {
      try {
        const raw = await withContext.context.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as {
              error?: string;
              details?: string;
              message?: string;
            };
            message =
              parsed.details || parsed.error || parsed.message || raw || message;
          } catch {
            message = raw;
          }
        }
      } catch {
        // Keep fallback message
      }
    }

    if (status === 401 && /invalid jwt/i.test(message) && attempt < 1) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) {
        return invokeFunction(functionName, body, attempt + 1);
      }
    }

    throw new Error(status ? `${message} (status ${status})` : message);
  };

  const toggleNewPermission = (permission: AdminPermission) => {
    setNewPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((entry) => entry !== permission)
        : [...prev, permission],
    );
  };

  const toggleNewCompany = (companyId: string) => {
    setNewCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((entry) => entry !== companyId)
        : [...prev, companyId],
    );
  };

  const { data: companyOptions = [] } = useQuery({
    queryKey: ["company-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as CompanyOption[];
    },
    enabled: isAddOpen,
  });

  const { data: moduleOptions = [] } = useQuery({
    queryKey: ["module-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_modules")
        .select("module_key,module_name")
        .order("module_name", { ascending: true });
      if (error) throw error;
      return (data || []) as ModuleOption[];
    },
    enabled: canManageUsers,
  });

  const { data: roleOptions = [] } = useQuery({
    queryKey: ["role-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_roles")
        .select("role_key,role_name,is_system")
        .order("role_name", { ascending: true });
      if (error) throw error;
      return (data || []) as RoleOption[];
    },
    enabled: canManageUsers,
  });

  const { data: selectedRoleModules = [] } = useQuery({
    queryKey: ["role-module-permissions", newRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_module_permissions")
        .select("module_key")
        .eq("role_key", newRole);
      if (error) throw error;
      return (data || []).map((row) => row.module_key as AdminPermission);
    },
    enabled: canManageUsers && Boolean(newRole),
  });

  const { data: manageRoleModules = [] } = useQuery({
    queryKey: ["role-module-permissions-manage", manageRoleKey],
    queryFn: async () => {
      if (!manageRoleKey) return [] as AdminPermission[];
      const { data, error } = await supabase
        .from("role_module_permissions")
        .select("module_key")
        .eq("role_key", manageRoleKey);
      if (error) throw error;
      return (data || []).map((row) => row.module_key as AdminPermission);
    },
    enabled: canManageUsers && Boolean(manageRoleKey),
  });

  useEffect(() => {
    if (!newRole || newRole === "super_admin") return;
    if (selectedRoleModules.length > 0) {
      setNewPermissions(selectedRoleModules);
    }
  }, [newRole, selectedRoleModules]);

  useEffect(() => {
    if (!manageRoleKey) return;
    setManagedRoleModules(manageRoleModules);
  }, [manageRoleKey, manageRoleModules]);

  useEffect(() => {
    if (!manageRoleKey && roleOptions.length > 0) {
      const firstNonSuperRole =
        roleOptions.find((r) => r.role_key !== "super_admin")?.role_key ||
        roleOptions[0].role_key;
      setManageRoleKey(firstNonSuperRole);
    }
  }, [manageRoleKey, roleOptions]);

  const requiresCompanySelection =
    newRole !== "super_admin" &&
    companyOptions.length > 0 &&
    newCompanyIds.length === 0;

  const { data: adminUsers, isLoading } = useQuery({
    queryKey: ["admin-users", user?.id, canManageUsers],
    queryFn: async () => {
      if (!user?.id) return [] as UserRoleRow[];

      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const profilesQuery = supabase
        .from("profiles")
        .select("user_id, email, full_name, created_at")
        .order("created_at", { ascending: false });
      const { data: profiles, error: profilesError } = canManageUsers
        ? await profilesQuery
        : await profilesQuery.eq("user_id", user.id);
      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [] as UserRoleRow[];

      const userIds = profiles.map((p) => p.user_id);
      const permsRes = await supabase
        .from("user_module_permissions")
        .select("user_id, module_key")
        .in("user_id", userIds);

      const profilesRes = { data: profiles, error: null as null };
      if (profilesRes.error) throw profilesRes.error;
      if (permsRes.error) throw permsRes.error;

      const pickRole = (userId: string) => {
        const userRoles = (roles || []).filter((r) => r.user_id === userId);
        if (userRoles.length === 0) return null;
        return (
          userRoles.find((r) => r.role === "super_admin") ||
          userRoles.find((r) => r.role === "admin") ||
          userRoles[0]
        );
      };

      return profiles.map((profile) => {
        const matchedRole = pickRole(profile.user_id);
        return {
          id: matchedRole?.id || `profile-${profile.user_id}`,
          roleId: matchedRole?.id || null,
          user_id: profile.user_id,
          role: matchedRole?.role || "no_role",
          hasRole: Boolean(matchedRole),
          created_at: matchedRole?.created_at || profile.created_at,
          profile,
          permissionCount:
            permsRes.data?.filter((p) => p.user_id === profile.user_id).length || 0,
        };
      }) as UserRoleRow[];
    },
    enabled: Boolean(user?.id),
  });

  const addUserRole = useMutation({
    mutationFn: async ({
      method,
      email,
      username,
      password,
      role,
      permissions,
      companyIds,
    }: {
      method: "invite" | "credentials";
      email: string;
      username?: string;
      password?: string;
      role: AppRole;
      permissions: AdminPermission[];
      companyIds: string[];
    }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedUsername = String(username || "").trim();

      if (role === "super_admin" && !isSuperAdmin) {
        throw new Error("Only Super Admin can assign Super Admin role.");
      }

      const assignAccessToExistingProfile = async (targetUserId: string) => {
        const { data: existingRoles, error: existingRolesError } = await supabase
          .from("user_roles")
          .select("id, role")
          .eq("user_id", targetUserId)
          .returns<Array<{ id: string; role: AppRole }>>();
        if (existingRolesError) throw existingRolesError;

        // Keep idempotent behavior for already-managed users.
        if ((existingRoles || []).length > 0) {
          return {
            invited: false as const,
            created: false as const,
            existed: true as const,
            assigned: false as const,
          };
        }

        const { error: insertRoleError } = await supabase
          .from("user_roles")
          .insert({ user_id: targetUserId, role });
        if (insertRoleError) throw insertRoleError;

        const { error: clearPermsError } = await supabase
          .from("user_module_permissions")
          .delete()
          .eq("user_id", targetUserId);
        if (clearPermsError) throw clearPermsError;

        if (role !== "super_admin" && permissions.length > 0) {
          const { error: insertPermsError } = await supabase
            .from("user_module_permissions")
            .insert(
              permissions.map((permission) => ({
                user_id: targetUserId,
                module_key: permission,
              })),
            );
          if (insertPermsError) throw insertPermsError;
        }

        const { error: clearCompanyPermsError } = await supabase
          .from("user_company_permissions")
          .delete()
          .eq("user_id", targetUserId);
        if (clearCompanyPermsError) throw clearCompanyPermsError;

        if (role !== "super_admin" && companyIds.length > 0) {
          const { error: insertCompanyPermsError } = await supabase
            .from("user_company_permissions")
            .insert(
              companyIds.map((companyId) => ({
                user_id: targetUserId,
                company_id: companyId,
              })),
            );
          if (insertCompanyPermsError) throw insertCompanyPermsError;
        }

        return {
          invited: false as const,
          created: false as const,
          existed: false as const,
          assigned: true as const,
        };
      };

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (profileError) throw profileError;

      if (profile) {
        return assignAccessToExistingProfile(profile.user_id);
      }

      if (method === "credentials" && !profile) {
        if (!normalizedUsername || String(password || "").trim().length < 6) {
          throw new Error("Username and password (min 6 characters) are required.");
        }
        await invokeFunction("create-admin-user", {
          email: normalizedEmail,
          username: normalizedUsername,
          password,
          role,
          permissions,
          companyIds,
        });
        return {
          invited: false as const,
          created: true as const,
          existed: false as const,
          assigned: false as const,
        };
      }

      if (!profile) {
        await invokeFunction("invite-admin-user", {
          email: normalizedEmail,
          role,
          permissions,
          companyIds,
        });
        return {
          invited: true as const,
          created: false as const,
          existed: false as const,
          assigned: false as const,
        };
      }

      return {
        invited: false as const,
        created: false as const,
        existed: false as const,
        assigned: false as const,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (result.assigned) {
        toast({
          title: "Access assigned",
          description: "Role and permissions were assigned to the existing user.",
        });
      } else if (result.existed) {
        toast({
          title: "User already exists",
          description: "No changes were made. You can edit access from the users table.",
        });
      } else if (result.invited) {
        toast({
          title: "Invite sent",
          description:
            "User account invite sent with the selected role and permissions.",
        });
      } else if (result.created) {
        toast({
          title: "User created",
          description: "Login credentials created and access assigned successfully.",
        });
      } else {
        toast({ title: "Admin access updated successfully" });
      }
      setIsAddOpen(false);
      setCreationMethod("invite");
      setNewEmail("");
      setNewUsername("");
      setNewPassword("");
      setNewRole("admin");
      setNewPermissions(["overview", "campaigns", "responses"]);
      setNewCompanyIds([]);
    },
    onError: (error: Error) => {
      if (/already exists/i.test(error.message)) {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeUserRole = useMutation({
    mutationFn: async ({
      roleId,
      userId,
    }: {
      roleId: string;
      userId: string;
    }) => {
      // Also remove permissions
      await supabase
        .from("user_module_permissions")
        .delete()
        .eq("user_id", userId);
      await supabase
        .from("user_company_permissions")
        .delete()
        .eq("user_id", userId);
      if (roleId) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("id", roleId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User removed" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createRole = useMutation({
    mutationFn: async () => {
      const roleKey = newRoleName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (!roleKey) throw new Error("Role name is required.");
      const { error: roleError } = await supabase.from("app_roles").insert({
        role_key: roleKey,
        role_name: newRoleName.trim(),
        is_system: false,
      });
      if (roleError) throw roleError;

      if (newPermissions.length > 0) {
        const { error: permsError } = await supabase
          .from("role_module_permissions")
          .insert(
            newPermissions.map((moduleKey) => ({
              role_key: roleKey,
              module_key: moduleKey,
            })),
          );
        if (permsError) throw permsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-options"] });
      toast({ title: "Role created" });
      setNewRoleName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createModule = useMutation({
    mutationFn: async () => {
      const moduleKey = newModuleName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (!moduleKey) throw new Error("Module name is required.");
      const { error } = await supabase.from("app_modules").insert({
        module_key: moduleKey,
        module_name: newModuleName.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-options"] });
      toast({ title: "Module created" });
      setNewModuleName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleManagedRoleModule = (permission: AdminPermission) => {
    setManagedRoleModules((prev) =>
      prev.includes(permission)
        ? prev.filter((entry) => entry !== permission)
        : [...prev, permission],
    );
  };

  const saveRolePermissions = useMutation({
    mutationFn: async () => {
      if (!manageRoleKey) throw new Error("Select a role first.");
      if (manageRoleKey === "super_admin") {
        throw new Error("Super Admin has full access and cannot be customized.");
      }

      const { error: clearError } = await supabase
        .from("role_module_permissions")
        .delete()
        .eq("role_key", manageRoleKey);
      if (clearError) throw clearError;

      if (managedRoleModules.length > 0) {
        const { error: insertError } = await supabase
          .from("role_module_permissions")
          .insert(
            managedRoleModules.map((moduleKey) => ({
              role_key: manageRoleKey,
              module_key: moduleKey,
            })),
          );
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-module-permissions"] });
      queryClient.invalidateQueries({
        queryKey: ["role-module-permissions-manage", manageRoleKey],
      });
      toast({ title: "Role permissions updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex h-full flex-col">
      <header className="glass-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Users</h1>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-3 sm:p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Users</h2>
          <p className="text-muted-foreground mt-1">
            Manage user access, roles, and permissions
          </p>
        </div>
        {canManageUsers && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <UserPlus className="mr-2 h-4 w-4" /> Add Users
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add User</DialogTitle>
                <DialogDescription>
                  Create a user with credentials or invite by email, then assign access.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Creation Method</Label>
                  <Select
                    value={creationMethod}
                    onValueChange={(value) =>
                      setCreationMethod(value as "invite" | "credentials")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invite">Invite by Email</SelectItem>
                      <SelectItem value="credentials">
                        Create Username + Password
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                {creationMethod === "credentials" && (
                  <>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        placeholder="jane.doe"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Temporary Password</Label>
                      <Input
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={newRole}
                    onValueChange={(v) => setNewRole(v as AppRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(roleOptions.length > 0
                        ? roleOptions
                        : [
                            { role_key: "admin", role_name: "Admin", is_system: true },
                            {
                              role_key: "super_admin",
                              role_name: "Super Admin",
                              is_system: true,
                            },
                          ]
                      ).map((roleOption) => (
                        <SelectItem
                          key={roleOption.role_key}
                          value={roleOption.role_key}
                          disabled={
                            roleOption.role_key === "super_admin" && !isSuperAdmin
                          }
                        >
                          {roleOption.role_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {newRole !== "super_admin" && (
                  <div className="space-y-2">
                    <Label>Module Permissions</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(moduleOptions.length > 0
                        ? moduleOptions.map((m) => m.module_key)
                        : ALL_PERMISSIONS
                      ).map((permission) => (
                        <label
                          key={permission}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={newPermissions.includes(permission)}
                            onCheckedChange={() => toggleNewPermission(permission)}
                          />
                          {moduleOptions.find((m) => m.module_key === permission)
                            ?.module_name || PERMISSION_LABELS[permission] || permission}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {newRole !== "super_admin" && (
                  <div className="space-y-2">
                    <Label>Company Access</Label>
                    <p className="text-xs text-muted-foreground">
                      Choose companies this user can access.
                    </p>
                    {companyOptions.length > 0 && newCompanyIds.length === 0 && (
                      <p className="text-xs text-amber-700">
                        Select at least one company to continue.
                      </p>
                    )}
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                      {companyOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No companies available yet.
                        </p>
                      ) : (
                        companyOptions.map((company) => (
                          <label
                            key={company.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={newCompanyIds.includes(company.id)}
                              onCheckedChange={() => toggleNewCompany(company.id)}
                            />
                            {company.name}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    addUserRole.mutate({
                      method: creationMethod,
                      email: newEmail,
                      username: newUsername,
                      password: newPassword,
                      role: newRole,
                      permissions:
                        newRole === "super_admin"
                          ? []
                          : newPermissions,
                      companyIds:
                        newRole === "super_admin"
                          ? []
                          : newCompanyIds,
                    })
                  }
                  disabled={
                    !newEmail ||
                    addUserRole.isPending ||
                    (creationMethod === "credentials" &&
                      (!newUsername || newPassword.trim().length < 6)) ||
                    (newRole !== "super_admin" && newPermissions.length === 0) ||
                    requiresCompanySelection
                  }
                >
                  {addUserRole.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle>Role & Module Management</CardTitle>
            <CardDescription>
              Create roles and modules. New modules automatically appear in user permission lists.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-4">
              <Label>Create Role</Label>
              <Input
                placeholder="Example: Regional Manager"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
              <Button
                onClick={() => createRole.mutate()}
                disabled={!newRoleName.trim() || createRole.isPending}
              >
                {createRole.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Role
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <Label>Create Module</Label>
              <Input
                placeholder="Example: Billing Reports"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
              />
              <Button
                onClick={() => createModule.mutate()}
                disabled={!newModuleName.trim() || createModule.isPending}
              >
                {createModule.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Module
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle>Role Permission Manager</CardTitle>
            <CardDescription>
              Select a role and manage which modules it can access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm space-y-2">
              <Label>Role</Label>
              <Select value={manageRoleKey} onValueChange={setManageRoleKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((roleOption) => (
                    <SelectItem
                      key={roleOption.role_key}
                      value={roleOption.role_key}
                    >
                      {roleOption.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {(moduleOptions.length > 0
                ? moduleOptions.map((m) => m.module_key)
                : ALL_PERMISSIONS
              ).map((permission) => (
                <label key={permission} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={managedRoleModules.includes(permission)}
                    onCheckedChange={() => toggleManagedRoleModule(permission)}
                    disabled={manageRoleKey === "super_admin"}
                  />
                  {moduleOptions.find((m) => m.module_key === permission)
                    ?.module_name || PERMISSION_LABELS[permission] || permission}
                </label>
              ))}
            </div>

            <Button
              onClick={() => saveRolePermissions.mutate()}
              disabled={
                !manageRoleKey ||
                manageRoleKey === "super_admin" ||
                saveRolePermissions.isPending
              }
            >
              {saveRolePermissions.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Role Permissions
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Users</CardTitle>
          <CardDescription>
            Users with admin access and role assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[130px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers?.map((ur) => (
                  <TableRow key={ur.id}>
                    <TableCell className="font-medium">
                      {ur.profile?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell>{ur.profile?.email || ur.user_id}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ur.role === "super_admin"
                            ? "default"
                            : ur.role === "no_role"
                              ? "outline"
                              : "secondary"
                        }
                        className="gap-1"
                      >
                        {ur.role === "super_admin" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : ur.role === "no_role" ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        {ur.role === "super_admin"
                          ? "Super Admin"
                          : ur.role === "no_role"
                            ? "No Role Assigned"
                          : roleOptions.find((r) => r.role_key === ur.role)?.role_name ||
                            ur.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ur.role === "super_admin" ? (
                        <span className="text-xs text-muted-foreground">
                          All access
                        </span>
                      ) : ur.role === "no_role" ? (
                        <span className="text-xs text-muted-foreground">
                          Not assigned
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {ur.permissionCount || 0} of 7 sections
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(ur.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {canManageUsers ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditUser(ur)}
                            disabled={!isSuperAdmin && ur.role === "super_admin"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              removeUserRole.mutate({
                                roleId: ur.roleId || "",
                                userId: ur.user_id,
                              })
                            }
                            disabled={
                              removeUserRole.isPending ||
                              (!isSuperAdmin && ur.role === "super_admin") ||
                              !ur.hasRole
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button asChild variant="outline" size="sm">
                          <Link to="/admin/settings">Edit Profile</Link>
                        </Button>
                      )}
                    </TableCell>
                </TableRow>
                ))}
                {adminUsers?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      {canManageUsers ? "No users found" : "No profile found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editUser && (
        <EditUserDialog
          open={!!editUser}
          onOpenChange={(open) => {
            if (!open) setEditUser(null);
          }}
          userId={editUser.user_id}
          currentRole={editUser.role === "no_role" ? "admin" : editUser.role}
          roleId={editUser.roleId || ""}
          canGrantSuperAdmin={isSuperAdmin}
          userName={
            editUser.profile?.full_name || editUser.profile?.email || "Unknown"
          }
        />
      )}
      </div>
      </main>
    </div>
  );
}
