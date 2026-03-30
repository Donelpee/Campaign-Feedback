import type {
  CampaignQuestion,
  CampaignSurveyDefinition,
  FileUploadFormat,
  QuestionLogicOperator,
  QuestionRouteRule,
  QuestionVisibility,
  QuestionVisibilityRule,
  SurveySection,
} from "./supabase-types";

export type CampaignSurveyInput =
  | unknown;

export function createDefaultSection(index = 0): SurveySection {
  return {
    id: crypto.randomUUID(),
    title: `Section ${index + 1}`,
    description: "",
    continueLabel: "Continue",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSurveyDefinition(value: unknown): value is CampaignSurveyDefinition {
  return Boolean(
    isRecord(value) &&
      (value as CampaignSurveyDefinition).version === 2 &&
      Array.isArray((value as CampaignSurveyDefinition).sections) &&
      Array.isArray((value as CampaignSurveyDefinition).questions),
  );
}

function toLegacyVisibility(question: CampaignQuestion): QuestionVisibility | undefined {
  if (!question.showIfQuestionId) return undefined;

  return {
    mode: "all",
    rules: [
      {
        id: crypto.randomUUID(),
        sourceQuestionId: question.showIfQuestionId,
        operator: question.showIfOperator || "equals",
        value:
          typeof question.showIfValue === "number" || typeof question.showIfValue === "string"
            ? question.showIfValue
            : "",
      },
    ],
  };
}

function toLegacyLogicProps(
  visibility?: QuestionVisibility,
): Pick<CampaignQuestion, "showIfQuestionId" | "showIfOperator" | "showIfValue"> {
  if (!visibility || visibility.mode !== "all" || visibility.rules.length !== 1) {
    return {
      showIfQuestionId: undefined,
      showIfOperator: undefined,
      showIfValue: undefined,
    };
  }

  const rule = visibility.rules[0];
  return {
    showIfQuestionId: rule.sourceQuestionId,
    showIfOperator: rule.operator,
    showIfValue:
      typeof rule.value === "number" || typeof rule.value === "string" ? rule.value : "",
  };
}

function normalizeRule(rule: Partial<QuestionVisibilityRule>): QuestionVisibilityRule | null {
  if (!rule.sourceQuestionId) return null;

  return {
    id: rule.id || crypto.randomUUID(),
    sourceQuestionId: rule.sourceQuestionId,
    operator: (rule.operator || "equals") as QuestionLogicOperator,
    value:
      typeof rule.value === "number" || typeof rule.value === "string"
        ? rule.value
        : "",
  };
}

function normalizeVisibility(question: CampaignQuestion): QuestionVisibility | undefined {
  const source = question.visibility || toLegacyVisibility(question);
  if (!source) return undefined;

  const rules = (source.rules || [])
    .map((rule) => normalizeRule(rule))
    .filter((rule): rule is QuestionVisibilityRule => Boolean(rule));

  if (rules.length === 0) return undefined;

  return {
    mode: source.mode === "any" ? "any" : "all",
    rules,
  };
}

function normalizeRouteRule(rule: Partial<QuestionRouteRule>): QuestionRouteRule | null {
  if (!rule.targetSectionId) return null;

  const answerValue =
    typeof rule.answerValue === "number" || typeof rule.answerValue === "string"
      ? rule.answerValue
      : "";

  return {
    id: rule.id || crypto.randomUUID(),
    answerValue,
    targetSectionId: rule.targetSectionId,
    targetQuestionId:
      typeof rule.targetQuestionId === "string" && rule.targetQuestionId.trim().length > 0
        ? rule.targetQuestionId
        : undefined,
  };
}

function normalizeRouteRules(question: CampaignQuestion): QuestionRouteRule[] | undefined {
  const rules = (question.routeRules || [])
    .map((rule) => normalizeRouteRule(rule))
    .filter((rule): rule is QuestionRouteRule => Boolean(rule));

  return rules.length > 0 ? rules : undefined;
}

function normalizeSection(section: Partial<SurveySection> | undefined, index: number): SurveySection {
  return {
    id: section?.id || crypto.randomUUID(),
    title: section?.title?.trim() || `Section ${index + 1}`,
    description: section?.description || "",
    continueLabel: section?.continueLabel?.trim() || "Continue",
  };
}

function normalizeQuestion(question: CampaignQuestion, fallbackSectionId: string): CampaignQuestion {
  const visibility = normalizeVisibility(question);
  const routeRules = normalizeRouteRules(question);
  const legacy = toLegacyLogicProps(visibility);
  const allowedFileTypes = Array.isArray(question.allowedFileTypes)
    ? question.allowedFileTypes.filter(
        (value): value is FileUploadFormat =>
          value === "pdf" ||
          value === "png" ||
          value === "jpeg" ||
          value === "excel" ||
          value === "word",
      )
    : undefined;
  const maxFiles =
    typeof question.maxFiles === "number" && Number.isFinite(question.maxFiles)
      ? question.maxFiles
      : undefined;
  const maxFileSizeMb =
    typeof question.maxFileSizeMb === "number" &&
    Number.isFinite(question.maxFileSizeMb)
      ? question.maxFileSizeMb
      : undefined;

  return {
    ...question,
    sectionId: question.sectionId || fallbackSectionId,
    allowedFileTypes,
    maxFiles,
    maxFileSizeMb,
    visibility,
    routeRules,
    ...legacy,
  };
}

export function normalizeCampaignSurvey(input: CampaignSurveyInput): {
  sections: SurveySection[];
  questions: CampaignQuestion[];
} {
  if (isSurveyDefinition(input)) {
    const rawSections = input.sections.filter(isRecord);
    const sections = (rawSections.length > 0 ? rawSections : [createDefaultSection(0)]).map(
      (section, index) => normalizeSection(section as Partial<SurveySection>, index),
    );
    const validSectionIds = new Set(sections.map((section) => section.id));
    const fallbackSectionId = sections[0].id;
    const questions = input.questions.filter(isRecord).map((question) =>
      normalizeQuestion(
        question as CampaignQuestion,
        typeof question.sectionId === "string" && validSectionIds.has(question.sectionId)
          ? question.sectionId
          : fallbackSectionId,
      ),
    );
    return { sections, questions };
  }

  if (Array.isArray(input) && input.length > 0) {
    const section = createDefaultSection(0);
    const questions = input
      .filter(isRecord)
      .map((question) => normalizeQuestion(question as CampaignQuestion, section.id));
    return {
      sections: [section],
      questions,
    };
  }

  const section = createDefaultSection(0);
  return { sections: [section], questions: [] };
}

export function serializeCampaignSurvey(data: {
  sections: SurveySection[];
  questions: CampaignQuestion[];
}): CampaignSurveyDefinition {
  const sections =
    data.sections.length > 0
      ? data.sections.map((section, index) => normalizeSection(section, index))
      : [createDefaultSection(0)];
  const validSectionIds = new Set(sections.map((section) => section.id));
  const fallbackSectionId = sections[0].id;

  return {
    version: 2,
    sections,
    questions: data.questions.map((question) =>
      normalizeQuestion(
        question,
        question.sectionId && validSectionIds.has(question.sectionId)
          ? question.sectionId
          : fallbackSectionId,
      ),
    ),
  };
}

export function getOrderedSurveyQuestions(
  sections: SurveySection[],
  questions: CampaignQuestion[],
): CampaignQuestion[] {
  const sectionOrder = sections.map((section) => section.id);
  return sectionOrder.flatMap((sectionId) =>
    questions.filter((question) => question.sectionId === sectionId),
  );
}

function normalizeComparableValue(value: unknown): string | number {
  if (typeof value === "number") return value;
  const asString = String(value ?? "").trim();
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) && asString.length > 0 ? asNumber : asString.toLowerCase();
}

export function findQuestionRouteTarget(
  question: CampaignQuestion,
  answer: unknown,
): QuestionRouteRule | null {
  if (!question.routeRules || question.routeRules.length === 0) return null;

  const normalizedAnswer = normalizeComparableValue(answer);

  return (
    question.routeRules.find((rule) => {
      const normalizedRuleValue = normalizeComparableValue(rule.answerValue);
      return normalizedRuleValue === normalizedAnswer;
    }) || null
  );
}

function normalizeAnswerValue(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim().toLowerCase());
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      Array.isArray(item)
        ? item.map((entry) => String(entry).trim().toLowerCase())
        : [String(item ?? "").trim().toLowerCase()],
    );
  }

  return [String(value).trim().toLowerCase()];
}

function doesRuleMatch(
  answer: unknown,
  operator: QuestionLogicOperator,
  expectedValue?: string | number,
): boolean {
  const values = normalizeAnswerValue(answer);
  const expected =
    typeof expectedValue === "number"
      ? expectedValue
      : String(expectedValue ?? "")
          .trim()
          .toLowerCase();

  if (operator === "answered") return values.some((value) => value.length > 0);
  if (operator === "not_answered") return values.every((value) => value.length === 0);

  if (operator === "greater_than" || operator === "less_than") {
    const source = Number(values[0] || "");
    const target = Number(expected);
    if (!Number.isFinite(source) || !Number.isFinite(target)) return false;
    return operator === "greater_than" ? source > target : source < target;
  }

  const equalsMatch = values.some((value) => value === expected);
  const containsMatch = values.some((value) => value.includes(String(expected)));

  if (operator === "not_equals") return !equalsMatch;
  if (operator === "contains") return containsMatch;
  if (operator === "not_contains") return !containsMatch;
  return equalsMatch;
}

export function isSurveyQuestionVisible(
  question: CampaignQuestion,
  answers: Record<string, unknown>,
): boolean {
  const visibility = normalizeVisibility(question);
  if (!visibility || visibility.rules.length === 0) return true;

  const matches = visibility.rules.map((rule) =>
    doesRuleMatch(answers[rule.sourceQuestionId], rule.operator, rule.value),
  );

  return visibility.mode === "any" ? matches.some(Boolean) : matches.every(Boolean);
}
