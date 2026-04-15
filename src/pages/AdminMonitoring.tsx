import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGlobalNotificationBell } from "@/components/admin/AdminGlobalNotificationBell";
import { SystemHealthMonitor } from "@/components/admin/SystemHealthMonitor";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";

export default function AdminMonitoring() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center bg-background"
        aria-busy="true"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="admin-theme admin-shell-bg min-h-screen flex w-full" role="main">
        <AdminSidebar />
        <AdminGlobalNotificationBell />
        <SidebarInset className="bg-transparent">
          <PermissionGuard permission="audit_logs">
            <SystemHealthMonitor />
          </PermissionGuard>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
