import { useMemo, useState } from "react";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";

type NotificationFilter = "all" | "unread";

export function NotificationsManager() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAllRead,
    markOneRead,
    clearAll,
  } = useAdminNotifications({ enableToasts: false });
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.read_at);
    }
    return notifications;
  }, [filter, notifications]);

  return (
    <div className="flex flex-col h-full">
      <header className="glass-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Notification Center</h1>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8">
        <Card className="mx-auto w-full max-w-[1100px]">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Admin Notifications
              </CardTitle>
              <CardDescription>
                Campaign response alerts are stored here and survive refresh or
                logout.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "unread" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("unread")}
              >
                Unread
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                disabled={notifications.length === 0 || unreadCount === 0}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={notifications.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="easy-form-shell mb-4 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">
                New responses appear here automatically.
              </p>
              <div className="flex items-center gap-2">
              <Badge variant="secondary">{unreadCount} unread</Badge>
              <Badge variant="outline">{notifications.length} total</Badge>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {filter === "unread"
                    ? "No unread notifications."
                    : "No notifications yet."}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[540px] pr-2">
                <div className="space-y-2">
                  {filteredNotifications.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-md border p-4 transition-colors ${
                        item.read_at ? "bg-card" : "bg-primary/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!item.read_at ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markOneRead(item.id)}
                          >
                            Mark read
                          </Button>
                        ) : (
                          <Badge variant="outline">Read</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
