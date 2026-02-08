import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { ALL_PERMISSIONS, PERMISSION_LABELS, AdminPermission } from '@/hooks/usePermissions';
import type { AppRole } from '@/lib/supabase-types';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentRole: AppRole;
  roleId: string;
  userName: string;
}

export function EditUserDialog({ open, onOpenChange, userId, currentRole, roleId, userName }: EditUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<AppRole>(currentRole);
  const [selectedPermissions, setSelectedPermissions] = useState<AdminPermission[]>([]);

  // Fetch current permissions for this user
  const { data: currentPermissions, isLoading: loadingPerms } = useQuery({
    queryKey: ['user-permissions-edit', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []).map(d => d.permission as AdminPermission);
    },
    enabled: open,
  });

  useEffect(() => {
    if (currentPermissions) {
      setSelectedPermissions(currentPermissions);
    }
  }, [currentPermissions]);

  useEffect(() => {
    setRole(currentRole);
  }, [currentRole]);

  const togglePermission = (perm: AdminPermission) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Update role if changed
      if (role !== currentRole) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('id', roleId);
        if (error) throw error;
      }

      // Update permissions: delete all then insert new ones
      // Only relevant for admin role (super_admin gets everything)
      const { error: delError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);
      if (delError) throw delError;

      if (role !== 'super_admin' && selectedPermissions.length > 0) {
        const rows = selectedPermissions.map(permission => ({
          user_id: userId,
          permission,
        }));
        const { error: insError } = await supabase
          .from('user_permissions')
          .insert(rows);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions-edit', userId] });
      toast({ title: 'User updated successfully' });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const isSuperAdmin = role === 'super_admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User: {userName}</DialogTitle>
          <DialogDescription>
            Update role and configure which sections this user can access.
          </DialogDescription>
        </DialogHeader>

        {loadingPerms ? (
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
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
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
                <p className="text-sm text-muted-foreground">All permissions granted automatically.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedPermissions.includes(perm)}
                        onCheckedChange={() => togglePermission(perm)}
                      />
                      {PERMISSION_LABELS[perm]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
