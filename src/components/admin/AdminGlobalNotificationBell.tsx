import { useState } from "react";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Bell, CalendarDays, CheckCheck, PanelLeft, UserCircle2 } from "lucide-react";

export function AdminGlobalNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { toggleSidebar } = useSidebar();
  const {
    notifications,
    unreadCount,
    inAppCampaignNotifications,
    markAllRead,
    clearAll,
  } = useAdminNotifications({ enableToasts: true });

  return (
    <>
    <div className="fixed left-2 top-2 z-50 md:hidden">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-lg border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        onClick={toggleSidebar}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Open navigation</span>
      </Button>
    </div>
    <div className="fixed right-2 top-2 z-50 sm:right-4 sm:top-3 md:right-6 md:top-4">
      <div className="admin-global-bell flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-2 py-1.5 text-sm text-slate-600 shadow-[0_8px_26px_rgba(15,23,42,0.07)] backdrop-blur sm:gap-3 sm:px-3 sm:py-2 md:gap-4 md:rounded-2xl md:px-4">
        <div className="hidden lg:flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <span>
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <Separator orientation="vertical" className="hidden h-4 lg:block" />

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-5 text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="admin-bell-popover w-80 border-[#d8e3ee] bg-white p-0 text-slate-800"
          >
            <div className="border-b border-[#e3edf6] px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Notifications</p>
                <Badge
                  variant="secondary"
                  className="bg-sky-100 text-sky-800 border-sky-200"
                >
                  {unreadCount} unread
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Campaign form submission alerts
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-[#e3edf6] px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                disabled={notifications.length === 0}
                className="h-8 px-2 text-xs text-slate-700 hover:bg-slate-100"
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Mark all read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={notifications.length === 0}
                className="h-8 px-2 text-xs text-slate-700 hover:bg-slate-100"
              >
                Clear
              </Button>
            </div>

            <ScrollArea className="h-72">
              {notifications.length === 0 ? (
                <div className="px-3 py-5 text-center text-xs text-slate-500">
                  No notifications yet.
                </div>
              ) : (
                <div className="divide-y divide-[#e3edf6]">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`px-3 py-3 ${
                        item.read_at ? "bg-transparent" : "bg-sky-50/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm leading-snug">{item.message}</p>
                        {!item.read_at && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <div className="hidden items-center gap-2 font-medium text-slate-800 md:flex">
          <UserCircle2 className="h-5 w-5 text-slate-600" />
          <span>System Administrator</span>
        </div>

        {!inAppCampaignNotifications && (
          <Badge variant="outline" className="ml-1">
            Alerts Off
          </Badge>
        )}
      </div>
    </div>
    </>
  );
}
