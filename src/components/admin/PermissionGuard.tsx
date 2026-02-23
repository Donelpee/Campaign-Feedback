import { ReactNode } from "react";
import { usePermissions, AdminPermission } from "@/hooks/usePermissions";
import { ShieldAlert } from "lucide-react";

interface PermissionGuardProps {
  permission: AdminPermission;
  children: ReactNode;
}

export function PermissionGuard({
  permission,
  children,
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) return null;

  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground gap-4 p-6">
        <ShieldAlert className="h-16 w-16" />
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="text-sm">
          You don't have permission to access this section.
        </p>
        <p className="text-xs">Contact a Super Admin to request access.</p>
      </div>
    );
  }

  return <>{children}</>;
}
