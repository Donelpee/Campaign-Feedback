import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  FilterX,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Siren,
} from "lucide-react";

type SystemHealthEvent = Database["public"]["Tables"]["system_health_events"]["Row"];

const PAGE_SIZE = 25;
const LAST_24_HOURS_MS = 24 * 60 * 60 * 1000;

function formatAreaLabel(area: string) {
  return area
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEventTypeLabel(eventType: string) {
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSeverityBadge(severity: string) {
  if (severity === "critical") {
    return {
      variant: "destructive" as const,
      className: "border-red-400/50 bg-red-500/15 text-red-200",
    };
  }

  if (severity === "error") {
    return {
      variant: "destructive" as const,
      className: "border-red-300/40 bg-red-500/10 text-red-100",
    };
  }

  if (severity === "warning") {
    return {
      variant: "secondary" as const,
      className: "border-amber-300/40 bg-amber-500/10 text-amber-100",
    };
  }

  return {
    variant: "outline" as const,
    className: "border-sky-300/40 bg-sky-500/10 text-sky-100",
  };
}

function getStatusBadge(statusCode: number | null) {
  if (statusCode === null) {
    return {
      label: "n/a",
      className: "border-white/20 bg-white/10 text-slate-200",
    };
  }

  if (statusCode >= 500) {
    return {
      label: String(statusCode),
      className: "border-red-300/40 bg-red-500/10 text-red-100",
    };
  }

  if (statusCode >= 400) {
    return {
      label: String(statusCode),
      className: "border-amber-300/40 bg-amber-500/10 text-amber-100",
    };
  }

  return {
    label: String(statusCode),
    className: "border-sky-300/40 bg-sky-500/10 text-sky-100",
  };
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function sanitizeSearchTerm(value: string) {
  return value.replace(/[%_,]/g, " ").trim();
}

export function SystemHealthMonitor() {
  const { toast } = useToast();
  const [events, setEvents] = useState<SystemHealthEvent[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>({});
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedStatusCode, setSelectedStatusCode] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({
    last24hTotal: 0,
    last24hCritical: 0,
    last24hErrors: 0,
    last24hAreas: 0,
  });

  const applyFilters = useCallback(
    (query: ReturnType<typeof supabase.from>) => {
      let nextQuery = query;
      const searchTerm = sanitizeSearchTerm(search);

      if (selectedSeverity !== "all") {
        nextQuery = nextQuery.eq("severity", selectedSeverity);
      }

      if (selectedArea !== "all") {
        nextQuery = nextQuery.eq("area", selectedArea);
      }

      if (selectedStatusCode === "none") {
        nextQuery = nextQuery.is("status_code", null);
      } else if (selectedStatusCode !== "all") {
        nextQuery = nextQuery.eq("status_code", Number(selectedStatusCode));
      }

      if (fromDate) {
        nextQuery = nextQuery.gte("created_at", `${fromDate}T00:00:00.000Z`);
      }

      if (toDate) {
        nextQuery = nextQuery.lte("created_at", `${toDate}T23:59:59.999Z`);
      }

      if (searchTerm) {
        nextQuery = nextQuery.or(
          [
            `message.ilike.%${searchTerm}%`,
            `event_type.ilike.%${searchTerm}%`,
            `area.ilike.%${searchTerm}%`,
            `route.ilike.%${searchTerm}%`,
            `fingerprint.ilike.%${searchTerm}%`,
          ].join(","),
        );
      }

      return nextQuery;
    },
    [fromDate, search, selectedArea, selectedSeverity, selectedStatusCode, toDate],
  );

  const loadMonitoring = useCallback(async () => {
    const isFirstLoad = isLoading && events.length === 0;
    if (!isFirstLoad) {
      setIsRefreshing(true);
    }

    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const last24hIso = new Date(Date.now() - LAST_24_HOURS_MS).toISOString();

      const eventsQuery = applyFilters(
        supabase
          .from("system_health_events")
          .select(
            "id, created_at, source, area, severity, event_type, message, fingerprint, status_code, route, company_id, campaign_id, link_id, metadata",
            { count: "exact" },
          )
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1),
      );

      const [eventsRes, optionsRes, total24hRes, critical24hRes, errors24hRes, areas24hRes] =
        await Promise.all([
          eventsQuery,
          supabase
            .from("system_health_events")
            .select("area, status_code")
            .order("created_at", { ascending: false })
            .limit(300),
          supabase
            .from("system_health_events")
            .select("id", { count: "exact", head: true })
            .gte("created_at", last24hIso),
          supabase
            .from("system_health_events")
            .select("id", { count: "exact", head: true })
            .gte("created_at", last24hIso)
            .eq("severity", "critical"),
          supabase
            .from("system_health_events")
            .select("id", { count: "exact", head: true })
            .gte("created_at", last24hIso)
            .in("severity", ["error", "critical"]),
          supabase
            .from("system_health_events")
            .select("area")
            .gte("created_at", last24hIso)
            .limit(500),
        ]);

      if (eventsRes.error) throw eventsRes.error;
      if (optionsRes.error) throw optionsRes.error;
      if (total24hRes.error) throw total24hRes.error;
      if (critical24hRes.error) throw critical24hRes.error;
      if (errors24hRes.error) throw errors24hRes.error;
      if (areas24hRes.error) throw areas24hRes.error;

      const nextEvents = (eventsRes.data || []) as SystemHealthEvent[];
      const optionRows = optionsRes.data || [];

      setEvents(nextEvents);
      setTotalCount(eventsRes.count || 0);
      setAreaOptions(
        Array.from(
          new Set(
            optionRows
              .map((row) => row.area)
              .filter((value): value is string => typeof value === "string" && value.length > 0),
          ),
        ).sort((left, right) => left.localeCompare(right)),
      );
      setStatusOptions(
        Array.from(
          new Set(
            optionRows
              .map((row) => row.status_code)
              .filter((value): value is number => typeof value === "number"),
          ),
        ).sort((left, right) => left - right),
      );
      setSummary({
        last24hTotal: total24hRes.count || 0,
        last24hCritical: critical24hRes.count || 0,
        last24hErrors: errors24hRes.count || 0,
        last24hAreas: Array.from(
          new Set((areas24hRes.data || []).map((row) => row.area).filter(Boolean)),
        ).length,
      });

      const companyIds = Array.from(
        new Set(nextEvents.map((event) => event.company_id).filter(Boolean)),
      );
      const campaignIds = Array.from(
        new Set(nextEvents.map((event) => event.campaign_id).filter(Boolean)),
      );

      const [companiesRes, campaignsRes] = await Promise.all([
        companyIds.length > 0
          ? supabase.from("companies").select("id, name").in("id", companyIds)
          : Promise.resolve({ data: [], error: null }),
        campaignIds.length > 0
          ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      setCompanyNames(
        Object.fromEntries((companiesRes.data || []).map((row) => [row.id, row.name])),
      );
      setCampaignNames(
        Object.fromEntries((campaignsRes.data || []).map((row) => [row.id, row.name])),
      );
    } catch (error) {
      console.error("Error loading system health events:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load monitoring events.",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [applyFilters, currentPage, events.length, isLoading, toast]);

  useEffect(() => {
    loadMonitoring();

    const channel = supabase
      .channel("system-health-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_health_events" },
        () => {
          loadMonitoring();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMonitoring]);

  const activeFilterCount = useMemo(
    () =>
      [
        search.trim(),
        selectedSeverity !== "all",
        selectedArea !== "all",
        selectedStatusCode !== "all",
        fromDate,
        toDate,
      ].filter(Boolean).length,
    [fromDate, search, selectedArea, selectedSeverity, selectedStatusCode, toDate],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

  const clearFilters = () => {
    setCurrentPage(1);
    setSearch("");
    setSelectedSeverity("all");
    setSelectedArea("all");
    setSelectedStatusCode("all");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="glass-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">System Monitoring</h1>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8">
        <div className="mx-auto flex w-full min-w-0 max-w-[1320px] flex-col gap-6">
          <Card className="min-w-0 border-white/10 bg-[linear-gradient(135deg,rgba(14,116,144,0.18),rgba(15,23,42,0.94))] text-white">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Activity className="h-6 w-6 text-cyan-300" />
                  System Health Monitor
                </CardTitle>
                <CardDescription className="max-w-3xl text-slate-200">
                  Watch runtime failures, feedback submission issues, edge-function errors,
                  and other operational events as they happen across the app.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-cyan-300/40 bg-cyan-400/10 text-cyan-100">
                  {totalCount} matching events
                </Badge>
                <Button
                  variant="secondary"
                  className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => void loadMonitoring()}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardDescription>Last 24 hours</CardDescription>
                <CardTitle className="text-3xl">{summary.last24hTotal}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Total health events recorded.
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardDescription>Critical Alerts</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl text-red-500">
                  <Siren className="h-6 w-6" />
                  {summary.last24hCritical}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Highest-severity events requiring immediate attention.
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardDescription>Error Pressure</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl text-amber-500">
                  <AlertTriangle className="h-6 w-6" />
                  {summary.last24hErrors}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Combined `error` and `critical` events in the last day.
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardDescription>Affected Areas</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <ShieldAlert className="h-6 w-6 text-cyan-500" />
                  {summary.last24hAreas}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Unique app areas touched by events in the last 24 hours.
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0">
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Filter Events</CardTitle>
                <CardDescription>
                  Narrow the monitoring stream by severity, date range, status code,
                  or affected app area.
                </CardDescription>
              </div>
              {activeFilterCount > 0 && (
                <Badge variant="outline">{activeFilterCount} filters active</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Input
                  placeholder="Search message, event type, route, or fingerprint"
                  value={search}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setSearch(event.target.value);
                  }}
                />

                <Select
                  value={selectedSeverity}
                  onValueChange={(value) => {
                    setCurrentPage(1);
                    setSelectedSeverity(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedArea}
                  onValueChange={(value) => {
                    setCurrentPage(1);
                    setSelectedArea(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All areas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All areas</SelectItem>
                    {areaOptions.map((area) => (
                      <SelectItem key={area} value={area}>
                        {formatAreaLabel(area)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedStatusCode}
                  onValueChange={(value) => {
                    setCurrentPage(1);
                    setSelectedStatusCode(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All status codes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status codes</SelectItem>
                    <SelectItem value="none">No status code</SelectItem>
                    {statusOptions.map((statusCode) => (
                      <SelectItem key={statusCode} value={String(statusCode)}>
                        {statusCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setFromDate(event.target.value);
                  }}
                />

                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setToDate(event.target.value);
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Filters help you isolate failures by time window, severity, and affected
                  subsystem.
                </p>
                <Button variant="outline" onClick={clearFilters} disabled={activeFilterCount === 0}>
                  <FilterX className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Newest monitoring events appear first, with company and campaign context where available.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : events.length === 0 ? (
                <div className="py-10 text-center">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No events found</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitoring events will appear here when the app records runtime or operational issues.
                  </p>
                </div>
              ) : (
                <div className="min-w-0 max-w-full">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Context</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => {
                        const severityBadge = getSeverityBadge(event.severity);
                        const statusBadge = getStatusBadge(event.status_code);
                        const metadata =
                          event.metadata && typeof event.metadata === "object"
                            ? (event.metadata as Record<string, unknown>)
                            : {};

                        return (
                          <TableRow key={event.id}>
                            <TableCell className="min-w-[150px] text-sm text-muted-foreground">
                              {formatTimestamp(event.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={severityBadge.variant}
                                className={severityBadge.className}
                              >
                                {event.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[170px]">
                              <div className="space-y-2">
                                <Badge variant="outline">{formatAreaLabel(event.area)}</Badge>
                                <p className="text-sm font-medium">
                                  {formatEventTypeLabel(event.event_type)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Source: {event.source}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[280px]">
                              <div className="space-y-2">
                                <p className="text-sm">{event.message}</p>
                                {event.route && (
                                  <p className="text-xs text-muted-foreground">
                                    Route: {event.route}
                                  </p>
                                )}
                                {typeof metadata.campaignName === "string" && (
                                  <p className="text-xs text-muted-foreground">
                                    Campaign Snapshot: {metadata.campaignName}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusBadge.className}>
                                {statusBadge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              <div className="space-y-2 text-sm">
                                {event.company_id && (
                                  <p>
                                    <span className="font-medium">Company:</span>{" "}
                                    {companyNames[event.company_id] || event.company_id}
                                  </p>
                                )}
                                {event.campaign_id && (
                                  <p>
                                    <span className="font-medium">Campaign:</span>{" "}
                                    {campaignNames[event.campaign_id] || event.campaign_id}
                                  </p>
                                )}
                                {event.link_id && (
                                  <p className="text-xs text-muted-foreground">
                                    Link ID: {event.link_id}
                                  </p>
                                )}
                                {!event.company_id && !event.campaign_id && !event.link_id && (
                                  <p className="text-xs text-muted-foreground">
                                    No campaign or company context attached.
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {totalCount > PAGE_SIZE && (
                    <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {pageStart}-{pageEnd} of {totalCount} events
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                          disabled={currentPage === 1 || isRefreshing}
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
                          disabled={currentPage >= totalPages || isRefreshing}
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
        </div>
      </main>
    </div>
  );
}
