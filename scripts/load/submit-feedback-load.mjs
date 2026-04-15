import {
  buildLatencySummary,
  createClientSessionId,
  createPayloadHash,
  createSubmissionToken,
  createSupabaseHeaders,
  createSyntheticPayload,
  createTimedFetch,
  loadJsonConfig,
  nextCode,
  printSummary,
  requireEnv,
  runWithConcurrency,
  summarizeErrors,
  summarizeStatuses,
  writeReportFile,
} from "./_shared.mjs";

const configPath = process.argv[2] || "scripts/load/submit-feedback-load.config.example.json";
const config = await loadJsonConfig(configPath);
const baseUrl = config.baseUrl || process.env.VITE_SUPABASE_URL || requireEnv("VITE_SUPABASE_URL");
const mode = config.mode || "public_edge";
const concurrency = Number(config.concurrency || 10);
const requestCount = Number(config.requests || 100);
const codes = Array.isArray(config.codes) ? config.codes.filter(Boolean) : [];

if (codes.length === 0) {
  throw new Error("submit-feedback-load config requires at least one link code in codes[].");
}

if (mode === "public_edge" && requestCount > codes.length && !config.allowExpectedRateLimits) {
  throw new Error(
    "Public edge mode will trigger the real duplicate-submission protections if requests exceed the number of unique codes. Add more codes or set allowExpectedRateLimits=true if you are intentionally testing throttling.",
  );
}

const timedFetch = createTimedFetch();
const startedAt = new Date().toISOString();
const isRpcMode = mode === "service_rpc";
const apiKey = isRpcMode
  ? config.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  : config.publishableKey || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const bearerToken = isRpcMode
  ? config.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  : apiKey;
const requestUrl = isRpcMode
  ? `${baseUrl}/rest/v1/rpc/submit_feedback_response`
  : `${baseUrl}/functions/v1/submit-feedback-response`;

const tasks = Array.from({ length: requestCount }, (_unused, index) => async () => {
  const code = nextCode(codes, index);
  const payload = createSyntheticPayload(index, config.payloadOverrides || {});
  const submissionToken = createSubmissionToken("load-test", index);
  const payloadHash = createPayloadHash(payload);
  const body = isRpcMode
    ? {
        p_code: code,
        p_payload: payload,
        p_submission_token: submissionToken,
        p_submission_payload_hash: payloadHash,
      }
    : {
        code,
        clientSessionId: createClientSessionId("load-test", index),
        submissionToken,
        payload,
      };

  const result = await timedFetch(requestUrl, {
    method: "POST",
    headers: createSupabaseHeaders(apiKey, bearerToken),
    body: JSON.stringify(body),
  });

  return {
    ...result,
    index,
    mode,
    code,
  };
});

const results = await runWithConcurrency(tasks, concurrency);
const successful = results.filter((entry) => entry.ok).length;
const failed = results.length - successful;
const report = {
  startedAt,
  completedAt: new Date().toISOString(),
  config: {
    mode,
    concurrency,
    requestCount,
    codeCount: codes.length,
    allowExpectedRateLimits: Boolean(config.allowExpectedRateLimits),
  },
  summary: {
    totalRequests: results.length,
    successful,
    failed,
    successRate: Number(((successful / Math.max(results.length, 1)) * 100).toFixed(2)),
    statuses: summarizeStatuses(results),
    latencyMs: buildLatencySummary(results.map((entry) => entry.durationMs)),
    topErrors: summarizeErrors(results).slice(0, 10),
  },
  samples: results.slice(0, 25),
};

const reportPath = await writeReportFile("submit-feedback-load", report);
printSummary("Feedback submission load summary", report, reportPath);
