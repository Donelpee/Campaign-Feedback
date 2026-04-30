import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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
import { Plus, Trash2, Loader2, Calendar, Eye, Pencil, Lock, Building2, CopyPlus } from "lucide-react";
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
import {
  makeTemplateFromCampaign,
  type CampaignTemplateVisibility,
  readLocalCampaignTemplates,
  writeLocalCampaignTemplates,
  type CampaignTemplate,
} from "@/lib/campaign-templates";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const campaignTypeLabels: Record<string, string> = {
  feedback: "Customer Feedback",
  employee_survey: "Employee Survey",
  product_research: "Product Research",
  event_evaluation: "Event Evaluation",
};

export function CampaignsManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { bypassAuth, user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [responseCountByCampaign, setResponseCountByCampaign] = useState<
    Record<string, number>
  >({});
  const [campaignCompanyById, setCampaignCompanyById] = useState<
    Record<string, { companyId: string; companyName: string; logoUrl: string | null }>
  >({});
  const [showDraftDecision, setShowDraftDecision] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [selectedCampaignForTemplate, setSelectedCampaignForTemplate] = useState<Campaign | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateVisibility, setTemplateVisibility] =
    useState<CampaignTemplateVisibility>("organization");
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null);
  const [showEditTemplateDialog, setShowEditTemplateDialog] = useState(false);
  const [showUseTemplateDialog, setShowUseTemplateDialog] = useState(false);

  const loadCampaigns = useCallback(async () => {
    if (bypassAuth) {
      const localCampaigns = readLocalCampaigns();
      const localTemplates = readLocalCampaignTemplates();
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
      setTemplates(localTemplates);
      setIsLoading(false);
      return;
    }

    try {
      const [campaignsRes, linksRes, companiesRes, countsRes, templatesRes] = await Promise.all([
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
        supabase
          .from("campaign_templates")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      if (linksRes.error) throw linksRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (countsRes.error) throw countsRes.error;
      if (templatesRes.error) throw templatesRes.error;

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
      setTemplates(
        (templatesRes.data || []).map((template) => {
          const survey = normalizeCampaignSurvey(template.questions);
          return {
            id: template.id,
            name: template.name,
            description: template.description,
            campaign_type: (template.campaign_type || "feedback") as Campaign["campaign_type"],
            visibility_scope:
              (template.visibility_scope as CampaignTemplateVisibility) ||
              "organization",
            created_by_user_id: template.created_by_user_id,
            sections: survey.sections,
            questions: survey.questions,
            source_campaign_id: template.source_campaign_id,
            created_at: template.created_at,
            updated_at: template.updated_at,
          };
        }),
      );
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

  const handleOpenSaveTemplate = (campaign: Campaign) => {
    setSelectedCampaignForTemplate(campaign);
    setTemplateName(`${campaign.name} Template`);
    setTemplateDescription(campaign.description || "");
    setTemplateVisibility("organization");
    setShowSaveTemplateDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!selectedCampaignForTemplate) return;
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      toast({
        variant: "destructive",
        title: "Template name required",
        description: "Please enter a template name.",
      });
      return;
    }

    const newTemplate = makeTemplateFromCampaign(
      selectedCampaignForTemplate,
      trimmedName,
      templateDescription,
      templateVisibility,
      user?.id || null,
    );

    if (bypassAuth) {
      const updatedTemplates = [newTemplate, ...readLocalCampaignTemplates()];
      writeLocalCampaignTemplates(updatedTemplates);
      setTemplates(updatedTemplates);
      setShowSaveTemplateDialog(false);
      setSelectedCampaignForTemplate(null);
      toast({
        title: "Template saved",
        description: "You can now reuse it to create campaigns faster.",
      });
      return;
    }

    try {
      const serializedSurvey = {
        version: 2 as const,
        sections: newTemplate.sections,
        questions: newTemplate.questions,
      };
      const { error } = await supabase.from("campaign_templates").insert([
        {
          name: newTemplate.name,
          description: newTemplate.description,
          campaign_type: newTemplate.campaign_type,
          visibility_scope: newTemplate.visibility_scope,
          questions: serializedSurvey as unknown as Json,
          source_campaign_id: newTemplate.source_campaign_id || null,
        },
      ]);
      if (error) throw error;
      toast({
        title: "Template saved",
        description: "You can now reuse it to create campaigns faster.",
      });
      setShowSaveTemplateDialog(false);
      setSelectedCampaignForTemplate(null);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateVisibility("organization");
      loadCampaigns();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save template.",
      });
    }
  };

  const handleUseTemplate = (template: CampaignTemplate) => {
    const draft: WizardData = {
      creationMode: "guided_buddy",
      campaignType: template.campaign_type,
      selectedCompanyId: "",
      selectedCompanyName: "",
      name: `${template.name} Copy`,
      description: template.description || "",
      startDate: "",
      endDate: "",
      sections: template.sections || [],
      questions: template.questions || [],
      documentContent: "",
    };
    setShowUseTemplateDialog(false);
    navigate("/admin/campaigns/builder", { state: { draft } });
  };

  const canManageTemplate = (template: CampaignTemplate) =>
    bypassAuth || !template.created_by_user_id || template.created_by_user_id === user?.id;

  const handleOpenEditTemplate = (template: CampaignTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    setTemplateVisibility(template.visibility_scope || "organization");
    setShowEditTemplateDialog(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      toast({
        variant: "destructive",
        title: "Template name required",
        description: "Please enter a template name.",
      });
      return;
    }

    if (bypassAuth) {
      const updated = readLocalCampaignTemplates().map((template) =>
        template.id === editingTemplate.id
          ? {
              ...template,
              name: trimmedName,
              description: templateDescription.trim() || null,
              visibility_scope: templateVisibility,
              updated_at: new Date().toISOString(),
            }
          : template,
      );
      writeLocalCampaignTemplates(updated);
      setTemplates(updated);
      setShowEditTemplateDialog(false);
      setEditingTemplate(null);
      toast({ title: "Template updated", description: "Template changes saved." });
      return;
    }

    try {
      const { error } = await supabase
        .from("campaign_templates")
        .update({
          name: trimmedName,
          description: templateDescription.trim() || null,
          visibility_scope: templateVisibility,
        })
        .eq("id", editingTemplate.id);
      if (error) throw error;
      setShowEditTemplateDialog(false);
      setEditingTemplate(null);
      toast({ title: "Template updated", description: "Template changes saved." });
      loadCampaigns();
    } catch (error) {
      console.error("Error updating template:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update template.",
      });
    }
  };

  const handleDeleteTemplate = async (template: CampaignTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;

    if (bypassAuth) {
      const updated = readLocalCampaignTemplates().filter((item) => item.id !== template.id);
      writeLocalCampaignTemplates(updated);
      setTemplates(updated);
      toast({ title: "Template deleted", description: "Template removed." });
      return;
    }

    try {
      const { error } = await supabase.from("campaign_templates").delete().eq("id", template.id);
      if (error) throw error;
      toast({ title: "Template deleted", description: "Template removed." });
      loadCampaigns();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete template.",
      });
    }
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
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setShowUseTemplateDialog(true)}
              >
                <CopyPlus className="mr-2 h-4 w-4" />
                Use Template
              </Button>
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
            </div>
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
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenSaveTemplate(campaign)}
                              title="Save as template"
                            >
                              <CopyPlus className="h-4 w-4" />
                            </Button>
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
                              title="Delete campaign"
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

      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Campaign as Template</DialogTitle>
            <DialogDescription>
              Create a reusable template from this campaign for future campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Template name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-description">Template description</Label>
            <Input
              id="template-description"
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={templateVisibility}
              onValueChange={(value) =>
                setTemplateVisibility(value as CampaignTemplateVisibility)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization-wide</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveTemplateDialog(false);
                setSelectedCampaignForTemplate(null);
                setTemplateName("");
                setTemplateDescription("");
                setTemplateVisibility("organization");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUseTemplateDialog} onOpenChange={setShowUseTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a Template</DialogTitle>
            <DialogDescription>
              Start a new campaign with an existing template.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[320px] space-y-2 overflow-auto">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.questions.length} questions
                    </p>
                    {template.description ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    ) : null}
                    <div className="mt-1 flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {template.visibility_scope === "personal"
                          ? "Personal"
                          : "Organization"}
                      </Badge>
                      {template.created_by_user_id === user?.id ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Mine
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => handleUseTemplate(template)}>
                      Use
                    </Button>
                    {canManageTemplate(template) ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditTemplate(template)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTemplate(template)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditTemplateDialog} onOpenChange={setShowEditTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update template details and visibility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-template-name">Template name</Label>
            <Input
              id="edit-template-name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Template name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-template-description">Template description</Label>
            <Input
              id="edit-template-description"
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={templateVisibility}
              onValueChange={(value) =>
                setTemplateVisibility(value as CampaignTemplateVisibility)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization-wide</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditTemplateDialog(false);
                setEditingTemplate(null);
                setTemplateName("");
                setTemplateDescription("");
                setTemplateVisibility("organization");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateTemplate}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
