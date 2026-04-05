import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGlobalNotificationBell } from "@/components/admin/AdminGlobalNotificationBell";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { CampaignWizard } from "@/components/admin/campaign-wizard";
import type {
  CreationMode,
  WizardData,
} from "@/components/admin/campaign-wizard/CampaignWizard";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DEFAULT_CREATION_MODE_KEY, readLocalCampaigns, writeLocalCampaigns } from "@/lib/campaign-builder";
import type { Campaign } from "@/lib/supabase-types";
import { normalizeCampaignSurvey, serializeCampaignSurvey } from "@/lib/campaign-survey";

interface CampaignBuilderLocationState {
  draft?: WizardData | null;
}

export default function AdminCampaignBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, bypassAuth } = useAuth();
  const { toast } = useToast();
  const [defaultCreationMode, setDefaultCreationMode] =
    useState<CreationMode | null>(null);

  const initialDraft = useMemo(
    () => ((location.state as CampaignBuilderLocationState | null)?.draft ?? null),
    [location.state],
  );

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [isLoading, navigate, user]);

  const loadDefaultCreationMode = useCallback(async () => {
    if (bypassAuth) {
      const local = window.localStorage.getItem(
        DEFAULT_CREATION_MODE_KEY,
      ) as CreationMode | null;
      setDefaultCreationMode(local || null);
      return;
    }

    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("default_creation_mode")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      setDefaultCreationMode(
        (data?.default_creation_mode as CreationMode) || null,
      );
    } catch (error) {
      console.error("Error loading default creation mode:", error);
      setDefaultCreationMode(null);
    }
  }, [bypassAuth, user?.id]);

  useEffect(() => {
    void loadDefaultCreationMode();
  }, [loadDefaultCreationMode]);

  const handleDefaultCreationModeChange = async (mode: CreationMode) => {
    setDefaultCreationMode(mode);
    if (bypassAuth) {
      window.localStorage.setItem(DEFAULT_CREATION_MODE_KEY, mode);
      return;
    }
    if (!user?.id) return;
    try {
      const { error } = await supabase.from("user_settings").upsert(
        { user_id: user.id, default_creation_mode: mode },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    } catch (error) {
      console.error("Error saving default creation mode:", error);
    }
  };

  const handleComplete = async (data: WizardData) => {
    if (bypassAuth) {
      const now = new Date().toISOString();
      const campaign: Campaign = {
        id: data.campaignId || crypto.randomUUID(),
        name: data.name.trim(),
        description: data.description.trim() || null,
        campaign_type: data.campaignType,
        questions: data.questions,
        sections: data.sections,
        start_date: data.startDate,
        end_date: data.endDate,
        created_at: now,
        updated_at: now,
      };

      const existing = readLocalCampaigns().filter((c) => c.id !== campaign.id);
      writeLocalCampaigns([campaign, ...existing]);

      toast({
        title: "Success",
        description: data.campaignId
          ? "Campaign updated successfully (local bypass mode)."
          : "Campaign created successfully (local bypass mode).",
      });
      navigate("/admin/campaigns");
      return;
    }

    if (!data.selectedCompanyId) {
      throw new Error("Company is required to create a campaign.");
    }

    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Campaign name is required.");
    }

    try {
      const serializedSurvey = JSON.parse(
        JSON.stringify(
          serializeCampaignSurvey({
            sections: data.sections,
            questions: data.questions,
          }),
        ),
      );

      if (data.campaignId) {
        const { data: duplicateByName, error: duplicateByNameError } =
          await supabase
            .from("campaigns")
            .select("id")
            .eq("name", trimmedName)
            .neq("id", data.campaignId)
            .maybeSingle();
        if (duplicateByNameError) throw duplicateByNameError;
        if (duplicateByName) {
          throw new Error("A campaign with this exact name already exists.");
        }

        const { data: links, error: linksError } = await supabase
          .from("company_campaign_links")
          .select("id")
          .eq("campaign_id", data.campaignId);
        if (linksError) throw linksError;

        const linkIds = (links || []).map((link) => link.id);
        if (linkIds.length > 0) {
          const { count, error: countError } = await supabase
            .from("feedback_responses")
            .select("id", { count: "exact", head: true })
            .in("link_id", linkIds);
          if (countError) throw countError;

          if ((count || 0) > 0) {
            const { data: existingCampaign, error: existingCampaignError } =
              await supabase
                .from("campaigns")
                .select("name, description, campaign_type, questions, start_date")
                .eq("id", data.campaignId)
                .single();
            if (existingCampaignError) throw existingCampaignError;

            const existingSerializedSurvey = JSON.parse(
              JSON.stringify(
                serializeCampaignSurvey(
                  normalizeCampaignSurvey(existingCampaign.questions),
                ),
              ),
            );
            const sameQuestions =
              JSON.stringify(existingSerializedSurvey) ===
              JSON.stringify(serializedSurvey);
            const sameCampaignType =
              (existingCampaign.campaign_type || "feedback") === data.campaignType;
            const sameName = (existingCampaign.name || "").trim() === trimmedName;
            const sameDescription =
              (existingCampaign.description || "").trim() ===
              (data.description.trim() || "");
            const sameStartDate = existingCampaign.start_date === data.startDate;

            if (
              !sameQuestions ||
              !sameCampaignType ||
              !sameName ||
              !sameDescription ||
              !sameStartDate
            ) {
              throw new Error(
                "This campaign has responses. Only the end date can be changed to extend or reactivate it.",
              );
            }
          }
        }

        const { error: updateError } = await supabase
          .from("campaigns")
          .update({
            name: trimmedName,
            description: data.description.trim() || null,
            campaign_type: data.campaignType,
            questions: serializedSurvey,
            start_date: data.startDate,
            end_date: data.endDate,
          })
          .eq("id", data.campaignId);
        if (updateError) throw updateError;

        toast({
          title: "Success",
          description: "Campaign updated successfully.",
        });
        navigate("/admin/campaigns");
        return;
      }

      const { data: duplicateByName, error: duplicateByNameError } = await supabase
        .from("campaigns")
        .select("id")
        .eq("name", trimmedName)
        .maybeSingle();
      if (duplicateByNameError) throw duplicateByNameError;
      if (duplicateByName) {
        throw new Error("A campaign with this exact name already exists.");
      }

      const { error: campaignError } = await supabase.from("campaigns").insert([
        {
          name: trimmedName,
          description: data.description.trim() || null,
          campaign_type: data.campaignType,
          questions: serializedSurvey,
          start_date: data.startDate,
          end_date: data.endDate,
        },
      ]);
      if (campaignError) throw campaignError;

      toast({
        title: "Success",
        description:
          "Campaign created successfully. Generate a link from the Links page.",
      });
      navigate("/admin/campaigns");
    } catch (error) {
      console.error("Error creating campaign:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create campaign.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      throw error;
    }
  };

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
          <PermissionGuard permission="campaigns">
            <CampaignWizard
              mode="page"
              onOpenChange={(open) => {
                if (!open) {
                  navigate("/admin/campaigns");
                }
              }}
              onComplete={handleComplete}
              initialDraft={initialDraft}
              defaultCreationMode={defaultCreationMode}
              onDefaultCreationModeChange={handleDefaultCreationModeChange}
            />
          </PermissionGuard>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
