export const futureReleaseFlags = {
  // Keep branching/conditional logic live.
  keepBranchingLogicLive: true,

  // Hide until multi-tenant go-live.
  phase2DistributionAndReminders: false,
  phase3To5AdvancedAnalytics: false,
  phase3To5AdvancedExportInsights: false,

  // Future wizard engines.
  aiAssistedBuilder: false,
  uploadDocumentBuilder: false,
} as const;

export const futureReleaseBacklog = [
  "Phase 2: campaign distribution, recipient lists, and automated reminders",
  "Phase 3: benchmark analytics, period deltas, and sentiment insights",
  "Phase 4: forecasting and proactive risk alerts",
  "Phase 5: campaign health scoring and prioritized recommendations",
  "AI-assisted campaign builder engine",
  "Document upload campaign builder engine",
] as const;
