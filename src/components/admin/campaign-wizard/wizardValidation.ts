import type { CampaignQuestion } from "@/lib/supabase-types";

export type WizardValidationMode =
  | "guided_buddy"
  | "quick_start"
  | "template_story"
  | "conversation_builder";

export interface WizardValidationData {
  creationMode?: WizardValidationMode;
  selectedCompanyId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  questions: CampaignQuestion[];
}

export type WizardWarningType =
  | "none"
  | "empty_required_fields"
  | "short_text"
  | "invalid_date_range"
  | "missing_questions"
  | "invalid_questions";

export const MIN_CAMPAIGN_TEXT_LENGTH = 10;
export const MIN_QUESTION_TEXT_LENGTH = 8;

function hasMinLength(value: string, minLength: number) {
  return value.trim().length >= minLength;
}

export function isQuestionClear(question: CampaignQuestion) {
  return hasMinLength(question.question, MIN_QUESTION_TEXT_LENGTH);
}

export function getBasicInfoValidation(data: WizardValidationData) {
  const needsDescription = data.creationMode !== "quick_start";
  const hasName = hasMinLength(data.name, MIN_CAMPAIGN_TEXT_LENGTH);
  const hasDescription =
    !needsDescription || hasMinLength(data.description, MIN_CAMPAIGN_TEXT_LENGTH);
  const hasEmptyRequiredFields = Boolean(
    !data.selectedCompanyId ||
      !data.name.trim() ||
      (needsDescription && !data.description.trim()) ||
      !data.startDate ||
      !data.endDate,
  );
  const hasInvalidDateRange = Boolean(
    data.startDate && data.endDate && data.endDate < data.startDate,
  );
  const hasShortText = Boolean(
    (data.name.trim().length > 0 && !hasName) ||
      (needsDescription &&
        data.description.trim().length > 0 &&
        !hasDescription),
  );

  let warningType: WizardWarningType = "none";
  if (hasEmptyRequiredFields) {
    warningType = "empty_required_fields";
  } else if (hasInvalidDateRange) {
    warningType = "invalid_date_range";
  } else if (hasShortText) {
    warningType = "short_text";
  }

  return {
    isValid: warningType === "none",
    warningType,
    hasEmptyRequiredFields,
    hasInvalidDateRange,
    hasShortText,
    hasName,
    hasDescription,
  };
}

export function getQuestionValidation(questions: CampaignQuestion[]) {
  const clearQuestionCount = questions.filter(isQuestionClear).length;
  const hasQuestions = questions.length > 0;
  const hasInvalidQuestions = hasQuestions && clearQuestionCount !== questions.length;

  let warningType: WizardWarningType = "none";
  if (!hasQuestions) {
    warningType = "missing_questions";
  } else if (hasInvalidQuestions) {
    warningType = "invalid_questions";
  }

  return {
    isValid: warningType === "none",
    warningType,
    clearQuestionCount,
    hasQuestions,
    hasInvalidQuestions,
  };
}
