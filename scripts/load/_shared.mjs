import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function loadJsonConfig(configPath) {
  const resolvedPath = path.resolve(process.cwd(), configPath);
  const raw = await readFile(resolvedPath, "utf8");
  return JSON.parse(raw);
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createSupabaseHeaders(apiKey, bearerToken = apiKey) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
  };
}

export function createSyntheticPayload(index, overrides = {}) {
  const overrideAnswers =
    overrides.answers && typeof overrides.answers === "object" && !Array.isArray(overrides.answers)
      ? overrides.answers
      : {};

  return {
    overall_satisfaction: 6 + (index % 5),
    service_quality: 3 + (index % 3),
    recommendation_likelihood: 2 + (index % 4),
    improvement_areas: index % 5 === 0 ? ["Communication", "Other"] : ["Communication"],
    additional_comments: `Load test submission ${index + 1}`,
    answers: {
      load_test_marker: `load-test-${index + 1}`,
      load_test_batch: new Date().toISOString(),
      other_text: index % 5 === 0 ? "Synthetic Other detail from load test" : "",
      ...overrideAnswers,
    },
    ...overrides,
    answers: {
      load_test_marker: `load-test-${index + 1}`,
      load_test_batch: new Date().toISOString(),
      other_text: index % 5 === 0 ? "Synthetic Other detail from load test" : "",
      ...overrideAnswers,
    },
  };
}

function normalizeForStableJson(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForStableJson(entry));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce((accumulator, key) => {
        const normalizedValue = normalizeForStableJson(value[key]);
        if (normalizedValue !== undefined) {
          accumulator[key] = normalizedValue;
        }
        return accumulator;
      }, {});
  }

  return value;
}

export function stableStringify(value) {
  return JSON.stringify(normalizeForStableJson(value));
}

export function createPayloadHash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function createSubmissionToken(prefix, index) {
  return `${prefix}-${index + 1}-${randomUUID()}`;
}

export function createTimedFetch() {
  return async function timedFetch(url, options) {
    const startedAt = performance.now();
    try {
      const response = await fetch(url, options);
      const bodyText = await response.text();
      const durationMs = performance.now() - startedAt;
      let body = null;
      if (bodyText.trim()) {
        try {
          body = JSON.parse(bodyText);
        } catch {
          body = bodyText;
        }
      }
      return {
        ok: response.ok,
        status: response.status,
        durationMs,
        body,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        durationMs: performance.now() - startedAt,
        body: { error: error instanceof Error ? error.message : "Network error" },
      };
    }
  };
}

export async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= tasks.length) return;
      results[current] = await tasks[current]();
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function buildLatencySummary(samples) {
  if (samples.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);

  return {
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    avg: Number((sum / sorted.length).toFixed(2)),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function percentile(sortedValues, ratio) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1),
  );
  return Number(sortedValues[index].toFixed(2));
}

export function summarizeStatuses(results) {
  return results.reduce((acc, entry) => {
    const key = String(entry.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function summarizeErrors(results) {
  const grouped = new Map();
  results
    .filter((entry) => !entry.ok)
    .forEach((entry) => {
      const message =
        typeof entry.body?.error === "string"
          ? entry.body.error
          : typeof entry.body === "string"
            ? entry.body
            : "Unknown error";
      grouped.set(message, (grouped.get(message) || 0) + 1);
    });

  return Array.from(grouped.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count);
}

export async function writeReportFile(prefix, report) {
  const outputDir = path.resolve(process.cwd(), "load-test-results");
  await mkdir(outputDir, { recursive: true });
  const filePath = path.join(
    outputDir,
    `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  await writeFile(filePath, JSON.stringify(report, null, 2), "utf8");
  return filePath;
}

export function nextCode(codes, index) {
  return codes[index % codes.length];
}

export function createClientSessionId(prefix, index) {
  return `${prefix}-${index + 1}-${randomUUID()}`;
}

export function printSummary(title, report, reportPath) {
  console.log(`\n${title}`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Report saved to: ${reportPath}`);
}
