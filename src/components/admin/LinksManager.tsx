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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Copy,
  Trash2,
  Loader2,
  Link2,
  ExternalLink,
  Mail,
  Send,
  RefreshCw,
  Building2,
  Eye,
} from "lucide-react";
import type {
  Company,
  Campaign,
  CompanyCampaignLink,
} from "@/lib/supabase-types";
import { futureReleaseFlags } from "@/config/futureReleaseFlags";
import { normalizeCampaignSurvey } from "@/lib/campaign-survey";

interface LinkWithDetails extends CompanyCampaignLink {
  company: Company;
  campaign: Campaign;
}

interface CampaignRecipient {
  id: string;
  email: string;
  status: "pending" | "sent" | "failed" | "opened" | "responded";
  reminder_count: number;
  last_sent_at: string | null;
}

interface DistributionSettings {
  reminderEnabled: boolean;
  reminderIntervalDays: number;
  maxReminders: number;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

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

export function LinksManager() {
  const { toast } = useToast();
  const [links, setLinks] = useState<LinkWithDetails[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] =
    useState(false);
  const [selectedDistributionLink, setSelectedDistributionLink] =
    useState<LinkWithDetails | null>(null);
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [distributionSettings, setDistributionSettings] =
    useState<DistributionSettings>({
      reminderEnabled: false,
      reminderIntervalDays: 3,
      maxReminders: 2,
    });
  const [isSavingDistribution, setIsSavingDistribution] = useState(false);
  const [isDispatchingInvites, setIsDispatchingInvites] = useState(false);
  const [isDispatchingReminders, setIsDispatchingReminders] = useState(false);
  const availableCampaigns = campaigns.filter(
    (campaign) => !links.some((link) => link.campaign_id === campaign.id),
  );

  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (query: string) => {
        eq: (column: string, value: string) => {
          order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
        };
      };
      insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
      upsert: (values: unknown, options?: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };

  const loadData = useCallback(async () => {
    try {
      const [linksRes, companiesRes, campaignsRes] = await Promise.all([
        supabase
          .from("company_campaign_links")
          .select(
            `
            *,
            company:company_id (*),
            campaign:campaign_id (*)
          `,
          )
          .order("created_at", { ascending: false }),
        supabase.from("companies").select("*").order("name"),
        supabase
          .from("campaigns")
          .select("*")
          .order("start_date", { ascending: false }),
      ]);

      if (linksRes.error) throw linksRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      const mappedLinks = (linksRes.data || []).map((link) => ({
        ...link,
        company: link.company as unknown as Company,
        campaign: link.campaign as unknown as Campaign,
      })) as LinkWithDetails[];

      const staleActiveLinks = mappedLinks.filter(
        (link) =>
          link.is_active &&
          !isCampaignActiveNow(link.campaign.start_date, link.campaign.end_date),
      );
      if (staleActiveLinks.length > 0) {
        await Promise.all(
          staleActiveLinks.map((link) =>
            supabase
              .from("company_campaign_links")
              .update({ is_active: false })
              .eq("id", link.id),
          ),
        );
      }

      setLinks(
        mappedLinks.map((link) =>
          staleActiveLinks.some((stale) => stale.id === link.id)
            ? { ...link, is_active: false }
            : link,
        ),
      );
      setCompanies((companiesRes.data || []) as Company[]);
      setCampaigns(
        (campaignsRes.data || []).map((c) => {
          const survey = normalizeCampaignSurvey(c.questions);
          return {
            ...c,
            campaign_type: c.campaign_type as Campaign["campaign_type"],
            sections: survey.sections,
            questions: survey.questions,
          };
        }),
      );
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load data.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!selectedCompany || !selectedCampaign) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select both a company and a campaign.",
      });
      return;
    }

    // A campaign can have only one generated link.
    const existing = links.find((l) => l.campaign_id === selectedCampaign);
    if (existing) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "This campaign already has a generated link.",
      });
      return;
    }

    const selectedCampaignRecord = campaigns.find((c) => c.id === selectedCampaign);
    if (!selectedCampaignRecord) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selected campaign was not found.",
      });
      return;
    }

    setIsSaving(true);

    try {
      let created = false;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const uniqueCode = generateUniqueCode();
        const { error } = await supabase.from("company_campaign_links").insert({
          company_id: selectedCompany,
          campaign_id: selectedCampaign,
          unique_code: uniqueCode,
        });

        if (!error) {
          created = true;
          break;
        }

        if (error.code !== "23505") {
          throw error;
        }
      }

      if (!created) {
        throw new Error("Unable to create a unique link code.");
      }

      toast({
        title: "Success",
        description: "Feedback link created successfully.",
      });

      setIsDialogOpen(false);
      setSelectedCompany("");
      setSelectedCampaign("");
      loadData();
    } catch (error) {
      console.error("Error creating link:", error);
      const errorMessage = getErrorMessage(error, "Failed to create link.");
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const loadDistributionData = useCallback(
    async (link: LinkWithDetails) => {
      try {
        const [recipientsRes, settingsRes] = await Promise.all([
          sb
            .from("campaign_email_recipients")
            .select("id, email, status, reminder_count, last_sent_at")
            .eq("campaign_id", link.campaign_id)
            .order("created_at", { ascending: false }),
          sb
            .from("campaign_distribution_settings")
            .select(
              "campaign_id, reminder_enabled, reminder_interval_days, max_reminders",
            )
            .eq("campaign_id", link.campaign_id)
            .maybeSingle(),
        ]);

        if (recipientsRes.error) throw recipientsRes.error;
        if (settingsRes.error) throw settingsRes.error;

        const loadedRecipients = (recipientsRes.data || []) as CampaignRecipient[];
        setRecipients(loadedRecipients);

        const settingRow = settingsRes.data as
          | {
              reminder_enabled?: boolean;
              reminder_interval_days?: number;
              max_reminders?: number;
            }
          | null;

        setDistributionSettings({
          reminderEnabled: Boolean(settingRow?.reminder_enabled),
          reminderIntervalDays: settingRow?.reminder_interval_days || 3,
          maxReminders: settingRow?.max_reminders || 2,
        });
      } catch (error) {
        console.error("Error loading distribution data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load distribution settings.",
        });
      }
    },
    [sb, toast],
  );

  const openDistributionDialog = async (link: LinkWithDetails) => {
    setSelectedDistributionLink(link);
    setIsDistributionDialogOpen(true);
    setRecipientInput("");
    await loadDistributionData(link);
  };

  const parseRecipientEmails = (raw: string) =>
    raw
      .split(/[\n,;]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry));

  const handleSaveDistribution = async () => {
    if (!selectedDistributionLink) return;

    const parsedEmails = parseRecipientEmails(recipientInput);
    setIsSavingDistribution(true);

    try {
      const settingsPayload = {
        campaign_id: selectedDistributionLink.campaign_id,
        reminder_enabled: distributionSettings.reminderEnabled,
        reminder_interval_days: Math.max(
          1,
          distributionSettings.reminderIntervalDays,
        ),
        max_reminders: Math.max(0, distributionSettings.maxReminders),
      };

      const { error: settingsError } = await sb
        .from("campaign_distribution_settings")
        .upsert(settingsPayload, { onConflict: "campaign_id" });
      if (settingsError) throw settingsError;

      if (parsedEmails.length > 0) {
        const payload = parsedEmails.map((email) => ({
          campaign_id: selectedDistributionLink.campaign_id,
          company_id: selectedDistributionLink.company_id,
          email,
          status: "pending",
        }));
        const { error: recipientsError } = await sb
          .from("campaign_email_recipients")
          .upsert(payload, { onConflict: "campaign_id,email", ignoreDuplicates: true });
        if (recipientsError) throw recipientsError;
      }

      setRecipientInput("");
      await loadDistributionData(selectedDistributionLink);
      toast({
        title: "Saved",
        description: "Distribution settings updated successfully.",
      });
    } catch (error) {
      console.error("Error saving distribution:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save distribution settings.",
      });
    } finally {
      setIsSavingDistribution(false);
    }
  };

  const handleDispatch = async (action: "send_invites" | "send_reminders") => {
    if (!selectedDistributionLink) return;

    if (action === "send_invites") {
      setIsDispatchingInvites(true);
    } else {
      setIsDispatchingReminders(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke(
        "dispatch-campaign-emails",
        {
          body: {
            campaignId: selectedDistributionLink.campaign_id,
            action,
          },
        },
      );

      if (error) throw error;

      const summary = data as
        | { sent?: number; failed?: number; processed?: number; message?: string }
        | undefined;

      await loadDistributionData(selectedDistributionLink);
      toast({
        title: action === "send_invites" ? "Invites processed" : "Reminders processed",
        description:
          summary?.message ||
          `Processed ${summary?.processed || 0}, sent ${summary?.sent || 0}, failed ${summary?.failed || 0}.`,
      });
    } catch (error) {
      console.error("Error dispatching emails:", error);
      toast({
        variant: "destructive",
        title: "Dispatch failed",
        description:
          action === "send_invites"
            ? "Unable to dispatch invites."
            : "Unable to dispatch reminders.",
      });
    } finally {
      if (action === "send_invites") {
        setIsDispatchingInvites(false);
      } else {
        setIsDispatchingReminders(false);
      }
    }
  };

  const handleToggleActive = async (link: LinkWithDetails) => {
    try {
      const { error } = await supabase
        .from("company_campaign_links")
        .update({ is_active: !link.is_active })
        .eq("id", link.id);

      if (error) throw error;

      setLinks(
        links.map((l) =>
          l.id === link.id ? { ...l, is_active: !l.is_active } : l,
        ),
      );

      toast({
        title: "Success",
        description: `Link ${!link.is_active ? "activated" : "deactivated"} successfully.`,
      });
    } catch (error) {
      console.error("Error toggling link:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update link status.",
      });
    }
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}/feedback/${code}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "Feedback link copied to clipboard.",
    });
  };

  const handleDelete = async (link: LinkWithDetails) => {
    if (
      !confirm(
        `Are you sure you want to delete this link? This will also delete all associated responses.`,
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("company_campaign_links")
        .delete()
        .eq("id", link.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Link deleted successfully.",
      });

      loadData();
    } catch (error) {
      console.error("Error deleting link:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete link.",
      });
    }
  };

  const getStatus = (startDate: string, endDate: string, isActive: boolean) => {
    if (!isActive) return { label: "Inactive", variant: "secondary" as const };
    return { label: "Active", variant: "default" as const };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="glass-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Feedback Links</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8">
        <Card className="mx-auto w-full max-w-[1400px]">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>URL Generation</CardTitle>
              <CardDescription>
                Generate and manage unique feedback URLs for each company
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" disabled={availableCampaigns.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Feedback Link</DialogTitle>
                  <DialogDescription>
                    Create a unique feedback URL for a specific company and
                    campaign.
                  </DialogDescription>
                </DialogHeader>
                <div className="easy-form-shell space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Pick the company first, then choose its campaign to generate one unique link.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Links can be created before a campaign starts. Respondents will still only be able to submit during the campaign date window.
                  </p>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Select
                      value={selectedCompany}
                      onValueChange={setSelectedCompany}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5 rounded-sm">
                                  <AvatarImage
                                    src={company.logo_url || undefined}
                                    alt={company.name}
                                    className="object-cover"
                                  />
                                  <AvatarFallback className="rounded-sm bg-muted p-0">
                                    <Building2 className="h-3 w-3 text-muted-foreground" />
                                  </AvatarFallback>
                                </Avatar>
                                <span>{company.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Campaign</Label>
                    <Select
                      value={selectedCampaign}
                      onValueChange={setSelectedCampaign}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCampaigns
                          .map((campaign) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Campaigns with existing links are hidden.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Generate Link"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : links.length === 0 ? (
              <div className="text-center py-8">
                <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No links yet</h3>
                <p className="text-sm text-muted-foreground">
                  Generate your first feedback link to share with companies.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => {
                    const status = getStatus(
                      link.campaign.start_date,
                      link.campaign.end_date,
                      link.is_active,
                    );
                    return (
                      <TableRow key={link.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-md">
                              <AvatarImage
                                src={link.company.logo_url || undefined}
                                alt={link.company.name}
                                className="object-cover"
                              />
                              <AvatarFallback className="rounded-md bg-muted">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{link.company.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium">{link.campaign.name}</p>
                            <p className="text-xs text-muted-foreground">
                              /feedback/{link.unique_code}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>{link.access_count}</TableCell>
                        <TableCell>
                          <Switch
                            checked={link.is_active}
                            onCheckedChange={() => handleToggleActive(link)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {futureReleaseFlags.phase2DistributionAndReminders && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDistributionDialog(link)}
                                title="Manage recipients and reminders"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                window.open(
                                  `/feedback/${link.unique_code}?preview=1`,
                                  "_blank",
                                )
                              }
                              title="Preview form"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyLink(link.unique_code)}
                              title="Copy link"
                              disabled={!link.is_active}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Copy className="h-4 w-4" />
                                  </span>
                                </TooltipTrigger>
                                {!link.is_active && (
                                  <TooltipContent>Activate link to copy URL.</TooltipContent>
                                )}
                              </Tooltip>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                window.open(
                                  `/feedback/${link.unique_code}`,
                                  "_blank",
                                )
                              }
                              title="Open link"
                              disabled={!link.is_active}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <ExternalLink className="h-4 w-4" />
                                  </span>
                                </TooltipTrigger>
                                {!link.is_active && (
                                  <TooltipContent>Activate link to open URL.</TooltipContent>
                                )}
                              </Tooltip>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(link)}
                              title="Delete link"
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

      {futureReleaseFlags.phase2DistributionAndReminders && (
      <Dialog
        open={isDistributionDialogOpen}
        onOpenChange={setIsDistributionDialogOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Distribution & Reminders</DialogTitle>
            <DialogDescription>
              {selectedDistributionLink
                ? `${selectedDistributionLink.campaign.name} · ${selectedDistributionLink.company.name}`
                : "Manage recipients and reminder cadence."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Recipients</p>
                <p className="text-2xl font-semibold">{recipients.length}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="text-2xl font-semibold">
                  {recipients.filter((r) => r.status === "sent").length}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Responded</p>
                <p className="text-2xl font-semibold">
                  {recipients.filter((r) => r.status === "responded").length}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Add Recipients (one email per line or comma separated)</Label>
              <Textarea
                rows={4}
                placeholder={"name@company.com\nanother@company.com"}
                value={recipientInput}
                onChange={(event) => setRecipientInput(event.target.value)}
              />
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Enable reminders</Label>
                <Switch
                  checked={distributionSettings.reminderEnabled}
                  onCheckedChange={(checked) =>
                    setDistributionSettings((prev) => ({
                      ...prev,
                      reminderEnabled: checked,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Reminder interval (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={distributionSettings.reminderIntervalDays}
                    onChange={(event) =>
                      setDistributionSettings((prev) => ({
                        ...prev,
                        reminderIntervalDays: Number(event.target.value || 3),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Max reminders</Label>
                  <Input
                    type="number"
                    min={0}
                    value={distributionSettings.maxReminders}
                    onChange={(event) =>
                      setDistributionSettings((prev) => ({
                        ...prev,
                        maxReminders: Number(event.target.value || 2),
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium">Recipients</p>
              </div>
              <div className="max-h-48 overflow-auto">
                {recipients.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No recipients yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="px-3 py-2 flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">{recipient.email}</span>
                        <Badge variant="outline" className="capitalize">
                          {recipient.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedDistributionLink) return;
                loadDistributionData(selectedDistributionLink);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={handleSaveDistribution}
                disabled={isSavingDistribution}
              >
                {isSavingDistribution ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Save List & Settings
              </Button>
              <Button
                onClick={() => handleDispatch("send_invites")}
                disabled={isDispatchingInvites || recipients.length === 0}
              >
                {isDispatchingInvites ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Invites
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleDispatch("send_reminders")}
                disabled={
                  isDispatchingReminders ||
                  recipients.length === 0 ||
                  !distributionSettings.reminderEnabled
                }
              >
                {isDispatchingReminders ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send Reminders
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
