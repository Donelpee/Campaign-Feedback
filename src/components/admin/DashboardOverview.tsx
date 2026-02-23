import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Building2,
  FileText,
  Loader2,
  Megaphone,
  RefreshCw,
  Activity,
  Gauge,
  Percent,
  CalendarRange,
  Target,
  Bell,
  UserCircle2,
  CalendarDays,
  LayoutDashboard,
  FilterX,
  MessageSquareText,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
} from "lucide-react";
import type { Campaign, CampaignQuestion, Company } from "@/lib/supabase-types";
import { futureReleaseFlags } from "@/config/futureReleaseFlags";

interface LinkWithRelations {
  id: string;
  access_count: number;
  created_at: string;
  company: Company;
  campaign: Campaign;
}

interface ResponseWithDetails {
  id: string;
  created_at: string;
  answers: unknown;
  additional_comments?: string | null;
  link_id: string;
  link: {
    company: Company;
    campaign: Campaign;
  };
}

interface QuestionInsight {
  question: CampaignQuestion;
  totalAnswers: number;
  coveragePercent: number;
  average?: number;
  chartData: Array<{ label: string; value: number }>;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toAnswerMap(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function hasAnswerValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return true;
}

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

function buildQuestionInsight(
  question: CampaignQuestion,
  responses: ResponseWithDetails[],
): QuestionInsight {
  const values = responses.map((r) => toAnswerMap(r.answers)[question.id]);
  const answered = values.filter((v) => hasAnswerValue(v));
  const coveragePercent =
    responses.length > 0 ? (answered.length / responses.length) * 100 : 0;

  if (question.type === "scale" || question.type === "nps" || question.type === "rating") {
    const min = question.min ?? (question.type === "nps" ? 0 : 1);
    const max = question.max ?? (question.type === "rating" ? 5 : 10);
    const numericAnswers = answered
      .map((value) => toNumber(value))
      .filter((value): value is number => value !== null);

    const chartData = Array.from({ length: max - min + 1 }, (_, index) => {
      const bucket = index + min;
      return {
        label: String(bucket),
        value: numericAnswers.filter((v) => Math.round(v) === bucket).length,
      };
    });

    const average =
      numericAnswers.length > 0
        ? numericAnswers.reduce((sum, value) => sum + value, 0) /
          numericAnswers.length
        : 0;

    return {
      question,
      totalAnswers: numericAnswers.length,
      coveragePercent,
      average,
      chartData,
    };
  }

  if (
    question.type === "single_choice" ||
    question.type === "multiple_choice" ||
    question.type === "combobox" ||
    question.type === "rank" ||
    question.type === "checkbox_matrix" ||
    question.type === "radio_matrix"
  ) {
    const counts = new Map<string, number>();
    (question.options || []).forEach((option) => counts.set(option, 0));

    answered.forEach((value) => {
      if (question.type === "checkbox_matrix") {
        if (!value || typeof value !== "object" || Array.isArray(value)) return;
        Object.values(value as Record<string, unknown>).forEach((rowValue) => {
          if (!Array.isArray(rowValue)) return;
          rowValue.forEach((item) => {
            const key = String(item).trim();
            if (!key) return;
            counts.set(key, (counts.get(key) || 0) + 1);
          });
        });
        return;
      }

      if (question.type === "radio_matrix") {
        if (!value || typeof value !== "object" || Array.isArray(value)) return;
        Object.values(value as Record<string, unknown>).forEach((rowValue) => {
          const key = String(rowValue).trim();
          if (!key) return;
          counts.set(key, (counts.get(key) || 0) + 1);
        });
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          const key = String(item).trim();
          if (!key) return;
          counts.set(key, (counts.get(key) || 0) + 1);
        });
      } else {
        const key = String(value).trim();
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    return {
      question,
      totalAnswers: answered.length,
      coveragePercent,
      chartData: Array.from(counts.entries()).map(([label, value]) => ({
        label,
        value,
      })),
    };
  }

  return {
    question,
    totalAnswers: answered.length,
    coveragePercent,
    chartData: [],
  };
}

function daysAgoLabel(dateValue: string): string {
  const date = new Date(dateValue);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function DashboardOverview() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [links, setLinks] = useState<LinkWithRelations[]>([]);
  const [responses, setResponses] = useState<ResponseWithDetails[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [linksRes, responsesRes] = await Promise.all([
        supabase
          .from("company_campaign_links")
          .select(
            "id, access_count, created_at, company:company_id (*), campaign:campaign_id (*)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("feedback_responses")
          .select(
            "id, created_at, answers, additional_comments, link_id, link:link_id ( company:company_id (*), campaign:campaign_id (*) )",
          )
          .order("created_at", { ascending: false }),
      ]);

      if (linksRes.error) throw linksRes.error;
      if (responsesRes.error) throw responsesRes.error;

      const mappedLinks: LinkWithRelations[] = (linksRes.data || [])
        .filter((row) => isRecord(row.company) && isRecord(row.campaign))
        .map((row) => ({
          id: row.id as string,
          access_count: Number(row.access_count || 0),
          created_at: row.created_at as string,
          company: row.company as unknown as Company,
          campaign: {
            ...(row.campaign as unknown as Campaign),
            questions: (((row.campaign as unknown as Campaign).questions ||
              []) as unknown[]) as CampaignQuestion[],
          },
        }));

      const mappedResponses: ResponseWithDetails[] = (responsesRes.data || [])
        .filter((row) => isRecord(row.link))
        .map((row) => {
          const link = row.link as unknown as {
            company: Company;
            campaign: Campaign;
          };
          return {
            id: row.id as string,
            created_at: row.created_at as string,
            answers: row.answers,
            additional_comments:
              (row as { additional_comments?: string | null }).additional_comments ||
              null,
            link_id: row.link_id as string,
            link: {
              company: link.company,
              campaign: {
                ...link.campaign,
                questions: ((link.campaign.questions ||
                  []) as unknown[]) as CampaignQuestion[],
              },
            },
          };
        });

      setLinks(mappedLinks);
      setResponses(mappedResponses);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("feedback-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_responses" },
        () => loadData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    setSelectedCampaign("all");
  }, [selectedCompany]);

  const companyOptions = useMemo(() => {
    const map = new Map<string, Company>();
    links.forEach((link) => {
      map.set(link.company.id, link.company);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [links]);

  const campaignOptions = useMemo(() => {
    const filtered =
      selectedCompany === "all"
        ? links
        : links.filter((link) => link.company.id === selectedCompany);
    const map = new Map<string, Campaign>();
    filtered.forEach((link) => map.set(link.campaign.id, link.campaign));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [links, selectedCompany]);

  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      if (selectedCompany !== "all" && link.company.id !== selectedCompany) return false;
      if (selectedCampaign !== "all" && link.campaign.id !== selectedCampaign) return false;
      return true;
    });
  }, [links, selectedCompany, selectedCampaign]);

  const filteredLinkIds = useMemo(
    () => new Set(filteredLinks.map((link) => link.id)),
    [filteredLinks],
  );

  const filteredResponses = useMemo(
    () => responses.filter((response) => filteredLinkIds.has(response.link_id)),
    [responses, filteredLinkIds],
  );

  const selectedCampaignRecord = useMemo(() => {
    if (selectedCampaign === "all") return null;
    return links.find((link) => link.campaign.id === selectedCampaign)?.campaign || null;
  }, [links, selectedCampaign]);

  const selectedCampaignResponses = useMemo(() => {
    if (!selectedCampaignRecord) return [];
    return filteredResponses.filter(
      (response) => response.link.campaign.id === selectedCampaignRecord.id,
    );
  }, [filteredResponses, selectedCampaignRecord]);

  const overviewKpis = useMemo(() => {
    const totalResponses = filteredResponses.length;
    const totalViews = filteredLinks.reduce((sum, link) => sum + (link.access_count || 0), 0);
    const responseRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;

    const uniqueCampaignIds = new Set(filteredLinks.map((link) => link.campaign.id));
    const activeCampaigns = filteredLinks.filter((link) => {
      const now = new Date();
      const start = new Date(link.campaign.start_date);
      const end = new Date(link.campaign.end_date);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    }).length;

    let completionSum = 0;
    let completionCount = 0;
    filteredResponses.forEach((response) => {
      const questionCount = response.link.campaign.questions?.length || 0;
      if (questionCount <= 0) return;
      const answerMap = toAnswerMap(response.answers);
      const answeredCount = response.link.campaign.questions.filter((question) =>
        hasAnswerValue(answerMap[question.id]),
      ).length;
      completionSum += (answeredCount / questionCount) * 100;
      completionCount += 1;
    });

    const avgCompletion = completionCount > 0 ? completionSum / completionCount : 0;

    const numericAverages: number[] = [];
    filteredResponses.forEach((response) => {
      const answerMap = toAnswerMap(response.answers);
      const values = Object.values(answerMap)
        .map((value) => toNumber(value))
        .filter((value): value is number => value !== null);
      if (values.length > 0) {
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        numericAverages.push(Math.max(0, Math.min(10, avg)));
      }
    });

    const insightScore =
      numericAverages.length > 0
        ? (numericAverages.reduce((sum, value) => sum + value, 0) /
            numericAverages.length) *
          10
        : 0;

    return {
      totalResponses,
      totalViews,
      responseRate,
      activeCampaigns,
      campaignsTracked: uniqueCampaignIds.size,
      avgCompletion,
      insightScore,
    };
  }, [filteredLinks, filteredResponses]);

  const responseTrendData = useMemo(() => {
    const counts = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      counts.set(key, 0);
    }

    filteredResponses.forEach((response) => {
      const key = new Date(response.created_at).toISOString().slice(0, 10);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    return Array.from(counts.entries()).map(([date, value]) => ({
      date: daysAgoLabel(date),
      value,
    }));
  }, [filteredResponses]);

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
    if (!selectedCampaignRecord) return null;

    const selectedLinks = filteredLinks.filter(
      (link) => link.campaign.id === selectedCampaignRecord.id,
    );
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

    const peerLinks = filteredLinks.filter(
      (link) => link.campaign.id !== selectedCampaignRecord.id,
    );
    const peerLinkIds = new Set(peerLinks.map((link) => link.id));
    const peerViews = peerLinks.reduce((sum, link) => sum + (link.access_count || 0), 0);
    const peerResponses = filteredResponses.filter((response) =>
      peerLinkIds.has(response.link_id),
    ).length;
    const peerRate = peerViews > 0 ? (peerResponses / peerViews) * 100 : 0;
    const gap = selectedRate - peerRate;

    return { selectedRate, peerRate, gap };
  }, [filteredLinks, filteredResponses, selectedCampaignRecord]);

  const sentimentInsight = useMemo(() => {
    const collectedText: string[] = [];
    filteredResponses.forEach((response) => {
      if (response.additional_comments?.trim()) {
        collectedText.push(response.additional_comments.trim());
      }
      const answerMap = toAnswerMap(response.answers);
      const campaignQuestions = response.link.campaign.questions || [];
      campaignQuestions.forEach((question) => {
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
        if (trimmed) collectedText.push(trimmed);
      });
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

  const forecastInsight = useMemo(() => {
    const series = responseTrendData.map((item) => item.value);
    return forecastNext7Days(series);
  }, [responseTrendData]);

  const dashboardAlerts = useMemo(() => {
    const alerts: Array<{ severity: "high" | "medium"; message: string }> = [];

    if (overviewKpis.responseRate < 25) {
      alerts.push({
        severity: "high",
        message: `Low conversion: response rate is ${overviewKpis.responseRate.toFixed(1)}%.`,
      });
    }
    if (periodDelta.deltaPercent < -20) {
      alerts.push({
        severity: "medium",
        message: `Responses dropped ${Math.abs(periodDelta.deltaPercent).toFixed(1)}% over the last week.`,
      });
    }
    if (sentimentInsight.total > 0) {
      const negativeRate = (sentimentInsight.negative / sentimentInsight.total) * 100;
      if (negativeRate >= 35) {
        alerts.push({
          severity: "high",
          message: `Negative sentiment is high (${negativeRate.toFixed(0)}% of text feedback).`,
        });
      }
    }
    if (overviewKpis.avgCompletion < 70 && filteredResponses.length >= 5) {
      alerts.push({
        severity: "medium",
        message: `Average completion is ${overviewKpis.avgCompletion.toFixed(0)}%. Form friction likely.`,
      });
    }

    return alerts;
  }, [
    filteredResponses.length,
    overviewKpis.avgCompletion,
    overviewKpis.responseRate,
    periodDelta.deltaPercent,
    sentimentInsight.negative,
    sentimentInsight.total,
  ]);

  const companyRateData = useMemo(() => {
    const map = new Map<string, { responses: number; views: number; name: string }>();
    filteredLinks.forEach((link) => {
      if (!map.has(link.company.id)) {
        map.set(link.company.id, { responses: 0, views: 0, name: link.company.name });
      }
      const stat = map.get(link.company.id)!;
      stat.views += link.access_count || 0;
    });
    filteredResponses.forEach((response) => {
      const stat = map.get(response.link.company.id);
      if (stat) stat.responses += 1;
    });
    return Array.from(map.values())
      .map((item) => ({
        name: item.name,
        value: item.views > 0 ? (item.responses / item.views) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredLinks, filteredResponses]);

  const campaignPerformanceRows = useMemo(() => {
    return filteredLinks
      .map((link) => {
        const campaignResponses = filteredResponses.filter(
          (response) => response.link_id === link.id,
        );
        const responseCount = campaignResponses.length;
        const responseRate =
          (link.access_count || 0) > 0 ? (responseCount / link.access_count) * 100 : 0;

        let completion = 0;
        if (responseCount > 0 && (link.campaign.questions?.length || 0) > 0) {
          const questionCount = link.campaign.questions.length;
          const filled = campaignResponses.reduce((sum, response) => {
            const answerMap = toAnswerMap(response.answers);
            return (
              sum +
              link.campaign.questions.filter((question) =>
                hasAnswerValue(answerMap[question.id]),
              ).length
            );
          }, 0);
          completion = (filled / (responseCount * questionCount)) * 100;
        }

        return {
          companyName: link.company.name,
          campaignName: link.campaign.name,
          responseCount,
          views: link.access_count || 0,
          responseRate,
          completion,
          lastResponse:
            campaignResponses.length > 0
              ? campaignResponses[0].created_at
              : null,
        };
      })
      .sort((a, b) => b.responseCount - a.responseCount);
  }, [filteredLinks, filteredResponses]);

  const questionInsights = useMemo(() => {
    if (!selectedCampaignRecord) return [];
    return selectedCampaignRecord.questions.map((question) =>
      buildQuestionInsight(question, selectedCampaignResponses),
    );
  }, [selectedCampaignRecord, selectedCampaignResponses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="template-topbar sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="hidden md:flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <Bell className="h-5 w-5" />
          <div className="flex items-center gap-2 font-medium text-foreground">
            <UserCircle2 className="h-5 w-5" />
            <span>System Administrator</span>
          </div>
        </div>
      </header>

      <main className="template-content flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-8 w-8 text-foreground" />
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Overview of campaign and feedback performance
            </p>
          </div>

          <Card className="template-panel">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto] items-end">
              <div className="space-y-2">
                <p className="text-sm font-medium">Company</p>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companyOptions.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Campaign</p>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Campaigns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {campaignOptions.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={loadData} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Apply Filter
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedCompany("all");
                    setSelectedCampaign("all");
                  }}
                >
                  <FilterX className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="metric-tile metric-blue">
              <CardHeader className="px-2.5 pt-2.5 pb-0">
                <CardTitle className="kpi-label">Responses</CardTitle>
              </CardHeader>
              <CardContent className="px-2.5 pb-2.5 pt-0.5">
                <div className="kpi-metric">
                  <div className="metric-value">{overviewKpis.totalResponses}</div>
                  <FileText className="metric-icon" />
                </div>
              </CardContent>
            </Card>

            <Card className="metric-tile metric-green">
              <CardHeader className="px-2.5 pt-2.5 pb-0">
                <CardTitle className="kpi-label">Link Views</CardTitle>
              </CardHeader>
              <CardContent className="px-2.5 pb-2.5 pt-0.5">
                <div className="kpi-metric">
                  <div className="metric-value">{overviewKpis.totalViews}</div>
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
                  <div className="metric-value">{overviewKpis.responseRate.toFixed(1)}%</div>
                  <Percent className="metric-icon" />
                </div>
              </CardContent>
            </Card>

            <Card className="metric-tile metric-amber">
              <CardHeader className="px-2.5 pt-2.5 pb-0">
                <CardTitle className="kpi-label">Active Campaigns</CardTitle>
              </CardHeader>
              <CardContent className="px-2.5 pb-2.5 pt-0.5">
                <div className="kpi-metric">
                  <div className="metric-value">{overviewKpis.activeCampaigns}</div>
                  <CalendarRange className="metric-icon" />
                </div>
              </CardContent>
            </Card>

            <Card className="metric-tile metric-red">
              <CardHeader className="px-2.5 pt-2.5 pb-0">
                <CardTitle className="kpi-label">Form Completion</CardTitle>
              </CardHeader>
              <CardContent className="px-2.5 pb-2.5 pt-0.5">
                <div className="kpi-metric">
                  <div className="metric-value">{overviewKpis.avgCompletion.toFixed(0)}%</div>
                  <Target className="metric-icon" />
                </div>
              </CardContent>
            </Card>

            <Card className="metric-tile metric-blue">
              <CardHeader className="px-2.5 pt-2.5 pb-0">
                <CardTitle className="kpi-label">Insight Score</CardTitle>
              </CardHeader>
              <CardContent className="px-2.5 pb-2.5 pt-0.5">
                <div className="kpi-metric">
                  <div className="metric-value">{overviewKpis.insightScore.toFixed(0)}</div>
                  <Gauge className="metric-icon" />
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel-card">
              <CardHeader>
                <CardTitle>Response Trend (14 Days)</CardTitle>
                <CardDescription>Daily submitted responses in current scope.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={responseTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="panel-card">
              <CardHeader>
                <CardTitle>Company Response Rate</CardTitle>
                <CardDescription>Top companies by conversion from link views to responses.</CardDescription>
              </CardHeader>
              <CardContent>
                {companyRateData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No response-rate data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={companyRateData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis type="category" dataKey="name" className="text-xs" width={110} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {futureReleaseFlags.phase3To5AdvancedAnalytics && (
              <Card className="panel-card">
                <CardHeader>
                  <CardTitle>Text Sentiment Mix</CardTitle>
                  <CardDescription>
                    Sentiment from comments and text fields in current scope.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sentimentInsight.total === 0 ? (
                    <p className="text-sm text-muted-foreground">No text feedback yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={sentimentInsight.chartData.filter((item) => item.value > 0)}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={82}
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
              <CardTitle>Action Alerts</CardTitle>
              <CardDescription>
                Proactive risk detection from conversion, trend, completion, and sentiment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No risk alerts in the current scope.
                </p>
              ) : (
                <div className="space-y-2">
                  {dashboardAlerts.map((alert, index) => (
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

          <Card className="panel-card">
            <CardHeader>
              <CardTitle>Campaign Performance Matrix</CardTitle>
              <CardDescription>
                Useful for client reporting: volume, conversion, completion quality, and recency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignPerformanceRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No campaign performance data yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Responses</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Last Response</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignPerformanceRows.map((row, index) => (
                      <TableRow key={`${row.companyName}-${row.campaignName}-${index}`}>
                        <TableCell className="font-medium">{row.companyName}</TableCell>
                        <TableCell>{row.campaignName}</TableCell>
                        <TableCell>{row.responseCount}</TableCell>
                        <TableCell>{row.views}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.responseRate.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell>{row.completion.toFixed(0)}%</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.lastResponse
                            ? new Date(row.lastResponse).toLocaleString()
                            : "No responses"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedCampaignRecord && futureReleaseFlags.phase3To5AdvancedAnalytics && (
            <Card className="panel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Question Insights: {selectedCampaignRecord.name}
                </CardTitle>
                <CardDescription>
                  Deep-dive analytics for the selected campaign's question set.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {questionInsights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No dynamic questions configured for this campaign.
                  </p>
                ) : (
                  questionInsights.map((insight) => (
                    <div key={insight.question.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <p className="font-medium text-sm">{insight.question.question}</p>
                        <Badge variant="secondary" className="capitalize">
                          {insight.question.type.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline">
                          Coverage {insight.coveragePercent.toFixed(0)}%
                        </Badge>
                        {typeof insight.average === "number" && (
                          <Badge variant="outline">Avg {insight.average.toFixed(1)}</Badge>
                        )}
                      </div>

                      {insight.chartData.length > 0 ? (
                        insight.question.type === "single_choice" ||
                        insight.question.type === "multiple_choice" ||
                        insight.question.type === "combobox" ||
                        insight.question.type === "rank" ||
                        insight.question.type === "checkbox_matrix" ||
                        insight.question.type === "radio_matrix" ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie
                                data={insight.chartData.filter((item) => item.value > 0)}
                                dataKey="value"
                                nameKey="label"
                                cx="50%"
                                cy="50%"
                                outerRadius={82}
                                label={({ percent }) =>
                                  percent && percent > 0
                                    ? `${(percent * 100).toFixed(0)}%`
                                    : ""
                                }
                              >
                                {insight.chartData
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
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={insight.chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis className="text-xs" allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Text responses are available in the Responses page detail view.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="metric-tile metric-green">
              <CardHeader className="px-2.5 pt-2.5 pb-0">
                <CardTitle className="kpi-label">Companies in Scope</CardTitle>
              </CardHeader>
              <CardContent className="px-2.5 pb-2.5 pt-0.5">
                <div className="kpi-metric">
                  <div className="metric-value">
                    {new Set(filteredLinks.map((link) => link.company.id)).size}
                  </div>
                  <Building2 className="metric-icon" />
                </div>
              </CardContent>
            </Card>

            <Card className="metric-tile metric-blue">
              <CardHeader className="px-2.5 pt-2.5 pb-0">
                <CardTitle className="kpi-label">Campaigns in Scope</CardTitle>
              </CardHeader>
              <CardContent className="px-2.5 pb-2.5 pt-0.5">
                <div className="kpi-metric">
                  <div className="metric-value">
                    {new Set(filteredLinks.map((link) => link.campaign.id)).size}
                  </div>
                  <Megaphone className="metric-icon" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
