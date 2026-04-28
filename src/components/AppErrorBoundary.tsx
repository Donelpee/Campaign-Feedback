import { Component, type ErrorInfo, type ReactNode } from "react";
import { getErrorMessage, reportSystemHealthEvent } from "@/lib/system-health";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: getErrorMessage(error, "An unexpected application error occurred."),
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    void reportSystemHealthEvent({
      area: "app_runtime",
      eventType: "react_error_boundary",
      severity: "critical",
      message: getErrorMessage(error, "A React rendering error was captured."),
      metadata: {
        componentStack: errorInfo.componentStack || null,
      },
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background:
            "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 38%), #f8fafc",
          color: "#0f172a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            width: "min(640px, 100%)",
            borderRadius: "24px",
            border: "1px solid rgba(148,163,184,0.35)",
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 25px 80px rgba(15,23,42,0.12)",
            padding: "28px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "999px",
              background: "#eff6ff",
              color: "#1d4ed8",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            App Recovery
          </div>
          <h1 style={{ margin: "18px 0 10px", fontSize: "32px", lineHeight: 1.1 }}>
            This screen hit an unexpected error
          </h1>
          <p style={{ margin: 0, color: "#475569", fontSize: "16px", lineHeight: 1.6 }}>
            {this.state.message ||
              "The app captured the crash and can recover with a refresh."}
          </p>
          <div
            style={{
              marginTop: "20px",
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                borderRadius: "14px",
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#ffffff",
                padding: "12px 18px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
