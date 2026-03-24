import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { FilterX, Loader2, ScrollText } from "lucide-react";
import type { AuditLogEntry } from "@/lib/supabase-types";

interface AuditLogUserOption {
  user_id: string;
  user_name: string;
  user_email: string | null;
  activity_count: number;
  last_activity_at: string;
}

const AUDIT_PAGE_SIZE = 25;
const ENTITY_FILTERS = ["company", "campaign", "link"] as const;
const ACTION_FILTERS = ["create", "update", "delete"] as const;

function formatEntityLabel(entityType: string) {
  return entityType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatActionLabel(action: string) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function getActionVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action === "create") return "default";
  if (action === "delete") return "destructive";
  if (action === "update") return "secondary";
  return "outline";
}

function getChangedFields(metadata: Record<string, unknown>) {
  const changed = metadata.changed_fields;
  return Array.isArray(changed)
    ? changed.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function formatUserOptionLabel(option: AuditLogUserOption) {
  if (!option.user_email || option.user_email === option.user_name) {
    return option.user_name;
  }

  return `${option.user_name} (${option.user_email})`;
}

export function AuditLogsManager() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [userOptions, setUserOptions] = useState<AuditLogUserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true);

    try {
      const offset = (currentPage - 1) * AUDIT_PAGE_SIZE;
      const [logsRes, usersRes] = await Promise.all([
        supabase.rpc("get_audit_log_page", {
          p_user_id: selectedUser === "all" ? null : selectedUser,
          p_entity_type: selectedEntity === "all" ? null : selectedEntity,
          p_action: selectedAction === "all" ? null : selectedAction,
          p_search: search.trim() || null,
          p_from_date: fromDate || null,
          p_to_date: toDate || null,
          p_limit: AUDIT_PAGE_SIZE,
          p_offset: offset,
        }),
        supabase.rpc("get_audit_log_users"),
      ]);

      if (logsRes.error) throw logsRes.error;
      if (usersRes.error) throw usersRes.error;

      const nextLogs = ((logsRes.data || []) as AuditLogEntry[]).map((entry) => ({
        ...entry,
        metadata:
          entry.metadata && typeof entry.metadata === "object"
            ? (entry.metadata as Record<string, unknown>)
            : {},
      }));

      setLogs(nextLogs);
      setTotalCount(nextLogs[0]?.total_count || 0);
      setUserOptions((usersRes.data || []) as AuditLogUserOption[]);
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load audit log entries.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, fromDate, search, selectedAction, selectedEntity, selectedUser, toDate, toast]);

  useEffect(() => {
    loadAuditLogs();

    const channel = supabase
      .channel("audit-logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs" },
        () => {
          loadAuditLogs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAuditLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / AUDIT_PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * AUDIT_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * AUDIT_PAGE_SIZE, totalCount);

  const activeFilterCount = useMemo(() => {
    return [
      search.trim(),
      selectedUser !== "all",
      selectedEntity !== "all",
      selectedAction !== "all",
      fromDate,
      toDate,
    ].filter(Boolean).length;
  }, [fromDate, search, selectedAction, selectedEntity, selectedUser, toDate]);

  const clearFilters = () => {
    setCurrentPage(1);
    setSearch("");
    setSelectedUser("all");
    setSelectedEntity("all");
    setSelectedAction("all");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="glass-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Audit Log</h1>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>
                  Filter tracked user activity across companies, campaigns, and links.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{totalCount} matching activities</span>
                {activeFilterCount > 0 && (
                  <Badge variant="outline">{activeFilterCount} filters active</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Input
                  placeholder="Search by user, entity, or summary"
                  value={search}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setSearch(event.target.value);
                  }}
                />

                <Select
                  value={selectedUser}
                  onValueChange={(value) => {
                    setCurrentPage(1);
                    setSelectedUser(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {userOptions.map((option) => (
                        <SelectItem key={option.user_id} value={option.user_id}>
                          {formatUserOptionLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>

                <Select
                  value={selectedEntity}
                  onValueChange={(value) => {
                    setCurrentPage(1);
                    setSelectedEntity(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    {ENTITY_FILTERS.map((entity) => (
                      <SelectItem key={entity} value={entity}>
                        {formatEntityLabel(entity)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedAction}
                  onValueChange={(value) => {
                    setCurrentPage(1);
                    setSelectedAction(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {ACTION_FILTERS.map((action) => (
                      <SelectItem key={action} value={action}>
                        {formatActionLabel(action)}
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
                  Use the filters to trace what each user changed over time.
                </p>
                <Button variant="outline" onClick={clearFilters} disabled={activeFilterCount === 0}>
                  <FilterX className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tracked Activities</CardTitle>
              <CardDescription>
                Newest events appear first so recent admin work is easy to review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : logs.length === 0 ? (
                <div className="py-10 text-center">
                  <ScrollText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No audit entries found</h3>
                  <p className="text-sm text-muted-foreground">
                    Activity will appear here as tracked actions happen in the app.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((entry) => {
                        const changedFields = getChangedFields(
                          (entry.metadata || {}) as Record<string, unknown>,
                        );

                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="min-w-[160px] text-sm text-muted-foreground">
                              {new Date(entry.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="min-w-[180px]">
                              <div className="space-y-1">
                                <p className="font-medium">{entry.user_name || "System"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {entry.user_email || "No email available"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[170px]">
                              <div className="space-y-2">
                                <Badge variant="outline">
                                  {formatEntityLabel(entry.entity_type)}
                                </Badge>
                                <p className="text-sm font-medium">
                                  {entry.entity_name || "Unnamed record"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getActionVariant(entry.action)}>
                                {formatActionLabel(entry.action)}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[280px]">
                              <div className="space-y-2">
                                <p className="text-sm">{entry.summary}</p>
                                {changedFields.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {changedFields.slice(0, 4).map((field) => (
                                      <Badge key={field} variant="secondary" className="text-[11px]">
                                        {field.replace(/_/g, " ")}
                                      </Badge>
                                    ))}
                                    {changedFields.length > 4 && (
                                      <Badge variant="outline" className="text-[11px]">
                                        +{changedFields.length - 4} more
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {totalCount > AUDIT_PAGE_SIZE && (
                    <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {pageStart}-{pageEnd} of {totalCount} activities
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
        </div>
      </main>
    </div>
  );
}
