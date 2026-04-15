import { useEffect } from "react";
import { getErrorMessage, reportSystemHealthEvent } from "@/lib/system-health";

export function AppErrorMonitor() {
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      void reportSystemHealthEvent({
        area: "app_runtime",
        eventType: "window_error",
        severity: "error",
        message: getErrorMessage(
          event.error || event.message,
          "Unhandled window error",
        ),
        metadata: {
          filename: event.filename || null,
          line: event.lineno || null,
          column: event.colno || null,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      void reportSystemHealthEvent({
        area: "app_runtime",
        eventType: "unhandled_promise_rejection",
        severity: "error",
        message: getErrorMessage(
          event.reason,
          "Unhandled promise rejection",
        ),
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
