import type { CampaignQuestion } from "./supabase-types";

const OTHER_OPTION_PATTERN = /^other\b/i;

export function sanitizeQuestionOptions(values?: string[]): string[] {
  return (values || [])
    .map((value) => value.trim())
    .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
}

export function findOtherOptionLabel(options?: string[]): string | null {
  return sanitizeQuestionOptions(options).find((option) => OTHER_OPTION_PATTERN.test(option)) || null;
}

export function getOtherAnswerKey(questionId: string): string {
  return `${questionId}__other`;
}

export function getQuestionIdFromOtherAnswerKey(key: string): string | null {
  return key.endsWith("__other") ? key.slice(0, -"__other".length) : null;
}

export function getOtherAnswerText(
  answers: Record<string, unknown>,
  questionId: string,
): string {
  const value = answers[getOtherAnswerKey(questionId)];
  return typeof value === "string" ? value : "";
}

export function isOtherOptionSelected(
  question: Pick<CampaignQuestion, "type" | "options">,
  answer: unknown,
): boolean {
  const otherOption = findOtherOptionLabel(question.options);
  if (!otherOption) return false;

  if (question.type === "multiple_choice") {
    return Array.isArray(answer) && answer.some((item) => String(item).trim() === otherOption);
  }

  return String(answer ?? "").trim() === otherOption;
}
