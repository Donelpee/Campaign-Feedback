import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Loader2, Calendar, Eye, Pencil, Lock } from "lucide-react";
import { CampaignWizard } from "./campaign-wizard";
import type { WizardData } from "./campaign-wizard/CampaignWizard";
import type { Campaign } from "@/lib/supabase-types";

const LOCAL_CAMPAIGNS_KEY = "client-pulse-local-campaigns";
const WIZARD_DRAFT_KEY = "campaign-wizard-draft-v1";

function readLocalCampaigns(): Campaign[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Campaign[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCampaigns(campaigns: Campaign[]) {
  window.localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

function hasSavedWizardDraft(): boolean {
  try {
    const raw = window.localStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { data?: WizardData };
    const draft = parsed?.data;
    if (!draft) return false;
    return Boolean(
      draft.selectedCompanyId ||
        draft.name?.trim() ||
        draft.description?.trim() ||
        draft.startDate ||
        draft.endDate ||
        draft.questions?.length,
    );
  } catch {
    return false;
  }
}

const campaignTypeLabels: Record<string, string> = {
  feedback: "Customer Feedback",
  employee_survey: "Employee Survey",
  product_research: "Product Research",
  event_evaluation: "Event Evaluation",
};

function generateUniqueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function isCampaignActiveNow(startDate: string, endDate: string): boolean {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
}

export function CampaignsManager({
  isWizardOpen,
  setIsWizardOpen,
  wizardDraft,
  setWizardDraft,
}: {
  isWizardOpen: boolean;
  setIsWizardOpen: (open: boolean) => void;
  wizardDraft: WizardData | null;
  setWizardDraft: (draft: WizardData | null) => void;
}) {
  const { toast } = useToast();
  const { bypassAuth } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [responseCountByCampaign, setResponseCountByCampaign] = useState<
    Record<string, number>
  >({});
  const [campaignCompanyById, setCampaignCompanyById] = useState<
    Record<string, { companyId: string; companyName: string }>
  >({});
  const [showDraftDecision, setShowDraftDecision] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadCampaigns = useCallback(async () => {
    if (bypassAuth) {
      const localCampaigns = readLocalCampaigns();
      setCampaigns(localCampaigns);
      setIsLoading(false);
      return;
    }

    try {
      const [campaignsRes, linksRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select("*")
          .order("start_date", { ascending: false }),
        supabase
          .from("company_campaign_links")
          .select("id, campaign_id, company_id, company:company_id (name)"),
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      if (linksRes.error) throw linksRes.error;

      const data = campaignsRes.data || [];
      const links = linksRes.data || [];
      setCampaigns(
        data.map((c) => ({
          ...c,
          campaign_type: c.campaign_type as Campaign["campaign_type"],
          questions: (c.questions || []) as unknown as Campaign["questions"],
        })),
      );

      const campaignCompanyMap: Record<
        string,
        { companyId: string; companyName: string }
      > = {};
      const linkIdsByCampaign: Record<string, string[]> = {};

      links.forEach((link) => {
        if (!linkIdsByCampaign[link.campaign_id]) {
          linkIdsByCampaign[link.campaign_id] = [];
        }
        linkIdsByCampaign[link.campaign_id].push(link.id);
        if (!campaignCompanyMap[link.campaign_id]) {
          campaignCompanyMap[link.campaign_id] = {
            companyId: link.company_id,
            companyName:
              ((link.company as { name?: string } | null)?.name as string) ||
              "Selected company",
          };
        }
      });

      const allLinkIds = Object.values(linkIdsByCampaign).flat();
      const responseCounts: Record<string, number> = {};
      if (allLinkIds.length > 0) {
        const { data: responses, error: responsesError } = await supabase
          .from("feedback_responses")
          .select("link_id")
          .in("link_id", allLinkIds);

        if (responsesError) throw responsesError;

        const campaignByLinkId: Record<string, string> = {};
        Object.entries(linkIdsByCampaign).forEach(([campaignId, ids]) => {
          ids.forEach((id) => {
            campaignByLinkId[id] = campaignId;
          });
        });

        (responses || []).forEach((row) => {
          const campaignId = campaignByLinkId[row.link_id];
          if (!campaignId) return;
          responseCounts[campaignId] = (responseCounts[campaignId] || 0) + 1;
        });
      }

      setResponseCountByCampaign(responseCounts);
      setCampaignCompanyById(campaignCompanyMap);
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load campaigns.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [bypassAuth, toast]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleCreateCampaign = async (data: WizardData) => {
    if (bypassAuth) {
      const now = new Date().toISOString();
      const campaign: Campaign = {
        id: data.campaignId || crypto.randomUUID(),
        name: data.name.trim(),
        description: data.description.trim() || null,
        campaign_type: data.campaignType,
        questions: data.questions,
        start_date: data.startDate,
        end_date: data.endDate,
        created_at: now,
        updated_at: now,
      };

      const existing = readLocalCampaigns().filter((c) => c.id !== campaign.id);
      const updatedCampaigns = [campaign, ...existing];
      writeLocalCampaigns(updatedCampaigns);
      setCampaigns(updatedCampaigns);

      toast({
        title: "Success",
        description: data.campaignId
          ? "Campaign updated successfully (local bypass mode)."
          : "Campaign created successfully (local bypass mode).",
      });
      setIsWizardOpen(false);
      setWizardDraft(null);
      return;
    }

    try {
      if (!data.selectedCompanyId) {
        throw new Error("Company is required to create a campaign.");
      }

      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new Error("Campaign name is required.");
      }

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

        const linkIds = (links || []).map((l) => l.id);
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

            const sameQuestions =
              JSON.stringify(existingCampaign.questions || []) ===
              JSON.stringify(data.questions || []);
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
            questions: JSON.parse(JSON.stringify(data.questions)),
            start_date: data.startDate,
            end_date: data.endDate,
          })
          .eq("id", data.campaignId);
        if (updateError) throw updateError;

        toast({
          title: "Success",
          description: "Campaign updated successfully.",
        });
        setIsWizardOpen(false);
        setWizardDraft(null);
        await loadCampaigns();
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

      const { data: createdCampaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert([
          {
            name: trimmedName,
            description: data.description.trim() || null,
            campaign_type: data.campaignType,
            questions: JSON.parse(JSON.stringify(data.questions)),
            start_date: data.startDate,
            end_date: data.endDate,
          },
        ])
        .select("id")
        .single();

      if (campaignError) throw campaignError;

      let linkCreated = false;
      if (isCampaignActiveNow(data.startDate, data.endDate)) {
        for (let attempt = 0; attempt < 5 && !linkCreated; attempt++) {
          const uniqueCode = generateUniqueCode();
          const { error: linkError } = await supabase
            .from("company_campaign_links")
            .insert([
              {
                company_id: data.selectedCompanyId,
                campaign_id: createdCampaign.id,
                unique_code: uniqueCode,
              },
            ]);

          if (!linkError) {
            linkCreated = true;
            break;
          }

          if (linkError.code !== "23505") {
            throw linkError;
          }
        }

        if (!linkCreated) {
          await supabase.from("campaigns").delete().eq("id", createdCampaign.id);
          throw new Error(
            "Unable to create a unique access link for this active campaign.",
          );
        }
      }

      toast({
        title: "Success",
        description: linkCreated
          ? data.selectedCompanyName
            ? `Campaign created and linked to ${data.selectedCompanyName}.`
            : "Campaign created and linked to selected company."
          : "Campaign created successfully. Link can be generated once the campaign becomes active.",
      });

      setIsWizardOpen(false);
      setWizardDraft(null);
      await loadCampaigns();
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

  const handleDelete = async (campaign: Campaign) => {
    if (
      !confirm(
        `Are you sure you want to delete "${campaign.name}"? This will also delete all associated links and responses.`,
      )
    ) {
      return;
    }

    if (bypassAuth) {
      const updatedCampaigns = readLocalCampaigns().filter(
        (item) => item.id !== campaign.id,
      );
      writeLocalCampaigns(updatedCampaigns);
      setCampaigns(updatedCampaigns);
      toast({
        title: "Success",
        description: "Campaign deleted successfully (local bypass mode).",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaign.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Campaign deleted successfully.",
      });

      loadCampaigns();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete campaign.",
      });
    }
  };

  const getStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (now < start) {
      return { label: "Upcoming", variant: "secondary" as const };
    } else if (now > end) {
      return { label: "Ended", variant: "outline" as const };
    } else {
      return { label: "Active", variant: "default" as const };
    }
  };

  const handleEdit = (campaign: Campaign) => {
    const responseCount = responseCountByCampaign[campaign.id] || 0;

    const campaignCompany = campaignCompanyById[campaign.id];
    setWizardDraft({
      campaignId: campaign.id,
      buildMode: "manual",
      campaignType: campaign.campaign_type,
      selectedCompanyId: campaignCompany?.companyId || "",
      selectedCompanyName: campaignCompany?.companyName || "",
      name: campaign.name,
      description: campaign.description || "",
      startDate: campaign.start_date,
      lockStartDate: responseCount > 0,
      endDate: campaign.end_date,
      questions: campaign.questions || [],
      documentContent: "",
    });
    setIsWizardOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="glass-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Campaigns</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <Card className="mx-auto w-full max-w-[1400px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Feedback Campaigns</CardTitle>
              <CardDescription>
                Create and manage surveys, questionnaires, and feedback forms
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                if (hasSavedWizardDraft()) {
                  setShowDraftDecision(true);
                  return;
                }
                setIsWizardOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No campaigns yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create your first campaign to start collecting feedback.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => {
                    const status = getStatus(
                      campaign.start_date,
                      campaign.end_date,
                    );
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">
                          {campaign.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {campaignTypeLabels[campaign.campaign_type] ||
                              "Feedback"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span>{campaign.questions?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(campaign.start_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(campaign.end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(campaign)}
                              title={
                                (responseCountByCampaign[campaign.id] || 0) > 0
                                  ? "Responses exist: only end date can be changed"
                                  : "Edit campaign"
                              }
                            >
                              {(responseCountByCampaign[campaign.id] || 0) > 0 ? (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Pencil className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(campaign)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <CampaignWizard
        open={isWizardOpen}
        onOpenChange={(open) => {
          setIsWizardOpen(open);
          if (!open) setWizardDraft(null);
        }}
        onComplete={handleCreateCampaign}
        initialDraft={wizardDraft}
      />

      <AlertDialog open={showDraftDecision} onOpenChange={setShowDraftDecision}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume previous draft?</AlertDialogTitle>
            <AlertDialogDescription>
              We found an incomplete campaign draft. You can continue where you
              left off, or start a brand new campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.localStorage.removeItem(WIZARD_DRAFT_KEY);
                setWizardDraft(null);
                setIsWizardOpen(true);
              }}
            >
              Start New
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setWizardDraft(null);
                setIsWizardOpen(true);
              }}
            >
              Continue Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
