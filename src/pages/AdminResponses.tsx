// Admin responses page (protected)
// Accessibility: Semantic HTML, clear headings, accessible layout
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGlobalNotificationBell } from "@/components/admin/AdminGlobalNotificationBell";
import { ResponsesViewer } from "@/components/admin/ResponsesViewer";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";

export default function AdminResponses() {
  // Routing and auth state
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

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

  return (
    <SidebarProvider>
      <div
        className="admin-theme admin-shell-bg min-h-screen flex w-full"
        role="main"
      >
        <AdminSidebar />
        <AdminGlobalNotificationBell />
        <SidebarInset className="bg-transparent">
          <PermissionGuard permission="responses">
            <ResponsesViewer />
          </PermissionGuard>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

