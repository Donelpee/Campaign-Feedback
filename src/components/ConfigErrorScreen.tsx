export function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top, rgba(251,191,36,0.18), transparent 38%), #f8fafc",
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
            background: "#fff7ed",
            color: "#9a3412",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Configuration Required
        </div>
        <h1 style={{ margin: "18px 0 10px", fontSize: "32px", lineHeight: 1.1 }}>
          Supabase settings are missing in this deployment
        </h1>
        <p style={{ margin: 0, color: "#475569", fontSize: "16px", lineHeight: 1.6 }}>
          {message}
        </p>
        <div
          style={{
            marginTop: "20px",
            borderRadius: "16px",
            background: "#f8fafc",
            padding: "16px",
            color: "#334155",
            fontSize: "14px",
            lineHeight: 1.7,
          }}
        >
          <strong>Set these Vercel environment variables and redeploy:</strong>
          <div>`VITE_SUPABASE_URL`</div>
          <div>`VITE_SUPABASE_PUBLISHABLE_KEY`</div>
        </div>
      </div>
    </div>
  );
}
