import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  AdminPermission,
} from "@/hooks/usePermissions";
import type { AppRole } from "@/lib/supabase-types";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentRole: AppRole;
  roleId: string;
  canGrantSuperAdmin: boolean;
  userName: string;
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
}

export function EditUserDialog({
  open,
  onOpenChange,
  userId,
  currentRole,
  roleId,
  canGrantSuperAdmin,
  userName,
}: EditUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<AppRole>(currentRole);
  const [selectedPermissions, setSelectedPermissions] = useState<
    AdminPermission[]
  >([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  // Fetch current permissions for this user
  const { data: currentPermissions, isLoading: loadingPerms } = useQuery({
    queryKey: ["user-permissions-edit", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_module_permissions")
        .select("module_key")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map((d) => d.module_key as AdminPermission);
    },
    enabled: open,
  });

  const { data: moduleOptions = [] } = useQuery({
    queryKey: ["module-options-edit", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_modules")
        .select("module_key,module_name")
        .order("module_name", { ascending: true });
      if (error) throw error;
      return (data || []) as ModuleOption[];
    },
    enabled: open,
  });

  const { data: roleOptions = [] } = useQuery({
    queryKey: ["role-options-edit", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_roles")
        .select("role_key,role_name")
        .order("role_name", { ascending: true });
      if (error) throw error;
      return (data || []) as RoleOption[];
    },
    enabled: open,
  });

  const { data: roleModules = [] } = useQuery({
    queryKey: ["role-module-permissions-edit", role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_module_permissions")
        .select("module_key")
        .eq("role_key", role);
      if (error) throw error;
      return (data || []).map((row) => row.module_key as AdminPermission);
    },
    enabled: open && Boolean(role),
  });

  const { data: companyOptions = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["company-options-edit", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as CompanyOption[];
    },
    enabled: open,
  });

  const { data: currentCompanies } = useQuery({
    queryKey: ["user-company-permissions-edit", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_company_permissions")
        .select("company_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map((d) => d.company_id);
    },
    enabled: open,
  });

  useEffect(() => {
    if (currentPermissions) {
      setSelectedPermissions(currentPermissions);
    }
  }, [currentPermissions]);

  useEffect(() => {
    if (currentCompanies) {
      setSelectedCompanyIds(currentCompanies);
    }
  }, [currentCompanies]);

  useEffect(() => {
    setRole(currentRole);
  }, [currentRole]);

  useEffect(() => {
    if (role === "super_admin") return;
    if (roleModules.length > 0) {
      setSelectedPermissions(roleModules);
    }
  }, [role, roleModules]);

  const togglePermission = (perm: AdminPermission) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Update role if changed
      if (roleId) {
        if (role !== currentRole) {
          const { error } = await supabase
            .from("user_roles")
            .update({ role })
            .eq("id", roleId);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error) throw error;
      }

      // Update permissions: delete all then insert new ones
      // Only relevant for admin role (super_admin gets everything)
      const { error: delError } = await supabase
        .from("user_module_permissions")
        .delete()
        .eq("user_id", userId);
      if (delError) throw delError;

      if (role !== "super_admin" && selectedPermissions.length > 0) {
        const rows = selectedPermissions.map((permission) => ({
          user_id: userId,
          module_key: permission,
        }));
        const { error: insError } = await supabase
          .from("user_module_permissions")
          .insert(rows);
        if (insError) throw insError;
      }

      const { error: delCompanyError } = await supabase
        .from("user_company_permissions")
        .delete()
        .eq("user_id", userId);
      if (delCompanyError) throw delCompanyError;

      if (role !== "super_admin" && selectedCompanyIds.length > 0) {
        const companyRows = selectedCompanyIds.map((companyId) => ({
          user_id: userId,
          company_id: companyId,
        }));
        const { error: insCompanyError } = await supabase
          .from("user_company_permissions")
          .insert(companyRows);
        if (insCompanyError) throw insCompanyError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["company-options"] });
      queryClient.invalidateQueries({ queryKey: ["module-options"] });
      queryClient.invalidateQueries({ queryKey: ["role-options"] });
      queryClient.invalidateQueries({
        queryKey: ["user-permissions-edit", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["user-company-permissions-edit", userId],
      });
      toast({ title: "User updated successfully" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isSuperAdmin = role === "super_admin";
  const requiresCompanySelection =
    !isSuperAdmin && companyOptions.length > 0 && selectedCompanyIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User: {userName}</DialogTitle>
          <DialogDescription>
            Update role and configure which sections this user can access.
          </DialogDescription>
        </DialogHeader>

        {loadingPerms || loadingCompanies ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(roleOptions.length > 0
                    ? roleOptions
                    : [
                        { role_key: "admin", role_name: "Admin" },
                        { role_key: "super_admin", role_name: "Super Admin" },
                      ]
                  ).map((roleOption) => (
                    <SelectItem
                      key={roleOption.role_key}
                      value={roleOption.role_key}
                      disabled={
                        roleOption.role_key === "super_admin" &&
                        !canGrantSuperAdmin
                      }
                    >
                      {roleOption.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSuperAdmin && (
                <p className="text-xs text-muted-foreground">
                  Super Admins automatically have access to all sections.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              {isSuperAdmin ? (
                <p className="text-sm text-muted-foreground">
                  All permissions granted automatically.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(moduleOptions.length > 0
                    ? moduleOptions.map((m) => m.module_key)
                    : ALL_PERMISSIONS
                  ).map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedPermissions.includes(perm)}
                        onCheckedChange={() => togglePermission(perm)}
                      />
                      {moduleOptions.find((m) => m.module_key === perm)
                        ?.module_name || PERMISSION_LABELS[perm] || perm}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Company Access</Label>
              {isSuperAdmin ? (
                <p className="text-sm text-muted-foreground">
                  Super Admins can access all companies automatically.
                </p>
              ) : (
                <>
                  {requiresCompanySelection && (
                    <p className="text-xs text-amber-700">
                      Select at least one company to continue.
                    </p>
                  )}
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                    {companyOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No companies available yet.
                      </p>
                    ) : (
                      companyOptions.map((company) => (
                        <label
                          key={company.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedCompanyIds.includes(company.id)}
                            onCheckedChange={() => toggleCompany(company.id)}
                          />
                          {company.name}
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || requiresCompanySelection}
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
