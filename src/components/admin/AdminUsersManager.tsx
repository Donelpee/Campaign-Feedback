import { useEffect, useState } from "react";
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

  const invokeFunction = async (
    functionName: string,
    body: Record<string, unknown>,
    attempt = 0,
  ) => {
    const { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData.session;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const isExpiredOrNearExpiry =
      !session?.access_token ||
      !session.expires_at ||
      session.expires_at <= nowSeconds + 30;

    if (isExpiredOrNearExpiry) {
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error("Session expired. Please sign in again.");
      }
      session = refreshData.session;
    }

    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("You are not authenticated.");

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const raw = await response.text();
    let parsed: { error?: string; details?: string; message?: string } | null =
      null;
    if (raw) {
      try {
        parsed = JSON.parse(raw) as {
          error?: string;
          details?: string;
          message?: string;
        };
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      const message =
        parsed?.error ||
        parsed?.details ||
        parsed?.message ||
        raw ||
        `Request failed with status ${response.status}`;

      if (
        response.status === 401 &&
        /invalid jwt/i.test(message) &&
        attempt < 1
      ) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          return invokeFunction(functionName, body, attempt + 1);
        }
      }

      throw new Error(`${message} (status ${response.status})`);
    }

    return parsed;
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

  useEffect(() => {
    if (!newRole || newRole === "super_admin") return;
    if (selectedRoleModules.length > 0) {
      setNewPermissions(selectedRoleModules);
    }
  }, [newRole, selectedRoleModules]);

  const requiresCompanySelection =
    newRole !== "super_admin" &&
    companyOptions.length > 0 &&
    newCompanyIds.length === 0;

  const { data: adminUsers, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!roles || roles.length === 0) return [] as UserRoleRow[];

      const userIds = roles.map((r) => r.user_id);
      const [profilesRes, permsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds),
        supabase
          .from("user_module_permissions")
          .select("user_id, module_key")
          .in("user_id", userIds),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (permsRes.error) throw permsRes.error;

      return roles.map((role) => ({
        ...role,
        profile: profilesRes.data?.find((p) => p.user_id === role.user_id),
        permissionCount:
          permsRes.data?.filter((p) => p.user_id === role.user_id).length || 0,
      })) as UserRoleRow[];
    },
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

      if (method === "credentials") {
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
        return { invited: false as const, created: true as const };
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        await invokeFunction("invite-admin-user", {
          email: normalizedEmail,
          role,
          permissions,
          companyIds,
        });
        return { invited: true as const, created: false as const };
      }

      const { data: existingRoles, error: existingError } = await supabase
        .from("user_roles")
        .select("id, role")
        .eq("user_id", profile.user_id)
        .returns<Array<{ id: string; role: AppRole }>>();
      if (existingError) throw existingError;

      if ((existingRoles || []).length > 0) {
        if (!isSuperAdmin && existingRoles.some((entry) => entry.role === "super_admin")) {
          throw new Error("Only Super Admin can modify Super Admin accounts.");
        }
        const { error: clearRolesError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", profile.user_id);
        if (clearRolesError) throw clearRolesError;
      }

      const { error: insertRoleError } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.user_id, role });
      if (insertRoleError) throw insertRoleError;

      const { error: clearPermsError } = await supabase
        .from("user_module_permissions")
        .delete()
        .eq("user_id", profile.user_id);
      if (clearPermsError) throw clearPermsError;

      if (role !== "super_admin" && permissions.length > 0) {
        const { error: insertPermsError } = await supabase
          .from("user_module_permissions")
          .insert(
            permissions.map((permission) => ({
              user_id: profile.user_id,
              module_key: permission,
            })),
          );
        if (insertPermsError) throw insertPermsError;
      }

      const { error: clearCompanyPermsError } = await supabase
        .from("user_company_permissions")
        .delete()
        .eq("user_id", profile.user_id);
      if (clearCompanyPermsError) throw clearCompanyPermsError;

      if (role !== "super_admin" && companyIds.length > 0) {
        const { error: insertCompanyPermsError } = await supabase
          .from("user_company_permissions")
          .insert(
            companyIds.map((companyId) => ({
              user_id: profile.user_id,
              company_id: companyId,
            })),
          );
        if (insertCompanyPermsError) throw insertCompanyPermsError;
      }
      return { invited: false as const, created: false as const };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (result.invited) {
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
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);
      if (error) throw error;
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
                  {canManageUsers && (
                    <TableHead className="w-[100px]">Actions</TableHead>
                  )}
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
                          ur.role === "super_admin" ? "default" : "secondary"
                        }
                        className="gap-1"
                      >
                        {ur.role === "super_admin" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        {ur.role === "super_admin"
                          ? "Super Admin"
                          : roleOptions.find((r) => r.role_key === ur.role)?.role_name ||
                            ur.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ur.role === "super_admin" ? (
                        <span className="text-xs text-muted-foreground">
                          All access
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
                    {canManageUsers && (
                      <TableCell>
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
                                roleId: ur.id,
                                userId: ur.user_id,
                              })
                            }
                            disabled={
                              removeUserRole.isPending ||
                              (!isSuperAdmin && ur.role === "super_admin")
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {adminUsers?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canManageUsers ? 6 : 5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No admin users found
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
          currentRole={editUser.role}
          roleId={editUser.id}
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
