import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Plus, Trash2, Loader2, Calendar, Eye, Pencil, Lock, Building2 } from "lucide-react";
import type { WizardData } from "./campaign-wizard/CampaignWizard";
import type { Campaign } from "@/lib/supabase-types";
import { normalizeCampaignSurvey } from "@/lib/campaign-survey";
import { formatDateOnly, parseDateOnlyEnd, parseDateOnlyStart } from "@/lib/date-utils";
import {
  clearWizardDrafts,
  hasSavedWizardDraft,
  readLocalCampaigns,
  writeLocalCampaigns,
} from "@/lib/campaign-builder";

const campaignTypeLabels: Record<string, string> = {
  feedback: "Customer Feedback",
  employee_survey: "Employee Survey",
  product_research: "Product Research",
  event_evaluation: "Event Evaluation",
};

export function CampaignsManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { bypassAuth } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [responseCountByCampaign, setResponseCountByCampaign] = useState<
    Record<string, number>
  >({});
  const [campaignCompanyById, setCampaignCompanyById] = useState<
    Record<string, { companyId: string; companyName: string; logoUrl: string | null }>
  >({});
  const [showDraftDecision, setShowDraftDecision] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadCampaigns = useCallback(async () => {
    if (bypassAuth) {
      const localCampaigns = readLocalCampaigns();
      setCampaigns(
        localCampaigns.map((campaign) => {
          const survey = normalizeCampaignSurvey({
            version: 2,
            sections: campaign.sections || [],
            questions: campaign.questions || [],
          });

          return {
            ...campaign,
            sections: survey.sections,
            questions: survey.questions,
          };
        }),
      );
      setIsLoading(false);
      return;
    }

    try {
      const [campaignsRes, linksRes, companiesRes, countsRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select("*")
          .order("start_date", { ascending: false }),
        supabase
          .from("company_campaign_links")
          .select("id, campaign_id, company_id, company:company_id (name, logo_url)"),
        supabase
          .from("companies")
          .select("id, name, logo_url"),
        supabase.rpc("get_campaign_response_counts", {}),
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      if (linksRes.error) throw linksRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (countsRes.error) throw countsRes.error;

      const data = campaignsRes.data || [];
      const links = linksRes.data || [];
      const companies = (companiesRes.data || []) as Array<{
        id: string;
        name: string;
        logo_url: string | null;
      }>;

      setCampaigns(
        data.map((c) => {
          const survey = normalizeCampaignSurvey(c.questions);

          return {
            ...c,
            company_id: c.company_id,
            campaign_type: c.campaign_type as Campaign["campaign_type"],
            sections: survey.sections,
            questions: survey.questions,
          };
        }),
      );

      const campaignCompanyMap: Record<
        string,
        { companyId: string; companyName: string; logoUrl: string | null }
      > = {};

      data.forEach((campaign) => {
        if (!campaign.company_id) return;
        const company = companies.find((candidate) => candidate.id === campaign.company_id);
        if (!company) return;

        campaignCompanyMap[campaign.id] = {
          companyId: company.id,
          companyName: company.name,
          logoUrl: company.logo_url,
        };
      });

      links.forEach((link) => {
        if (!campaignCompanyMap[link.campaign_id]) {
          campaignCompanyMap[link.campaign_id] = {
            companyId: link.company_id,
            companyName:
              ((link.company as { name?: string } | null)?.name as string) ||
              "Selected company",
            logoUrl:
              ((link.company as { logo_url?: string | null } | null)
                ?.logo_url as string | null) || null,
          };
        }
      });

      const responseCounts = ((countsRes.data || []) as Array<{
        campaign_id: string;
        response_count: number;
      }>).reduce<Record<string, number>>((acc, row) => {
        acc[row.campaign_id] = Number(row.response_count || 0);
        return acc;
      }, {});

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
    const start = parseDateOnlyStart(startDate);
    const end = parseDateOnlyEnd(endDate);

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
    const survey = normalizeCampaignSurvey({
      version: 2,
      sections: campaign.sections || [],
      questions: campaign.questions || [],
    });
    const draft: WizardData = {
      campaignId: campaign.id,
      creationMode: "guided_buddy",
      campaignType: campaign.campaign_type,
      selectedCompanyId: campaign.company_id || campaignCompany?.companyId || "",
      selectedCompanyName: campaignCompany?.companyName || "",
      name: campaign.name,
      description: campaign.description || "",
      startDate: campaign.start_date,
      lockStartDate: responseCount > 0,
      endDate: campaign.end_date,
      sections: survey.sections,
      questions: survey.questions,
      documentContent: "",
    };
    navigate("/admin/campaigns/builder", { state: { draft } });
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
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8">
        <Card className="mx-auto w-full max-w-[1400px]">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Feedback Campaigns</CardTitle>
              <CardDescription>
                Create and manage surveys, questionnaires, and feedback forms
              </CardDescription>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                if (hasSavedWizardDraft()) {
                  setShowDraftDecision(true);
                  return;
                }
                navigate("/admin/campaigns/builder");
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
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
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
                        <TableCell>
                          {campaignCompanyById[campaign.id] ? (
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 rounded-md">
                                <AvatarImage
                                  src={campaignCompanyById[campaign.id].logoUrl || undefined}
                                  alt={campaignCompanyById[campaign.id].companyName}
                                  className="object-cover"
                                />
                                <AvatarFallback className="rounded-md bg-muted">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">
                                {campaignCompanyById[campaign.id].companyName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
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
                          {formatDateOnly(campaign.start_date)}
                        </TableCell>
                        <TableCell>
                          {formatDateOnly(campaign.end_date)}
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
              </div>
            )}
          </CardContent>
        </Card>
      </main>

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
                clearWizardDrafts();
                navigate("/admin/campaigns/builder");
              }}
            >
              Start New
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                navigate("/admin/campaigns/builder");
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
