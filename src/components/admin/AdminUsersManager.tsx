import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
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

export function AdminUsersManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("admin");
  const [editUser, setEditUser] = useState<UserRoleRow | null>(null);

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
          .from("user_permissions")
          .select("user_id, permission")
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
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error("User not found. They must sign up first.");

      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("role", role)
        .maybeSingle();

      if (existing) throw new Error("User already has this role.");

      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.user_id, role });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role added successfully" });
      setIsAddOpen(false);
      setNewEmail("");
      setNewRole("admin");
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
      await supabase.from("user_permissions").delete().eq("user_id", userId);
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

  return (
    <div className="flex h-full flex-col">
      <header className="glass-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Admin Users</h1>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-3 sm:p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Admin Users</h2>
          <p className="text-muted-foreground mt-1">
            Manage administrator access, roles, and permissions
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <UserPlus className="mr-2 h-4 w-4" /> Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Admin User</DialogTitle>
                <DialogDescription>
                  Grant admin access to an existing user by their email address.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
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
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    addUserRole.mutate({ email: newEmail, role: newRole })
                  }
                  disabled={!newEmail || addUserRole.isPending}
                >
                  {addUserRole.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Role
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Administrators</CardTitle>
          <CardDescription>
            Users with admin or super admin privileges
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
                  {isSuperAdmin && (
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
                        {ur.role === "super_admin" ? "Super Admin" : "Admin"}
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
                    {isSuperAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditUser(ur)}
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
                            disabled={removeUserRole.isPending}
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
                      colSpan={isSuperAdmin ? 6 : 5}
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
