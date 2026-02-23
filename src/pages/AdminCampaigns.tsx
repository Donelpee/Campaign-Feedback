// Admin campaigns page (protected)
// Accessibility: Semantic HTML, clear headings, accessible layout
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { CampaignsManager } from "@/components/admin/CampaignsManager";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";

export default function AdminCampaigns() {
  // Routing, state, and wizard logic
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const [wizardDraft, setWizardDraft] = useState(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Open wizard with draft if navigated here with state
  useEffect(() => {
    if (location.state?.draft) {
      setWizardDraft(location.state.draft);
      setIsWizardOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
        <AdminSidebar
          onResumeDraft={(draft) => {
            if (window.location.pathname !== "/admin/campaigns") {
              navigate("/admin/campaigns", { state: { draft } });
            } else {
              setWizardDraft(draft);
              setIsWizardOpen(true);
            }
          }}
        />
        <SidebarInset className="bg-transparent">
          <PermissionGuard permission="campaigns">
            <CampaignsManager
              isWizardOpen={isWizardOpen}
              setIsWizardOpen={setIsWizardOpen}
              wizardDraft={wizardDraft}
              setWizardDraft={setWizardDraft}
            />
          </PermissionGuard>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

