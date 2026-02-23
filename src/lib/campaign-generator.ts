import type { CampaignQuestion, CampaignType } from "@/lib/supabase-types";
import { supabase } from "@/integrations/supabase/client";

export interface GeneratedDraft {
  name: string;
  description: string;
  questions: CampaignQuestion[];
}

export async function generateDraftWithAI(
  instruction: string,
  campaignType: CampaignType,
): Promise<GeneratedDraft | null> {
  const trimmedInstruction = instruction.trim();
  if (!trimmedInstruction) return null;

  const { data, error } = await supabase.functions.invoke(
    "generate-campaign-draft",
    {
      body: {
        instruction: trimmedInstruction,
        campaignType,
      },
    },
  );

  if (error) {
    console.error("Edge function generation failed:", error);
    return null;
  }

  const draft = (data as { draft?: GeneratedDraft } | null)?.draft;
  if (!draft) return null;

  const validQuestions = Array.isArray(draft.questions)
    ? draft.questions.filter((question) => Boolean(question?.question))
    : [];

  if (validQuestions.length === 0) return null;

  return {
    name: draft.name || "Generated Campaign",
    description: draft.description || "",
    questions: validQuestions,
  };
}

const fallbackQuestionsByType: Record<
  CampaignType,
  Omit<CampaignQuestion, "id">[]
> = {
  feedback: [
    {
      type: "scale",
      question: "How satisfied are you with our overall service?",
      required: true,
      min: 1,
      max: 10,
    },
    {
      type: "rating",
      question: "How would you rate service quality?",
      required: true,
    },
    {
      type: "nps",
      question: "How likely are you to recommend us?",
      required: true,
      min: 0,
      max: 10,
    },
    {
      type: "multiple_choice",
      question: "Which areas should we improve?",
      required: false,
      options: [
        "Communication",
        "Response Time",
        "Quality",
        "Support",
        "Pricing",
      ],
    },
    { type: "text", question: "Any additional comments?", required: false },
  ],
  employee_survey: [
    {
      type: "scale",
      question: "How satisfied are you with your current role?",
      required: true,
      min: 1,
      max: 10,
    },
    {
      type: "rating",
      question: "How would you rate your work-life balance?",
      required: true,
    },
    {
      type: "nps",
      question: "How likely are you to recommend this workplace?",
      required: true,
      min: 0,
      max: 10,
    },
    {
      type: "multiple_choice",
      question: "What would improve your experience?",
      required: false,
      options: [
        "Communication",
        "Growth",
        "Compensation",
        "Management",
        "Culture",
      ],
    },
    {
      type: "text",
      question: "What should leadership improve?",
      required: false,
    },
  ],
  product_research: [
    {
      type: "scale",
      question: "How useful is this product/feature?",
      required: true,
      min: 1,
      max: 10,
    },
    {
      type: "rating",
      question: "How easy is the product to use?",
      required: true,
    },
    {
      type: "nps",
      question: "How likely are you to continue using this product?",
      required: true,
      min: 0,
      max: 10,
    },
    {
      type: "multiple_choice",
      question: "Which features matter most?",
      required: false,
      options: [
        "Performance",
        "Usability",
        "Design",
        "Pricing",
        "Integrations",
      ],
    },
    {
      type: "text",
      question: "What features should we add next?",
      required: false,
    },
  ],
  event_evaluation: [
    {
      type: "scale",
      question: "How would you rate the event overall?",
      required: true,
      min: 1,
      max: 10,
    },
    {
      type: "rating",
      question: "How would you rate the speakers/sessions?",
      required: true,
    },
    {
      type: "nps",
      question: "How likely are you to attend our next event?",
      required: true,
      min: 0,
      max: 10,
    },
    {
      type: "multiple_choice",
      question: "What worked best?",
      required: false,
      options: ["Speakers", "Content", "Venue", "Networking", "Organization"],
    },
    {
      type: "text",
      question: "How can we improve future events?",
      required: false,
    },
  ],
};

function normalizeInstruction(input: string): string {
  return input.replace(/\r/g, "").trim();
}

function inferCampaignName(
  instruction: string,
  campaignType: CampaignType,
): string {
  const firstMeaningfulLine = instruction
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 10);

  if (firstMeaningfulLine) {
    const plain = firstMeaningfulLine
      .replace(/^[-*\d.\s]+/, "")
      .replace(/\?$/, "")
      .trim();
    if (plain.length >= 8) {
      return plain.length > 70 ? `${plain.slice(0, 67)}...` : plain;
    }
  }

  const defaults: Record<CampaignType, string> = {
    feedback: "Customer Feedback Survey",
    employee_survey: "Employee Experience Survey",
    product_research: "Product Research Survey",
    event_evaluation: "Event Evaluation Survey",
  };

  return defaults[campaignType];
}

function inferQuestionType(text: string): CampaignQuestion["type"] {
  const lower = text.toLowerCase();

  if (/(nps|net promoter|recommend)/.test(lower)) return "nps";
  if (/(choose one|select one|single choice|one option|pick one)/.test(lower))
    return "single_choice";
  if (/(rate|rating|score|scale|1-10|0-10)/.test(lower)) return "scale";
  if (/(star|1-5|five|excellent|poor)/.test(lower)) return "rating";
  if (/(which|select|choose|pick|areas|options|all that apply)/.test(lower))
    return "multiple_choice";
  if (/(why|how|describe|explain|comment|suggest)/.test(lower)) return "text";

  return text.endsWith("?") ? "text" : "scale";
}

function inferOptionsFromLine(text: string): string[] {
  const colonIndex = text.indexOf(":");
  if (colonIndex < 0) return [];

  const optionPart = text.slice(colonIndex + 1);
  const rawOptions = optionPart
    .split(/[;,|]/)
    .map((value) => value.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);

  return rawOptions.length >= 2 ? rawOptions : [];
}

function buildQuestion(text: string, index: number): CampaignQuestion {
  const questionText = text.replace(/^[-*\d.)\s]+/, "").trim();
  const type = inferQuestionType(questionText);
  const isRequired = index < 3 || /(must|required)/i.test(questionText);

  if (type === "multiple_choice" || type === "single_choice") {
    const options = inferOptionsFromLine(questionText);
    return {
      id: crypto.randomUUID(),
      type,
      question: questionText,
      required: isRequired,
      options:
        options.length > 0 ? options : ["Option 1", "Option 2", "Option 3"],
    };
  }

  if (type === "nps") {
    return {
      id: crypto.randomUUID(),
      type,
      question: questionText,
      required: isRequired,
      min: 0,
      max: 10,
    };
  }

  if (type === "scale") {
    return {
      id: crypto.randomUUID(),
      type,
      question: questionText,
      required: isRequired,
      min: 1,
      max: 10,
    };
  }

  return {
    id: crypto.randomUUID(),
    type,
    question: questionText,
    required: isRequired,
  };
}

export function generateDraftFromInstruction(
  instructionInput: string,
  campaignType: CampaignType,
): GeneratedDraft {
  const instruction = normalizeInstruction(instructionInput);
  const lines = instruction
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const explicitQuestions = lines.filter(
    (line) => line.endsWith("?") || /^[-*\d.\s]/.test(line),
  );

  let questions: CampaignQuestion[];
  if (explicitQuestions.length >= 3) {
    questions = explicitQuestions
      .slice(0, 20)
      .map((line, index) => buildQuestion(line, index));
  } else {
    questions = fallbackQuestionsByType[campaignType].map((question) => ({
      ...question,
      id: crypto.randomUUID(),
    }));
  }

  if (!questions.some((question) => question.type === "text")) {
    questions.push({
      id: crypto.randomUUID(),
      type: "text",
      question: "Any additional comments or suggestions?",
      required: false,
    });
  }

  return {
    name: inferCampaignName(instruction, campaignType),
    description:
      instruction.length > 240
        ? `${instruction.slice(0, 237)}...`
        : instruction,
    questions,
  };
}

function parseCsvToInstruction(rawText: string): string {
  const rows = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const promptLines = rows.slice(0, 30).map((row) => {
    const firstCell = row.split(",")[0]?.trim();
    return firstCell || row;
  });

  return promptLines.join("\n");
}

function parseJsonToInstruction(rawText: string): string {
  try {
    const parsed = JSON.parse(rawText);

    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (typeof entry === "string") return entry;
          if (entry && typeof entry === "object" && "question" in entry) {
            return String((entry as { question: unknown }).question);
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    if (parsed && typeof parsed === "object") {
      const questionList = (parsed as { questions?: unknown }).questions;
      if (Array.isArray(questionList)) {
        return questionList
          .map((entry) => {
            if (typeof entry === "string") return entry;
            if (entry && typeof entry === "object" && "question" in entry) {
              return String((entry as { question: unknown }).question);
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }
    }
  } catch {
    return rawText;
  }

  return rawText;
}

export async function extractInstructionFromFile(file: File): Promise<string> {
  const rawText = await file.text();
  const text = normalizeInstruction(rawText);

  if (!text) {
    throw new Error("Uploaded file appears to be empty.");
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) {
    return parseCsvToInstruction(text);
  }

  if (lowerName.endsWith(".json")) {
    return parseJsonToInstruction(text);
  }

  return text;
}
