import { describe, expect, it } from "vitest";
import {
  getBasicInfoValidation,
  getQuestionValidation,
  type WizardValidationData,
} from "./wizardValidation";

const baseData: WizardValidationData = {
  creationMode: "guided_buddy",
  selectedCompanyId: "company-1",
  name: "Customer Pulse",
  description: "Learn what customers value most.",
  startDate: "2026-03-23",
  endDate: "2026-03-30",
  questions: [],
};

describe("wizardValidation", () => {
  it("flags empty required setup fields before anything else", () => {
    const result = getBasicInfoValidation({
      ...baseData,
      selectedCompanyId: "",
      name: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.warningType).toBe("empty_required_fields");
  });

  it("flags invalid date ranges with dedicated warning copy", () => {
    const result = getBasicInfoValidation({
      ...baseData,
      endDate: "2026-03-20",
    });

    expect(result.isValid).toBe(false);
    expect(result.warningType).toBe("invalid_date_range");
  });

  it("requires every question to be clear before step 1 is valid", () => {
    const result = getQuestionValidation([
      {
        id: "q-1",
        type: "rating",
        question: "Good one",
        required: true,
      },
      {
        id: "q-2",
        type: "textarea",
        question: "   ",
        required: false,
      },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.warningType).toBe("invalid_questions");
    expect(result.clearQuestionCount).toBe(1);
  });

  it("accepts a question set only when every question is clear", () => {
    const result = getQuestionValidation([
      {
        id: "q-1",
        type: "rating",
        question: "How satisfied are you overall?",
        required: true,
      },
      {
        id: "q-2",
        type: "textarea",
        question: "What should we improve next?",
        required: false,
      },
    ]);

    expect(result.isValid).toBe(true);
    expect(result.warningType).toBe("none");
    expect(result.clearQuestionCount).toBe(2);
  });
});
