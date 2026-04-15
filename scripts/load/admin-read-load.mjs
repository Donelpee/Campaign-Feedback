import {
  buildLatencySummary,
  createSupabaseHeaders,
  createTimedFetch,
  loadJsonConfig,
  printSummary,
  requireEnv,
  runWithConcurrency,
  summarizeErrors,
  summarizeStatuses,
  writeReportFile,
} from "./_shared.mjs";

const configPath = process.argv[2] || "scripts/load/admin-read-load.config.example.json";
const config = await loadJsonConfig(configPath);
const baseUrl = config.baseUrl || process.env.VITE_SUPABASE_URL || requireEnv("VITE_SUPABASE_URL");
const apiKey = config.publishableKey || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const adminJwt = config.adminJwt || process.env.LOAD_TEST_ADMIN_JWT || requireEnv("LOAD_TEST_ADMIN_JWT");
const concurrency = Number(config.concurrency || 10);
const requestCount = Number(config.requests || 100);
const timedFetch = createTimedFetch();
const startedAt = new Date().toISOString();

const scenarios = Array.isArray(config.scenarios) && config.scenarios.length > 0
  ? config.scenarios
  : [
      {
        name: "response_summary_all",
        path: "/rest/v1/rpc/get_feedback_response_summary",
        body: { p_company_id: null, p_campaign_id: null },
      },
      {
        name: "response_page_all",
        path: "/rest/v1/rpc/get_feedback_response_page",
        body: { p_company_id: null, p_campaign_id: null, p_limit: 50, p_offset: 0 },
      },
    ];

const tasks = Array.from({ length: requestCount }, (_unused, index) => async () => {
  const scenario = scenarios[index % scenarios.length];
  const result = await timedFetch(`${baseUrl}${scenario.path}`, {
    method: "POST",
    headers: createSupabaseHeaders(apiKey, adminJwt),
    body: JSON.stringify(scenario.body),
  });

  return {
    ...result,
    index,
    scenario: scenario.name,
  };
});

const results = await runWithConcurrency(tasks, concurrency);
const byScenario = scenarios.map((scenario) => {
  const scoped = results.filter((entry) => entry.scenario === scenario.name);
  const successful = scoped.filter((entry) => entry.ok).length;
  return {
    scenario: scenario.name,
    requests: scoped.length,
    successful,
    failed: scoped.length - successful,
    statuses: summarizeStatuses(scoped),
    latencyMs: buildLatencySummary(scoped.map((entry) => entry.durationMs)),
    topErrors: summarizeErrors(scoped).slice(0, 5),
  };
});

const report = {
  startedAt,
  completedAt: new Date().toISOString(),
  config: {
    concurrency,
    requestCount,
    scenarioCount: scenarios.length,
  },
  summary: {
    totalRequests: results.length,
    successful: results.filter((entry) => entry.ok).length,
    failed: results.filter((entry) => !entry.ok).length,
    statuses: summarizeStatuses(results),
    latencyMs: buildLatencySummary(results.map((entry) => entry.durationMs)),
    topErrors: summarizeErrors(results).slice(0, 10),
  },
  scenarios: byScenario,
  samples: results.slice(0, 25),
};

const reportPath = await writeReportFile("admin-read-load", report);
printSummary("Admin read load summary", report, reportPath);
