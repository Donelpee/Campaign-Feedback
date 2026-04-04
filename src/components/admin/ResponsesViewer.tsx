import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Download,
  Loader2,
  FileText,
  Star,
  RefreshCw,
  Search,
  Building2,
  Megaphone,
  ArrowRight,
  Eye,
  Gauge,
  Percent,
  Activity,
  Clock3,
  LayoutDashboard,
  FilterX,
  MessageSquareText,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from "lucide-react";
import { FileSpreadsheet } from "lucide-react";
import type {
  Company,
  Campaign,
  CampaignQuestion,
  UploadedFileAnswer,
} from "@/lib/supabase-types";
import { futureReleaseFlags } from "@/config/futureReleaseFlags";
import { normalizeCampaignSurvey } from "@/lib/campaign-survey";
import {
  buildCampaignBriefRequests,
  buildFallbackCampaignReportBriefs,
  type CampaignReportBrief,
} from "@/lib/campaign-report-briefs";
import {
  findOtherOptionLabel,
  getOtherAnswerText,
  getQuestionIdFromOtherAnswerKey,
} from "@/lib/campaign-answer-utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface LinkWithRelations {
  id: string;
  company_id: string;
  campaign_id: string;
  access_count?: number;
  company: Company;
  campaign: Campaign;
}

interface ResponseWithDetails {
  id: string;
  link_id: string;
  overall_satisfaction: number;
  service_quality: number;
  recommendation_likelihood: number;
  improvement_areas: string[];
  additional_comments: string | null;
  answers?: Record<string, unknown>;
  created_at: string;
  link: {
    company: Company;
    campaign: Campaign;
  };
}

interface RawLinkRow {
  id: string;
  company_id: string;
  campaign_id: string;
  company: Company;
  campaign: Campaign;
}

interface ResponsePageRow {
  id: string;
  link_id: string;
  overall_satisfaction: number;
  service_quality: number;
  recommendation_likelihood: number;
  improvement_areas: string[];
  additional_comments: string | null;
  answers?: Record<string, unknown>;
  created_at: string;
  company_id: string;
  company_name: string;
  company_logo_url: string | null;
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  campaign_questions: Campaign["questions"];
  total_count: number;
}

type CampaignWithCompany = Campaign & { companyName?: string };

interface ViewerSettings {
  compactView: boolean;
  showResponseTimestamps: boolean;
}

interface AnalyticsSummary {
  totalResponses: number;
  viewsInScope: number;
  responseRate: number;
  avgOverall: number;
  avgService: number;
  avgCompletion: number;
}

interface CampaignSummary {
  campaignId: string;
  campaignName: string;
  companyName: string;
  responses: number;
  views: number;
  responseRate: number;
  completionRate: number;
}

interface QuestionInfographic {
  id: string;
  question: string;
  type: string;
  chartData: Array<{ label: string; value: number }>;
}

const RESPONSE_PAGE_SIZE = 50;

const questionTypeLabels: Record<string, string> = {
  rating: "Rating",
  scale: "Linear Scale",
  multiple_choice: "Checkbox",
  single_choice: "Radio",
  combobox: "Combobox",
  checkbox_matrix: "Checkbox Matrix",
  radio_matrix: "Radio Matrix",
  textbox: "Textbox",
  textarea: "Textarea",
  date: "Date",
  file_upload: "File Upload",
  rank: "Rank",
  label: "Label",
  text: "Text",
  nps: "NPS",
};

const areaLabels: Record<string, string> = {
  communication: "Communication",
  response_time: "Response Time",
  product_quality: "Product Quality",
  customer_service: "Customer Service",
  pricing: "Pricing",
  technical_support: "Technical Support",
  delivery: "Delivery",
  documentation: "Documentation",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

const POSITIVE_WORDS = [
  "good",
  "great",
  "excellent",
  "love",
  "helpful",
  "fast",
  "easy",
  "happy",
  "satisfied",
  "amazing",
];

const NEGATIVE_WORDS = [
  "bad",
  "poor",
  "slow",
  "hard",
  "difficult",
  "delay",
  "issue",
  "problem",
  "angry",
  "frustrated",
  "unsatisfied",
];

function toNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasAnswerValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function isUploadedFileAnswers(value: unknown): value is UploadedFileAnswer[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "path" in entry &&
        "bucket" in entry &&
        "originalName" in entry,
    )
  );
}

function normalizeText(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreSentiment(text: string): number {
  const tokens = normalizeText(text);
  if (tokens.length === 0) return 0;
  let score = 0;
  tokens.forEach((token) => {
    if (POSITIVE_WORDS.includes(token)) score += 1;
    if (NEGATIVE_WORDS.includes(token)) score -= 1;
  });
  return score;
}

function extractResponseText(response: ResponseWithDetails): string[] {
  const texts: string[] = [];
  if (response.additional_comments?.trim()) {
    texts.push(response.additional_comments.trim());
  }
  const answerMap = (response.answers || {}) as Record<string, unknown>;
  const questions = response.link.campaign.questions || [];
  questions.forEach((question) => {
    if (
      question.type !== "text" &&
      question.type !== "textbox" &&
      question.type !== "textarea"
    ) {
      return;
    }
    const value = answerMap[question.id];
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed) texts.push(trimmed);
  });
  questions.forEach((question) => {
    const otherDetails = getOtherAnswerText(answerMap, question.id).trim();
    if (otherDetails) {
      texts.push(otherDetails);
    }
  });
  return texts;
}

function forecastNext7Days(series: number[]): { next7: number; dailyAverage: number } {
  if (series.length === 0) return { next7: 0, dailyAverage: 0 };
  if (series.length === 1) {
    const base = Math.max(0, series[0]);
    return { next7: base * 7, dailyAverage: base };
  }

  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (series[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator > 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  let next7 = 0;
  for (let i = n; i < n + 7; i++) {
    next7 += Math.max(0, slope * i + intercept);
  }
  return { next7, dailyAverage: next7 / 7 };
}

function mapResponsePageRow(row: ResponsePageRow): ResponseWithDetails {
  const survey = normalizeCampaignSurvey(row.campaign_questions);
  return {
    id: row.id,
    link_id: row.link_id,
    overall_satisfaction: row.overall_satisfaction,
    service_quality: row.service_quality,
    recommendation_likelihood: row.recommendation_likelihood,
    improvement_areas: row.improvement_areas || [],
    additional_comments: row.additional_comments,
    answers: (row.answers || {}) as Record<string, unknown>,
    created_at: row.created_at,
    link: {
      company: {
        id: row.company_id,
        name: row.company_name,
        logo_url: row.company_logo_url,
      } as Company,
      campaign: {
        id: row.campaign_id,
        name: row.campaign_name,
        campaign_type: row.campaign_type as Campaign["campaign_type"],
        sections: survey.sections,
        questions: survey.questions,
      } as Campaign,
    },
  };
}

export function ResponsesViewer() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [responses, setResponses] = useState<ResponseWithDetails[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [links, setLinks] = useState<LinkWithRelations[]>([]);
  const [selectedResponse, setSelectedResponse] =
    useState<ResponseWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterCampaign, setFilterCampaign] = useState<string>("all");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResponsesCount, setTotalResponsesCount] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    totalResponses: 0,
    viewsInScope: 0,
    responseRate: 0,
    avgOverall: 0,
    avgService: 0,
    avgCompletion: 0,
  });
  const [campaignSummaries, setCampaignSummaries] = useState<CampaignSummary[]>([]);
  const [questionInfographics, setQuestionInfographics] = useState<QuestionInfographic[]>([]);
  const [viewerSettings, setViewerSettings] = useState<ViewerSettings>({
    compactView: false,
    showResponseTimestamps: true,
  });

  const loadViewerSettings = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("user_settings")
      .select("compact_view, show_response_timestamps")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading response viewer settings:", error);
      return;
    }

    if (data) {
      setViewerSettings({
        compactView: data.compact_view,
        showResponseTimestamps: data.show_response_timestamps,
      });
    }
  }, [user?.id]);

  const loadData = useCallback(async () => {
    try {
      const companyId = filterCompany === "all" ? null : filterCompany;
      const campaignId = filterCampaign === "all" ? null : filterCampaign;
      const offset = (currentPage - 1) * RESPONSE_PAGE_SIZE;

      const [responsesRes, summaryRes, companiesRes, linksRes] = await Promise.all([
        supabase.rpc("get_feedback_response_page", {
          p_company_id: companyId,
          p_campaign_id: campaignId,
          p_limit: RESPONSE_PAGE_SIZE,
          p_offset: offset,
        }),
        supabase.rpc("get_feedback_response_summary", {
          p_company_id: companyId,
          p_campaign_id: campaignId,
        }),
        supabase.from("companies").select("*").order("name"),
        supabase
          .from("company_campaign_links")
          .select(
            `id, company_id, campaign_id, access_count, company:company_id (*), campaign:campaign_id (*)`,
          )
          .order("created_at", { ascending: false }),
      ]);

      if (responsesRes.error) throw responsesRes.error;
      if (summaryRes.error) throw summaryRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (linksRes.error) throw linksRes.error;

      const pageRows = (responsesRes.data || []) as ResponsePageRow[];
      const summaryData = (summaryRes.data || {}) as {
        analytics?: Partial<AnalyticsSummary>;
        campaigns?: CampaignSummary[];
      };

      const nextAnalytics = {
        totalResponses: Number(summaryData.analytics?.totalResponses || 0),
        viewsInScope: Number(summaryData.analytics?.viewsInScope || 0),
        responseRate: Number(summaryData.analytics?.responseRate || 0),
        avgOverall: Number(summaryData.analytics?.avgOverall || 0),
        avgService: Number(summaryData.analytics?.avgService || 0),
        avgCompletion: Number(summaryData.analytics?.avgCompletion || 0),
      };

      setResponses(pageRows.map(mapResponsePageRow));
      setTotalResponsesCount(nextAnalytics.totalResponses);
      setAnalytics(nextAnalytics);
      setCampaignSummaries((summaryData.campaigns || []) as CampaignSummary[]);
      setCompanies((companiesRes.data || []) as Company[]);
      setLinks(
        ((linksRes.data || []) as RawLinkRow[]).map((row) => {
          const survey = normalizeCampaignSurvey(row.campaign.questions);
          return {
            id: row.id,
            company_id: row.company_id,
            campaign_id: row.campaign_id,
            access_count: (row as unknown as { access_count?: number }).access_count || 0,
            company: row.company,
            campaign: {
              ...row.campaign,
              campaign_type: row.campaign
                .campaign_type as Campaign["campaign_type"],
              sections: survey.sections,
              questions: survey.questions,
            },
          };
        }),
      );
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load responses.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filterCampaign, filterCompany, toast]);

  useEffect(() => {
    loadViewerSettings();
  }, [loadViewerSettings]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("feedback-responses")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_responses" },
        () => {
          loadData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Reset campaign filter when company changes
  useEffect(() => {
    setFilterCampaign("all");
    setCampaignSearch("");
  }, [filterCompany]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedResponse(null);
  }, [filterCompany, filterCampaign]);

  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(totalResponsesCount / RESPONSE_PAGE_SIZE));
    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [currentPage, totalResponsesCount]);

  // Campaigns for the selected company (deduplicated)
  const campaignsForCompany = useMemo(() => {
    const filtered =
      filterCompany === "all"
        ? links
        : links.filter((l) => l.company_id === filterCompany);
    const seen = new Set<string>();
    const result: CampaignWithCompany[] = [];
    for (const l of filtered) {
      if (!seen.has(l.campaign_id)) {
        seen.add(l.campaign_id);
        result.push({ ...l.campaign, companyName: l.company.name });
      }
    }
    return result;
  }, [links, filterCompany]);

  // Search-filtered campaigns
  const searchedCampaigns = useMemo(() => {
    if (!campaignSearch.trim()) return campaignsForCompany;
    const q = campaignSearch.toLowerCase();
    return campaignsForCompany.filter((c) => c.name.toLowerCase().includes(q));
  }, [campaignsForCompany, campaignSearch]);

  const filteredResponses = responses;

  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      map.set(date.toISOString().slice(0, 10), 0);
    }

    filteredResponses.forEach((response) => {
      const key = new Date(response.created_at).toISOString().slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries()).map(([date, responses]) => ({
      date: date.slice(5),
      responses,
    }));
  }, [filteredResponses]);

  const campaignVolumeData = useMemo(
    () =>
      campaignSummaries
        .map((campaign) => ({
          name: campaign.campaignName,
          responses: campaign.responses,
        }))
        .sort((a, b) => b.responses - a.responses)
        .slice(0, 8),
    [campaignSummaries],
  );

  const responseCountByCampaign = useMemo(
    () =>
      new Map(
        campaignSummaries.map((campaign) => [campaign.campaignId, campaign.responses]),
      ),
    [campaignSummaries],
  );

  const totalPages = Math.max(1, Math.ceil(totalResponsesCount / RESPONSE_PAGE_SIZE));
  const pageStart = totalResponsesCount === 0 ? 0 : (currentPage - 1) * RESPONSE_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * RESPONSE_PAGE_SIZE, totalResponsesCount);

  const periodDelta = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(now.getDate() - 7);
    const previousStart = new Date(now);
    previousStart.setDate(now.getDate() - 14);

    const currentCount = filteredResponses.filter(
      (response) => new Date(response.created_at) >= currentStart,
    ).length;
    const previousCount = filteredResponses.filter((response) => {
      const created = new Date(response.created_at);
      return created >= previousStart && created < currentStart;
    }).length;

    const deltaPercent =
      previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : currentCount > 0
          ? 100
          : 0;

    return { currentCount, previousCount, deltaPercent };
  }, [filteredResponses]);

  const benchmarkInsight = useMemo(() => {
    if (filterCampaign === "all") return null;

    const selectedLinks = links.filter((link) => {
      if (link.campaign_id !== filterCampaign) return false;
      if (filterCompany !== "all" && link.company_id !== filterCompany) return false;
      return true;
    });
    const selectedLinkIds = new Set(selectedLinks.map((link) => link.id));
    const selectedViews = selectedLinks.reduce(
      (sum, link) => sum + (link.access_count || 0),
      0,
    );
    const selectedResponses = filteredResponses.filter((response) =>
      selectedLinkIds.has(response.link_id),
    ).length;
    const selectedRate =
      selectedViews > 0 ? (selectedResponses / selectedViews) * 100 : 0;

    const peerLinks = links.filter((link) => {
      if (link.campaign_id === filterCampaign) return false;
      if (filterCompany !== "all" && link.company_id !== filterCompany) return false;
      return true;
    });
    const peerLinkIds = new Set(peerLinks.map((link) => link.id));
    const peerViews = peerLinks.reduce((sum, link) => sum + (link.access_count || 0), 0);
    const peerResponses = responses.filter((response) =>
      peerLinkIds.has(response.link_id),
    ).length;
    const peerRate = peerViews > 0 ? (peerResponses / peerViews) * 100 : 0;
    const gap = selectedRate - peerRate;

    return { selectedRate, peerRate, gap };
  }, [filterCampaign, filterCompany, filteredResponses, links, responses]);

  const sentimentInsight = useMemo(() => {
    const collectedText: string[] = [];
    filteredResponses.forEach((response) => {
      collectedText.push(...extractResponseText(response));
    });

    let positive = 0;
    let neutral = 0;
    let negative = 0;
    collectedText.forEach((text) => {
      const score = scoreSentiment(text);
      if (score > 0) positive += 1;
      else if (score < 0) negative += 1;
      else neutral += 1;
    });

    const total = collectedText.length;
    const scoreIndex =
      total > 0 ? ((positive * 1 + neutral * 0.5) / total) * 100 : 0;

    return {
      total,
      positive,
      neutral,
      negative,
      scoreIndex,
      chartData: [
        { label: "Positive", value: positive },
        { label: "Neutral", value: neutral },
        { label: "Negative", value: negative },
      ],
    };
  }, [filteredResponses]);

  const campaignHealthRows = useMemo(() => {
    return campaignSummaries.map((campaign) => {
      const campaignLinks = links.filter((l) => {
        if (l.campaign_id !== campaign.campaignId) return false;
        if (filterCompany !== "all" && l.company_id !== filterCompany) return false;
        if (filterCampaign !== "all" && l.campaign_id !== filterCampaign) return false;
        return true;
      });
      const views = campaignLinks.reduce((sum, l) => sum + (l.access_count || 0), 0);
      const campaignResponses = filteredResponses.filter(
        (r) => r.link.campaign.id === campaign.campaignId,
      );
      const responseRate = views > 0 ? (campaignResponses.length / views) * 100 : 0;

      const completionRate =
        campaignResponses.length > 0
          ? campaignResponses.reduce((sum, response) => {
              const questions = response.link.campaign.questions || [];
              if (questions.length === 0) return sum;
              const answers = (response.answers || {}) as Record<string, unknown>;
              const answered = questions.filter((q) => hasAnswerValue(answers[q.id])).length;
              return sum + (answered / questions.length) * 100;
            }, 0) / campaignResponses.length
          : 0;

      const sentimentTexts = campaignResponses.flatMap((response) =>
        extractResponseText(response),
      );
      let positive = 0;
      let neutral = 0;
      let negative = 0;
      sentimentTexts.forEach((text) => {
        const score = scoreSentiment(text);
        if (score > 0) positive += 1;
        else if (score < 0) negative += 1;
        else neutral += 1;
      });
      const sentimentIndex =
        sentimentTexts.length > 0
          ? ((positive * 1 + neutral * 0.5) / sentimentTexts.length) * 100
          : 50;

      const healthScore =
        responseRate * 0.4 + completionRate * 0.3 + sentimentIndex * 0.3;
      const risk =
        healthScore >= 75 ? "Low" : healthScore >= 50 ? "Medium" : "High";

      return {
        campaignId: campaign.campaignId,
        companyName: campaign.companyName,
        campaignName: campaign.campaignName,
        responses: campaignResponses.length,
        views,
        responseRate,
        completionRate,
        sentimentIndex,
        healthScore,
        risk,
      };
    });
  }, [
    campaignSummaries,
    filterCampaign,
    filterCompany,
    filteredResponses,
    links,
  ]);

  const forecastInsight = useMemo(() => {
    const series = trendData.map((item) => item.responses);
    return forecastNext7Days(series);
  }, [trendData]);

  const recommendations = useMemo(() => {
    const output: string[] = [];
    const topRisk = [...campaignHealthRows].sort(
      (a, b) => a.healthScore - b.healthScore,
    )[0];
    if (topRisk && topRisk.risk !== "Low") {
      output.push(
        `${topRisk.campaignName}: prioritize rescue plan (health ${topRisk.healthScore.toFixed(0)}).`,
      );
    }
    if (analytics.responseRate < 25) {
      output.push("Launch reminder sequence and shorten form to improve conversion.");
    }
    if (analytics.avgCompletion < 70) {
      output.push("Reduce required fields and move sensitive questions to the end.");
    }
    if (sentimentInsight.total > 0) {
      const negativeShare = (sentimentInsight.negative / sentimentInsight.total) * 100;
      if (negativeShare >= 35) {
        output.push("Run text-topic review for negative comments and assign owners per theme.");
      }
    }
    if (forecastInsight.next7 < 5 && filteredResponses.length > 0) {
      output.push("Predicted low response volume: increase distribution channels this week.");
    }
    if (output.length === 0) {
      output.push("Current health is stable; keep cadence and monitor weekly trend deltas.");
    }
    return output.slice(0, 5);
  }, [
    analytics.avgCompletion,
    analytics.responseRate,
    campaignHealthRows,
    filteredResponses.length,
    forecastInsight.next7,
    sentimentInsight.negative,
    sentimentInsight.total,
  ]);

  const responseAlerts = useMemo(() => {
    const alerts: Array<{ severity: "high" | "medium"; message: string }> = [];

    if (analytics.responseRate < 25) {
      alerts.push({
        severity: "high",
        message: `Low response rate (${analytics.responseRate.toFixed(1)}%). Consider reminder nudges and shorter forms.`,
      });
    }
    if (periodDelta.deltaPercent < -20) {
      alerts.push({
        severity: "medium",
        message: `Response trend declined ${Math.abs(periodDelta.deltaPercent).toFixed(1)}% vs previous 7 days.`,
      });
    }
    if (sentimentInsight.total > 0) {
      const negativeRate = (sentimentInsight.negative / sentimentInsight.total) * 100;
      if (negativeRate >= 35) {
        alerts.push({
          severity: "high",
          message: `Negative sentiment is elevated (${negativeRate.toFixed(0)}% of text feedback).`,
        });
      }
    }
    if (analytics.avgCompletion < 70 && filteredResponses.length >= 5) {
      alerts.push({
        severity: "medium",
        message: `Form completion is low (${analytics.avgCompletion.toFixed(0)}%). Review required fields and question order.`,
      });
    }

    return alerts;
  }, [
    analytics.avgCompletion,
    analytics.responseRate,
    filteredResponses.length,
    periodDelta.deltaPercent,
    sentimentInsight.negative,
    sentimentInsight.total,
  ]);

  const loadAllResponsesForExport = useCallback(async () => {
    const exportRows: ResponseWithDetails[] = [];
    let offset = 0;
    let totalCount = 0;

    do {
      const { data, error } = await supabase.rpc("get_feedback_response_page", {
        p_company_id: filterCompany === "all" ? null : filterCompany,
        p_campaign_id: filterCampaign === "all" ? null : filterCampaign,
        p_limit: 500,
        p_offset: offset,
      });

      if (error) throw error;

      const pageRows = (data || []) as ResponsePageRow[];
      totalCount = pageRows[0]?.total_count || totalCount;
      exportRows.push(...pageRows.map(mapResponsePageRow));
      offset += pageRows.length;

      if (pageRows.length === 0) break;
    } while (offset < totalCount);

    return exportRows;
  }, [filterCampaign, filterCompany]);

  const loadCampaignReportBriefs = useCallback(
    async (
      exportData: Array<{
        campaign_id: string;
        company_id: string;
        company_name: string;
        campaign_name: string;
        created_at: string;
        satisfaction_value: number | null;
        quality_value: number | null;
        recommendation_score: number | null;
        improvement_areas: string[];
        additional_comments: string | null;
        answers: Record<string, unknown>;
        campaign_questions: CampaignQuestion[];
      }>,
      metricsByCampaign: Array<{
        campaign_id: string;
        company_id: string;
        company_name: string;
        campaign_name: string;
        responses: number;
        views: number;
        response_rate: number;
        completion_rate: number;
        sentiment_index?: number;
        health_score?: number;
        risk?: string;
      }>,
    ): Promise<CampaignReportBrief[]> => {
      const requests = buildCampaignBriefRequests(exportData, metricsByCampaign);
      const fallbackBriefs = buildFallbackCampaignReportBriefs(requests);

      if (requests.length === 0) {
        return fallbackBriefs;
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-campaign-report-briefs",
          {
            body: { campaigns: requests },
          },
        );

        if (error) {
          console.error("Error generating campaign report briefs:", error);
          return fallbackBriefs;
        }

        const remoteBriefs = Array.isArray(
          (data as { briefs?: unknown } | null)?.briefs,
        )
          ? ((data as { briefs: CampaignReportBrief[] }).briefs || [])
          : [];

        if (remoteBriefs.length === 0) {
          return fallbackBriefs;
        }

        const remoteByCampaignId = new Map(
          remoteBriefs
            .filter((brief) => brief && typeof brief.campaignId === "string")
            .map((brief) => [brief.campaignId, brief]),
        );

        return fallbackBriefs.map(
          (brief) => remoteByCampaignId.get(brief.campaignId) || brief,
        );
      } catch (error) {
        console.error("Unexpected campaign brief generation error:", error);
        return fallbackBriefs;
      }
    },
    [],
  );

  const handleExportCSV = () => {
    if (totalResponsesCount === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No responses to export.",
      });
      return;
    }
    setIsExporting(true);
    loadAllResponsesForExport()
      .then((exportResponses) => {
        const headers = [
          "Company",
          "Campaign",
          "Overall Satisfaction",
          "Service Quality",
          "Recommendation",
          "Improvement Areas",
          "Comments",
          "Date",
        ];
        const rows = exportResponses.map((r) => {
          const metrics = getDisplayMetrics(r);
          const shownAreas =
            metrics.dynamicAreas.length > 0
              ? metrics.dynamicAreas
              : r.improvement_areas || [];
          return [
            r.link.company.name,
            r.link.campaign.name,
            metrics.satisfactionValue !== null
              ? `${metrics.satisfactionValue}/${metrics.satisfactionMax}`
              : `${r.overall_satisfaction}/10`,
            metrics.qualityValue !== null
              ? `${metrics.qualityValue}/${metrics.qualityMax}`
              : `${r.service_quality}/5`,
            metrics.npsValue !== null
              ? `${Math.round(metrics.npsValue)}/10`
              : getLikertLabel(r.recommendation_likelihood),
            shownAreas.map((a) => areaLabels[a] || a).join("; "),
            r.additional_comments || "",
            new Date(r.created_at).toLocaleString(),
          ];
        });

        const campaignRows = campaignSummaries.map((campaign) => [
          campaign.campaignName,
          campaign.responses,
          campaign.views,
          campaign.responseRate.toFixed(1),
          campaign.completionRate.toFixed(1),
        ]);

        const questionRows: Array<(string | number)[]> = [];
        if (filterCampaign !== "all") {
          questionInfographics.forEach((question) => {
            question.chartData.forEach((entry) => {
              questionRows.push([
                selectedCampaignName || "Selected Campaign",
                question.question,
                question.type,
                question.type === "single_choice" ||
                question.type === "multiple_choice" ||
                question.type === "combobox" ||
                question.type === "radio_matrix" ||
                question.type === "checkbox_matrix"
                  ? "pie"
                  : "bar",
                entry.label,
                entry.value,
              ]);
            });
          });
        }

        const csv = [
          ["RAW RESPONSES"],
          headers,
          ...rows,
          [""],
          ["CAMPAIGN KPI DATA (FOR INFOGRAPHICS)"],
          ["Campaign", "Responses", "Views", "Response Rate %", "Completion %"],
          ...campaignRows,
          [""],
          ["QUESTION DISTRIBUTION DATA (FOR INFOGRAPHICS)"],
          ["Campaign", "Question", "Type", "Chart Type", "Answer Option/Value", "Count"],
          ...questionRows,
        ]
          .map((row) =>
            row
              .map((cell) => {
                const str = String(cell);
                if (str.includes(",") || str.includes('"') || str.includes("\n"))
                  return `"${str.replace(/"/g, '""')}"`;
                return str;
              })
              .join(","),
          )
          .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `feedback-responses-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: "Success",
          description: "CSV file downloaded successfully.",
        });
      })
      .catch((error) => {
        console.error("Error exporting CSV:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to generate CSV report.",
        });
      })
      .finally(() => {
        setIsExporting(false);
      });
  };

  const handleExportExcel = async () => {
    if (totalResponsesCount === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No responses to export.",
      });
      return;
    }
    setIsExporting(true);
    try {
      const exportResponses = await loadAllResponsesForExport();
      const data = exportResponses.map((r) => {
        const metrics = getDisplayMetrics(r);
        return {
          id: r.id,
          company_id: r.link.company.id,
          campaign_id: r.link.campaign.id,
          company_name: r.link.company.name,
          campaign_name: r.link.campaign.name,
          created_at: r.created_at,
          satisfaction_value: metrics.satisfactionValue,
          satisfaction_max: metrics.satisfactionMax,
          quality_value: metrics.qualityValue,
          quality_max: metrics.qualityMax,
          recommendation_score: metrics.npsValue,
          recommendation_text:
            metrics.npsValue !== null
              ? `${Math.round(metrics.npsValue)}/10`
              : getLikertLabel(r.recommendation_likelihood),
          improvement_areas:
            metrics.dynamicAreas.length > 0
              ? metrics.dynamicAreas
              : r.improvement_areas || [],
          additional_comments: r.additional_comments,
          answers: (r.answers || {}) as Record<string, unknown>,
          campaign_questions: r.link.campaign.questions || [],
        };
      });

      const metricsByCampaign = campaignSummaries.map((campaign) => {
        const representativeResponse = exportResponses.find(
          (response) => response.link.campaign.id === campaign.campaignId,
        );
        const matchingHealth = campaignHealthRows.find(
          (row) => row.campaignId === campaign.campaignId,
        );
        const matchingLink = links.find((link) => link.campaign_id === campaign.campaignId);

        return {
          campaign_id: campaign.campaignId,
          company_id:
            representativeResponse?.link.company.id ||
            matchingLink?.company_id ||
            "",
          company_name: campaign.companyName,
          campaign_name: campaign.campaignName,
          responses: campaign.responses,
          views: campaign.views,
          response_rate: campaign.responseRate,
          completion_rate: campaign.completionRate,
          sentiment_index: matchingHealth?.sentimentIndex,
          health_score: matchingHealth?.healthScore,
          risk: matchingHealth?.risk,
        };
      });

      const campaignBriefs = await loadCampaignReportBriefs(data, metricsByCampaign);

      const { exportToExcel } = await import("@/lib/excel-export");
      await exportToExcel(
        data,
        metricsByCampaign,
        campaignBriefs,
        {
          periodDelta: {
            currentResponses: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? periodDelta.currentCount
              : 0,
            previousResponses: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? periodDelta.previousCount
              : 0,
            deltaPercent: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? periodDelta.deltaPercent
              : 0,
          },
          benchmark: futureReleaseFlags.phase3To5AdvancedExportInsights && benchmarkInsight
            ? {
                selectedRate: benchmarkInsight.selectedRate,
                benchmarkRate: benchmarkInsight.peerRate,
                gapPercent: benchmarkInsight.gap,
              }
            : null,
          sentiment: {
            scoreIndex: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? sentimentInsight.scoreIndex
              : 0,
            positive: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? sentimentInsight.positive
              : 0,
            neutral: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? sentimentInsight.neutral
              : 0,
            negative: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? sentimentInsight.negative
              : 0,
          },
          forecast: {
            next7Responses: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? forecastInsight.next7
              : 0,
            dailyAverage: futureReleaseFlags.phase3To5AdvancedExportInsights
              ? forecastInsight.dailyAverage
              : 0,
          },
          campaignHealth: futureReleaseFlags.phase3To5AdvancedExportInsights
            ? campaignHealthRows.map((row) => ({
                campaignName: row.campaignName,
                responseRate: row.responseRate,
                completionRate: row.completionRate,
                sentimentIndex: row.sentimentIndex,
                healthScore: row.healthScore,
                risk: row.risk,
              }))
            : [],
          recommendations: futureReleaseFlags.phase3To5AdvancedExportInsights
            ? recommendations
            : [],
        },
        `feedback-report-${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      toast({
        title: "Success",
        description: "Excel report with campaign briefs downloaded successfully.",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate Excel report.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const renderStars = (value: number, max: number = 5) => (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < value ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );

  const getLikertLabel = (value: number) => {
    const labels = [
      "Very Unlikely",
      "Unlikely",
      "Neutral",
      "Likely",
      "Very Likely",
    ];
    return labels[value - 1] || "";
  };

  const getQuestionByType = (
    campaign: Campaign,
    type: "scale" | "rating" | "nps" | "multiple_choice",
  ) => (campaign.questions || []).find((q) => q.type === type);

  const getDisplayMetrics = (response: ResponseWithDetails) => {
    const campaign = response.link.campaign;
    const answers = (response.answers || {}) as Record<string, unknown>;

    const scaleQ = getQuestionByType(campaign, "scale");
    const ratingQ = getQuestionByType(campaign, "rating");
    const npsQ = getQuestionByType(campaign, "nps");
    const multipleQ = getQuestionByType(campaign, "multiple_choice");

    const satisfactionValue = scaleQ
      ? toNumberOrNull(answers[scaleQ.id])
      : null;
    const satisfactionMax = scaleQ?.max ?? 10;

    const qualityValue = ratingQ
      ? toNumberOrNull(answers[ratingQ.id])
      : null;
    const qualityMax = ratingQ?.max ?? 5;

    const npsValue = npsQ ? toNumberOrNull(answers[npsQ.id]) : null;
    const areasValue = multipleQ ? answers[multipleQ.id] : null;
    const multipleOtherOption = multipleQ
      ? findOtherOptionLabel(multipleQ.options)
      : null;
    const multipleOtherDetails = multipleQ
      ? getOtherAnswerText(answers, multipleQ.id).trim()
      : "";
    const dynamicAreas = Array.isArray(areasValue)
      ? areasValue.map((v) => {
          const label = String(v);
          if (
            multipleOtherOption &&
            label === multipleOtherOption &&
            multipleOtherDetails
          ) {
            return `${label}: ${multipleOtherDetails}`;
          }
          return label;
        })
      : [];

    return {
      satisfactionValue,
      satisfactionMax,
      qualityValue,
      qualityMax,
      npsValue,
      dynamicAreas,
    };
  };

  const selectedCompanyName =
    filterCompany === "all"
      ? "All Companies"
      : companies.find((c) => c.id === filterCompany)?.name;
  const selectedCampaignName =
    filterCampaign === "all"
      ? "All Campaigns"
      : campaignsForCompany.find((c) => c.id === filterCampaign)?.name;
  const selectedCampaignForInsights = useMemo(() => {
    if (filterCampaign === "all") return null;
    return campaignsForCompany.find((campaign) => campaign.id === filterCampaign) || null;
  }, [campaignsForCompany, filterCampaign]);

  useEffect(() => {
    let cancelled = false;

    const loadQuestionInfographics = async () => {
      if (!selectedCampaignForInsights) {
        setQuestionInfographics([]);
        return;
      }

      const { data, error } = await supabase.rpc("get_feedback_question_infographics", {
        p_campaign_id: selectedCampaignForInsights.id,
        p_company_id: filterCompany === "all" ? null : filterCompany,
      });

      if (cancelled) return;

      if (error) {
        console.error("Error loading question infographics:", error);
        setQuestionInfographics([]);
        return;
      }

      setQuestionInfographics((data || []) as QuestionInfographic[]);
    };

    loadQuestionInfographics();

    return () => {
      cancelled = true;
    };
  }, [filterCompany, selectedCampaignForInsights]);

  const formatResponseDate = (dateValue: string) =>
    viewerSettings.showResponseTimestamps
      ? new Date(dateValue).toLocaleString()
      : new Date(dateValue).toLocaleDateString();

  const dynamicAnswerEntries = useMemo(() => {
    if (!selectedResponse?.answers) return [];

    const campaignQuestions = Array.isArray(
      selectedResponse.link.campaign.questions,
    )
      ? selectedResponse.link.campaign.questions
      : [];

    const answerMap = selectedResponse.answers as Record<string, unknown>;
    const seen = new Set<string>();

    const orderedFromQuestions = campaignQuestions
      .filter((question) =>
        Object.prototype.hasOwnProperty.call(answerMap, question.id),
      )
      .map((question) => {
        seen.add(question.id);
        return {
          key: question.id,
          question: question.question,
          type: question.type,
          answer: answerMap[question.id],
        };
      });

    const legacyOrExtra = Object.entries(answerMap)
      .filter(([key]) => !seen.has(key) && !getQuestionIdFromOtherAnswerKey(key))
      .map(([key, answer]) => ({
        key,
        question: key,
        type: "unknown",
        answer,
        otherText: "",
      }));

    return [
      ...orderedFromQuestions.map((entry) => {
        const companionText = getOtherAnswerText(answerMap, entry.key).trim();
        return {
          ...entry,
          otherText: companionText,
        };
      }),
      ...legacyOrExtra,
    ];
  }, [selectedResponse]);

  const formatDynamicAnswerValue = (value: unknown, otherText?: string) => {
    if (isUploadedFileAnswers(value)) {
      return value.length > 0
        ? value.map((item) => item.originalName).join(", ")
        : "No file uploaded";
    }
    if (Array.isArray(value)) {
      const mapped = value.map((item) => {
        const label = String(item);
        if (otherText && /^other\b/i.test(label)) {
          return `${label}: ${otherText}`;
        }
        return label;
      });
      return mapped.length > 0
        ? mapped.join(", ")
        : "No selection";
    }
    if (value === null || value === undefined) return "No answer";
    if (typeof value === "object") return JSON.stringify(value);
    const asText = String(value).trim();
    if (!asText.length) return "No answer";
    if (otherText && /^other\b/i.test(asText)) {
      return `${asText}: ${otherText}`;
    }
    return asText;
  };

  const openUploadedFile = async (file: UploadedFileAnswer) => {
    const { data, error } = await supabase.storage
      .from(file.bucket)
      .createSignedUrl(file.path, 60 * 60);

    if (error || !data?.signedUrl) {
      toast({
        variant: "destructive",
        title: "File unavailable",
        description: "Unable to open this uploaded file right now.",
      });
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="template-topbar sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
        </div>
        <div />
      </header>

      {/* Content */}
      <main className="template-content flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-foreground" />
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">Responses</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Response analytics and submission details
          </p>
        </div>

        {/* Breadcrumb-style flow indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span
            className={
              filterCompany !== "all" ? "text-foreground font-medium" : ""
            }
          >
            {selectedCompanyName}
          </span>
          <ArrowRight className="h-3 w-3" />
          <Megaphone className="h-4 w-4" />
          <span
            className={
              filterCampaign !== "all" ? "text-foreground font-medium" : ""
            }
          >
            {selectedCampaignName}
          </span>
          <ArrowRight className="h-3 w-3" />
          <FileText className="h-4 w-4" />
          <span>
            {totalResponsesCount} response
            {totalResponsesCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="metric-tile metric-blue">
            <CardHeader className="px-2.5 pt-2.5 pb-0">
              <CardTitle className="kpi-label">Responses</CardTitle>
            </CardHeader>
            <CardContent className="px-2.5 pb-2.5 pt-0.5">
              <div className="kpi-metric">
                <div className="metric-value">{analytics.totalResponses}</div>
                <FileText className="metric-icon" />
              </div>
            </CardContent>
          </Card>
          <Card className="metric-tile metric-green">
            <CardHeader className="px-2.5 pt-2.5 pb-0">
              <CardTitle className="kpi-label">Views</CardTitle>
            </CardHeader>
            <CardContent className="px-2.5 pb-2.5 pt-0.5">
              <div className="kpi-metric">
                <div className="metric-value">{analytics.viewsInScope}</div>
                <Activity className="metric-icon" />
              </div>
            </CardContent>
          </Card>
          <Card className="metric-tile metric-green">
            <CardHeader className="px-2.5 pt-2.5 pb-0">
              <CardTitle className="kpi-label">Response Rate</CardTitle>
            </CardHeader>
            <CardContent className="px-2.5 pb-2.5 pt-0.5">
              <div className="kpi-metric">
                <div className="metric-value">{analytics.responseRate.toFixed(1)}%</div>
                <Percent className="metric-icon" />
              </div>
            </CardContent>
          </Card>
          <Card className="metric-tile metric-amber">
            <CardHeader className="px-2.5 pt-2.5 pb-0">
              <CardTitle className="kpi-label">Overall Avg</CardTitle>
            </CardHeader>
            <CardContent className="px-2.5 pb-2.5 pt-0.5">
              <div className="kpi-metric">
                <div className="metric-value">{analytics.avgOverall.toFixed(1)}/10</div>
                <Gauge className="metric-icon" />
              </div>
            </CardContent>
          </Card>
          <Card className="metric-tile metric-red">
            <CardHeader className="px-2.5 pt-2.5 pb-0">
              <CardTitle className="kpi-label">Service Avg</CardTitle>
            </CardHeader>
            <CardContent className="px-2.5 pb-2.5 pt-0.5">
              <div className="kpi-metric">
                <div className="metric-value">{analytics.avgService.toFixed(1)}/5</div>
                <Star className="metric-icon" />
              </div>
            </CardContent>
          </Card>
          <Card className="metric-tile metric-blue">
            <CardHeader className="px-2.5 pt-2.5 pb-0">
              <CardTitle className="kpi-label">Completion</CardTitle>
            </CardHeader>
            <CardContent className="px-2.5 pb-2.5 pt-0.5">
              <div className="kpi-metric">
                <div className="metric-value">{analytics.avgCompletion.toFixed(0)}%</div>
                <Clock3 className="metric-icon" />
              </div>
            </CardContent>
          </Card>

          {futureReleaseFlags.phase3To5AdvancedAnalytics && (
            <>
              <Card className="metric-tile metric-amber">
                <CardHeader className="px-2.5 pt-2.5 pb-0">
                  <CardTitle className="kpi-label">7D Response Delta</CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pb-2.5 pt-0.5">
                  <div className="kpi-metric">
                    <div className="metric-value">{periodDelta.deltaPercent.toFixed(1)}%</div>
                    {periodDelta.deltaPercent > 0 ? (
                      <TrendingUp className="metric-icon" />
                    ) : periodDelta.deltaPercent < 0 ? (
                      <TrendingDown className="metric-icon" />
                    ) : (
                      <Minus className="metric-icon" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-tile metric-green">
                <CardHeader className="px-2.5 pt-2.5 pb-0">
                  <CardTitle className="kpi-label">Sentiment Index</CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pb-2.5 pt-0.5">
                  <div className="kpi-metric">
                    <div className="metric-value">{sentimentInsight.scoreIndex.toFixed(0)}</div>
                    <MessageSquareText className="metric-icon" />
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-tile metric-red">
                <CardHeader className="px-2.5 pt-2.5 pb-0">
                  <CardTitle className="kpi-label">Benchmark Gap</CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pb-2.5 pt-0.5">
                  <div className="kpi-metric">
                    <div className="metric-value">
                      {benchmarkInsight ? `${benchmarkInsight.gap.toFixed(1)}%` : "Select Campaign"}
                    </div>
                    <Gauge className="metric-icon" />
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-tile metric-blue">
                <CardHeader className="px-2.5 pt-2.5 pb-0">
                  <CardTitle className="kpi-label">7D Forecast</CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pb-2.5 pt-0.5">
                  <div className="kpi-metric">
                    <div className="metric-value">{forecastInsight.next7.toFixed(0)}</div>
                    <TrendingUp className="metric-icon" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="panel-card">
            <CardHeader>
              <CardTitle className="text-base">Response Trend (14 days)</CardTitle>
              <CardDescription>Daily submissions in current scope.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="responses"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="panel-card">
            <CardHeader>
              <CardTitle className="text-base">Campaign Volume</CardTitle>
              <CardDescription>Top campaigns by response count.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={campaignVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip />
                  <Bar
                    dataKey="responses"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {futureReleaseFlags.phase3To5AdvancedAnalytics && (
          <Card className="panel-card">
            <CardHeader>
              <CardTitle className="text-base">Text Sentiment Mix</CardTitle>
              <CardDescription>
                Sentiment from comments and text answers in current scope.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sentimentInsight.total === 0 ? (
                <p className="text-sm text-muted-foreground">No text feedback yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sentimentInsight.chartData.filter((item) => item.value > 0)}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={74}
                      label={({ percent }) =>
                        percent && percent > 0 ? `${(percent * 100).toFixed(0)}%` : ""
                      }
                    >
                      {sentimentInsight.chartData
                        .filter((item) => item.value > 0)
                        .map((item, index) => (
                          <Cell
                            key={`${item.label}-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          )}
        </div>

        {futureReleaseFlags.phase3To5AdvancedAnalytics && (
        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="text-base">Action Alerts</CardTitle>
            <CardDescription>
              Proactive flags generated from response, completion, and sentiment behavior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {responseAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No risk alerts in the current scope.
              </p>
            ) : (
              <div className="space-y-2">
                {responseAlerts.map((alert, index) => (
                  <div
                    key={`${alert.severity}-${index}`}
                    className="rounded-md border px-3 py-2 flex items-start gap-2"
                  >
                    <AlertTriangle
                      className={`h-4 w-4 mt-0.5 ${
                        alert.severity === "high" ? "text-destructive" : "text-amber-600"
                      }`}
                    />
                    <p className="text-sm">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {futureReleaseFlags.phase3To5AdvancedAnalytics && (
        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="text-base">Campaign Health Scorecard</CardTitle>
            <CardDescription>
              Composite score based on response rate, completion, and sentiment quality.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campaignHealthRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaign health data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignHealthRows.map((row) => (
                      <TableRow key={row.campaignName}>
                        <TableCell className="font-medium">{row.campaignName}</TableCell>
                        <TableCell>{row.responseRate.toFixed(1)}%</TableCell>
                        <TableCell>{row.completionRate.toFixed(1)}%</TableCell>
                        <TableCell>{row.sentimentIndex.toFixed(1)}</TableCell>
                        <TableCell>{row.healthScore.toFixed(1)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.risk === "High"
                                ? "destructive"
                                : row.risk === "Medium"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {row.risk}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {futureReleaseFlags.phase3To5AdvancedAnalytics && (
        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="text-base">Prioritized Recommendations</CardTitle>
            <CardDescription>
              Ranked actions to improve ROI based on current campaign health.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendations.map((item, index) => (
                <div key={`${index}-${item}`} className="rounded-md border px-3 py-2 text-sm">
                  {index + 1}. {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Step 1: Company Selection */}
        <Card className="template-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Select Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 2: Campaign Selection with search */}
        <Card className="template-panel">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Select Campaign
                <Badge variant="secondary" className="ml-1">
                  {campaignsForCompany.length}
                </Badge>
              </CardTitle>
              <div className="relative w-full md:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={loadData}
                  disabled={isLoading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Apply Filter
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFilterCompany("all");
                    setFilterCampaign("all");
                    setCampaignSearch("");
                  }}
                >
                  <FilterX className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {campaignsForCompany.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {filterCompany === "all"
                  ? "No campaigns found."
                  : "No campaigns linked to this company."}
              </p>
            ) : (
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {/* All campaigns option */}
                <button
                  onClick={() => setFilterCampaign("all")}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    filterCampaign === "all"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <p className="font-medium text-sm">All Campaigns</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    View responses from all campaigns
                  </p>
                </button>

                {searchedCampaigns.map((campaign) => {
                  const responseCount = responseCountByCampaign.get(campaign.id) || 0;

                  return (
                    <button
                      key={campaign.id}
                      onClick={() => setFilterCampaign(campaign.id)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        filterCampaign === campaign.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{campaign.name}</p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {responseCount}
                        </Badge>
                      </div>
                      {filterCompany === "all" && campaign.companyName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {campaign.companyName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {campaign.campaign_type?.replace("_", " ")}
                      </p>
                    </button>
                  );
                })}

                {searchedCampaigns.length === 0 && campaignSearch && (
                  <p className="text-sm text-muted-foreground col-span-full py-2 text-center">
                    No campaigns matching "{campaignSearch}"
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle className="text-base">Question Infographics</CardTitle>
            <CardDescription>
              {filterCampaign === "all"
                ? "Select a campaign to view question-level infographics."
                : `Distribution breakdown for ${selectedCampaignName}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filterCampaign === "all" ? (
              <p className="text-sm text-muted-foreground">
                Pick a campaign to view Age/Sex and other question distributions.
              </p>
            ) : questionInfographics.every((item) => item.chartData.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                No question-level data yet for this campaign.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {questionInfographics
                  .filter((item) => item.chartData.length > 0)
                  .map((item) => {
                    const isChoice =
                      item.type === "single_choice" ||
                      item.type === "multiple_choice" ||
                      item.type === "combobox" ||
                      item.type === "radio_matrix" ||
                      item.type === "checkbox_matrix";
                    const pieData = item.chartData.filter((entry) => entry.value > 0);
                    return (
                      <div key={item.id} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{item.question}</p>
                          <Badge variant="outline" className="capitalize">
                            {item.type.replace("_", " ")}
                          </Badge>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                          {isChoice ? (
                            <PieChart>
                              <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="label"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ percent }) =>
                                  percent && percent > 0
                                    ? `${(percent * 100).toFixed(0)}%`
                                    : ""
                                }
                              >
                                {pieData.map((entry, index) => (
                                  <Cell
                                    key={`${entry.label}-${index}`}
                                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          ) : (
                            <BarChart data={item.chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis allowDecimals={false} className="text-xs" />
                              <Tooltip />
                              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Responses Table */}
        <Card className="panel-card">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Feedback Responses</CardTitle>
              <CardDescription>
                {totalResponsesCount} response
                {totalResponsesCount !== 1 ? "s" : ""}
                {filterCompany !== "all" && ` for ${selectedCompanyName}`}
                {filterCampaign !== "all" && ` - ${selectedCampaignName}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button
                  onClick={handleExportCSV}
                  size="sm"
                  disabled={isExporting || totalResponsesCount === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              <Button
                onClick={handleExportExcel}
                size="sm"
                disabled={isExporting || totalResponsesCount === 0}
                variant="secondary"
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredResponses.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No responses yet</h3>
                <p className="text-sm text-muted-foreground">
                  {totalResponsesCount === 0
                    ? "Responses will appear here once staff submit feedback."
                    : "No responses match the current filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-center">
                        Satisfaction
                      </TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Recommendation</TableHead>
                      <TableHead>Improvement Areas</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResponses.map((response) => (
                      (() => {
                        const metrics = getDisplayMetrics(response);
                        const shownAreas =
                          metrics.dynamicAreas.length > 0
                            ? metrics.dynamicAreas
                            : response.improvement_areas || [];

                        return (
                          <TableRow
                            key={response.id}
                            className={viewerSettings.compactView ? "h-10" : ""}
                          >
                            <TableCell className="font-medium">
                              {response.link.company.name}
                            </TableCell>
                            <TableCell>{response.link.campaign.name}</TableCell>
                            <TableCell className="text-center">
                              {metrics.satisfactionValue !== null ? (
                                <Badge
                                  variant={
                                    metrics.satisfactionValue >=
                                    metrics.satisfactionMax * 0.7
                                      ? "default"
                                      : metrics.satisfactionValue >=
                                          metrics.satisfactionMax * 0.4
                                        ? "secondary"
                                        : "destructive"
                                  }
                                >
                                  {metrics.satisfactionValue}/{metrics.satisfactionMax}
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  {response.overall_satisfaction}/10
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {metrics.qualityValue !== null
                                ? renderStars(
                                    Math.round(metrics.qualityValue),
                                    Math.max(1, Math.round(metrics.qualityMax)),
                                  )
                                : renderStars(response.service_quality)}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {metrics.npsValue !== null
                                  ? `${Math.round(metrics.npsValue)}/10`
                                  : getLikertLabel(
                                      response.recommendation_likelihood,
                                    )}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {shownAreas.slice(0, 2).map((area) => (
                                  <Badge
                                    key={area}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {areaLabels[area] || area}
                                  </Badge>
                                ))}
                                {shownAreas.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{shownAreas.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatResponseDate(response.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setSelectedResponse(response)}
                                title="View full response"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })()
                    ))}
                  </TableBody>
                </Table>
                {totalResponsesCount > RESPONSE_PAGE_SIZE && (
                  <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {pageStart}-{pageEnd} of {totalResponsesCount} responses
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1 || isLoading}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled={currentPage >= totalPages || isLoading}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={!!selectedResponse}
          onOpenChange={(open) => !open && setSelectedResponse(null)}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Response Details</DialogTitle>
              <DialogDescription>
                {selectedResponse?.link.company.name} -{" "}
                {selectedResponse?.link.campaign.name}
              </DialogDescription>
            </DialogHeader>

            {selectedResponse && (
              (() => {
                const metrics = getDisplayMetrics(selectedResponse);
                return (
                  <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">
                        Overall Satisfaction
                      </p>
                      <p className="text-lg font-semibold">
                        {metrics.satisfactionValue !== null
                          ? `${metrics.satisfactionValue}/${metrics.satisfactionMax}`
                          : `${selectedResponse.overall_satisfaction}/10`}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">
                        Service Quality
                      </p>
                      <p className="text-lg font-semibold">
                        {metrics.qualityValue !== null
                          ? `${metrics.qualityValue}/${metrics.qualityMax}`
                          : `${selectedResponse.service_quality}/5`}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">
                        Recommendation
                      </p>
                      <p className="text-lg font-semibold">
                        {metrics.npsValue !== null
                          ? `${Math.round(metrics.npsValue)}/10`
                          : getLikertLabel(
                              selectedResponse.recommendation_likelihood,
                            )}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Improvement Areas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {(metrics.dynamicAreas.length > 0
                        ? metrics.dynamicAreas
                        : selectedResponse.improvement_areas || []
                      ).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          None selected
                        </p>
                      ) : (
                        (
                          metrics.dynamicAreas.length > 0
                            ? metrics.dynamicAreas
                            : selectedResponse.improvement_areas || []
                        ).map((area) => (
                          <Badge key={area} variant="outline">
                            {areaLabels[area] || area}
                          </Badge>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Additional Comments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {selectedResponse.additional_comments ||
                        "No additional comments"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Dynamic Answers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dynamicAnswerEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No custom answer payload for this response.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dynamicAnswerEntries.map((entry) => (
                          <div
                            key={entry.key}
                            className="rounded-md border p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-muted-foreground">
                                {entry.question}
                              </p>
                              {entry.type !== "unknown" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {questionTypeLabels[entry.type] || entry.type}
                                </Badge>
                              )}
                            </div>
                            {entry.type === "file_upload" &&
                            isUploadedFileAnswers(entry.answer) ? (
                              <div className="mt-2 space-y-2">
                                {entry.answer.map((file) => (
                                  <div
                                    key={file.path}
                                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {file.originalName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void openUploadedFile(file)}
                                    >
                                      <Download className="mr-2 h-3.5 w-3.5" />
                                      Open
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm mt-1 break-words">
                                {formatDynamicAnswerValue(entry.answer, entry.otherText)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground">
                  Submitted: {formatResponseDate(selectedResponse.created_at)}
                </p>
                  </div>
                );
              })()
            )}
          </DialogContent>
        </Dialog>
        </div>
      </main>
    </div>
  );
}
