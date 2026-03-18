import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type AdminNotificationRow =
  Database["public"]["Tables"]["admin_notifications"]["Row"];

interface UseAdminNotificationsOptions {
  enableToasts?: boolean;
}

export function useAdminNotifications(options?: UseAdminNotificationsOptions) {
  const enableToasts = options?.enableToasts ?? true;
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inAppCampaignNotifications, setInAppCampaignNotifications] =
    useState(true);
  const toastedIdsRef = useRef<Set<string>>(new Set());
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedOnceRef = useRef(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error loading admin notifications:", error);
      setIsLoading(false);
      return;
    }

    const rows = data || [];
    const newRows = rows.filter(
      (row) => !knownNotificationIdsRef.current.has(row.id),
    );

    rows.forEach((row) => {
      knownNotificationIdsRef.current.add(row.id);
    });

    if (
      hasLoadedOnceRef.current &&
      enableToasts &&
      inAppCampaignNotifications &&
      newRows.length > 0
    ) {
      newRows.slice(0, 3).forEach((row) => {
        if (toastedIdsRef.current.has(row.id)) return;
        toastedIdsRef.current.add(row.id);
        toast({
          title: row.title,
          description: row.message,
        });
      });
    }

    setNotifications(rows);
    hasLoadedOnceRef.current = true;
    setIsLoading(false);
  }, [enableToasts, inAppCampaignNotifications, toast, user?.id]);

  const loadNotificationPreference = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from("user_settings")
      .select("in_app_campaign_notifications")
      .eq("user_id", user.id)
      .maybeSingle();

    setInAppCampaignNotifications(data?.in_app_campaign_notifications ?? true);
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("admin_notifications")
      .update({ read_at: nowIso })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Error marking notifications as read:", error);
      return;
    }

    setNotifications((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? nowIso })),
    );
  }, [user?.id]);

  const markOneRead = useCallback(
    async (notificationId: string) => {
      if (!user?.id) return;
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("admin_notifications")
        .update({ read_at: nowIso })
        .eq("id", notificationId)
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) {
        console.error("Error marking notification as read:", error);
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? { ...item, read_at: item.read_at ?? nowIso }
            : item,
        ),
      );
    },
    [user?.id],
  );

  const clearAll = useCallback(async () => {
    if (!user?.id) return;

    const { error } = await supabase
      .from("admin_notifications")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error clearing notifications:", error);
      return;
    }

    setNotifications([]);
    toastedIdsRef.current.clear();
    knownNotificationIdsRef.current.clear();
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
    loadNotificationPreference();
  }, [loadNotificationPreference, loadNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    const settingsChannel = supabase
      .channel(`user-settings-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_settings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { in_app_campaign_notifications?: boolean };
          if (typeof row?.in_app_campaign_notifications === "boolean") {
            setInAppCampaignNotifications(row.in_app_campaign_notifications);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const notificationsChannel = supabase
      .channel(`admin-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admin_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as AdminNotificationRow;
            if (row.id) {
              knownNotificationIdsRef.current.add(row.id);
            }

            setNotifications((current) => {
              if (current.some((item) => item.id === row.id)) return current;
              return [row, ...current].slice(0, 100);
            });

            if (
              enableToasts &&
              inAppCampaignNotifications &&
              row.id &&
              !toastedIdsRef.current.has(row.id)
            ) {
              toastedIdsRef.current.add(row.id);
              toast({
                title: row.title,
                description: row.message,
              });
            }
          }

          if (payload.eventType === "UPDATE") {
            const row = payload.new as AdminNotificationRow;
            setNotifications((current) =>
              current.map((item) => (item.id === row.id ? row : item)),
            );
          }

          if (payload.eventType === "DELETE") {
            const row = payload.old as { id?: string };
            if (!row?.id) return;
            setNotifications((current) =>
              current.filter((item) => item.id !== row.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
    };
  }, [enableToasts, inAppCampaignNotifications, toast, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = window.setInterval(() => {
      loadNotifications();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadNotifications, user?.id]);

  return {
    notifications,
    unreadCount,
    isLoading,
    inAppCampaignNotifications,
    refresh: loadNotifications,
    markAllRead,
    markOneRead,
    clearAll,
  };
}
