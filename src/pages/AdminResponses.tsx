// Admin responses page (protected)
// Accessibility: Semantic HTML, clear headings, accessible layout
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGlobalNotificationBell } from "@/components/admin/AdminGlobalNotificationBell";
import { ResponsesViewer } from "@/components/admin/ResponsesViewer";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminResponses() {
  // Routing and auth state
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  // Redirect to login if not authenticated
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

  const canViewResponses =
    hasPermission("responses") || hasPermission("campaigns");

  return (
    <SidebarProvider>
      <div
        className="admin-theme admin-shell-bg min-h-screen flex w-full"
        role="main"
      >
        <AdminSidebar />
        <AdminGlobalNotificationBell />
        <SidebarInset className="bg-transparent">
          {permissionsLoading ? null : canViewResponses ? (
            <ResponsesViewer />
          ) : (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
              <ShieldAlert className="h-16 w-16" />
              <h2 className="text-xl font-semibold text-foreground">
                Access Denied
              </h2>
              <p className="text-sm">
                You do not have access to this section.
              </p>
            </div>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

