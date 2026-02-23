const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

type CampaignType =
  | "feedback"
  | "employee_survey"
  | "product_research"
  | "event_evaluation";

type QuestionType =
  | "rating"
  | "scale"
  | "multiple_choice"
  | "single_choice"
  | "label"
  | "textbox"
  | "textarea"
  | "combobox"
  | "checkbox_matrix"
  | "radio_matrix"
  | "date"
  | "file_upload"
  | "rank"
  | "text"
  | "nps";

interface CampaignQuestion {
  id: string;
  type: QuestionType;
  question: string;
  required: boolean;
  options?: string[];
  rows?: string[];
  columns?: string[];
  min?: number;
  max?: number;
}

interface DraftResponse {
  name: string;
  description: string;
  questions: CampaignQuestion[];
}

const fallbackByType: Record<CampaignType, Omit<CampaignQuestion, "id">[]> = {
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
      type: "single_choice",
      question: "How likely are you to recommend us?",
      required: true,
      options: [
        "Very unlikely",
        "Unlikely",
        "Neutral",
        "Likely",
        "Very likely",
      ],
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
      type: "single_choice",
      question: "How supported do you feel by leadership?",
      required: true,
      options: [
        "Very unsupported",
        "Unsupported",
        "Neutral",
        "Supported",
        "Very supported",
      ],
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
      type: "single_choice",
      question: "How easy is this product to adopt?",
      required: true,
      options: ["Very difficult", "Difficult", "Neutral", "Easy", "Very easy"],
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
      type: "single_choice",
      question: "How likely are you to attend future events?",
      required: true,
      options: [
        "Very unlikely",
        "Unlikely",
        "Neutral",
        "Likely",
        "Very likely",
      ],
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

function normalizeQuestionType(value: unknown): QuestionType {
  if (
    value === "rating" ||
    value === "scale" ||
    value === "multiple_choice" ||
    value === "single_choice" ||
    value === "label" ||
    value === "textbox" ||
    value === "textarea" ||
    value === "combobox" ||
    value === "checkbox_matrix" ||
    value === "radio_matrix" ||
    value === "date" ||
    value === "file_upload" ||
    value === "rank" ||
    value === "text" ||
    value === "nps"
  ) {
    return value;
  }
  return "text";
}

function sanitizeQuestion(input: unknown): CampaignQuestion | null {
  const payload = input as {
    question?: unknown;
    type?: unknown;
    required?: unknown;
    options?: unknown;
    rows?: unknown;
    columns?: unknown;
    min?: unknown;
    max?: unknown;
  };

  const questionText = String(payload.question || "").trim();
  if (!questionText) return null;

  const type = normalizeQuestionType(payload.type);
  const required = Boolean(payload.required);

  const question: CampaignQuestion = {
    id: crypto.randomUUID(),
    type,
    question: questionText,
    required,
  };

  if (
    type === "multiple_choice" ||
    type === "single_choice" ||
    type === "combobox" ||
    type === "rank"
  ) {
    const options = Array.isArray(payload.options)
      ? payload.options
          .map((option: unknown) => String(option).trim())
          .filter(Boolean)
      : [];
    question.options =
      options.length >= 2 ? options : ["Option 1", "Option 2", "Option 3"];
  }

  if (type === "checkbox_matrix" || type === "radio_matrix") {
    const rows = Array.isArray(payload.rows)
      ? payload.rows
          .map((row: unknown) => String(row).trim())
          .filter(Boolean)
      : [];
    const columns = Array.isArray(payload.columns)
      ? payload.columns
          .map((column: unknown) => String(column).trim())
          .filter(Boolean)
      : [];
    question.rows = rows.length > 0 ? rows : ["Row 1", "Row 2"];
    question.columns = columns.length > 0 ? columns : ["Option A", "Option B"];
  }

  if (type === "nps") {
    question.min = 0;
    question.max = 10;
  }

  if (type === "scale") {
    const min = Number(payload.min);
    const max = Number(payload.max);
    question.min = Number.isFinite(min) ? Math.max(0, min) : 1;
    question.max = Number.isFinite(max) ? Math.min(10, max) : 10;
  }

  if (type === "rating") {
    question.min = 1;
    question.max = 5;
  }

  return question;
}

function buildFallbackDraft(
  campaignType: CampaignType,
  instruction: string,
): DraftResponse {
  const name =
    instruction
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 8) || "Generated Campaign";

  return {
    name: name.length > 70 ? `${name.slice(0, 67)}...` : name,
    description: instruction.slice(0, 240),
    questions: fallbackByType[campaignType].map((question) => ({
      ...question,
      id: crypto.randomUUID(),
    })),
  };
}

function parseJsonFromResponse(content: string): DraftResponse | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;

    const draftName = String(
      (parsed as { name?: unknown }).name || "Generated Campaign",
    ).trim();
    const draftDescription = String(
      (parsed as { description?: unknown }).description || "",
    ).trim();
    const rawQuestions = Array.isArray(
      (parsed as { questions?: unknown }).questions,
    )
      ? (parsed as { questions: unknown[] }).questions
      : [];

    const questions = rawQuestions
      .map((question) => sanitizeQuestion(question))
      .filter((question): question is CampaignQuestion => !!question)
      .slice(0, 30);

    if (questions.length === 0) return null;

    return {
      name: draftName || "Generated Campaign",
      description: draftDescription,
      questions,
    };
  } catch {
    return null;
  }
}

async function generateWithOpenAI(params: {
  instruction: string;
  campaignType: CampaignType;
  model: string;
  apiKey: string;
  baseUrl: string;
}): Promise<DraftResponse | null> {
  const { instruction, campaignType, model, apiKey, baseUrl } = params;

  const prompt = [
    "You are an expert survey designer.",
    "Generate a campaign draft as strict JSON with this schema:",
    '{"name": string, "description": string, "questions": Array<{"type":"rating"|"scale"|"multiple_choice"|"single_choice"|"label"|"textbox"|"textarea"|"combobox"|"checkbox_matrix"|"radio_matrix"|"date"|"file_upload"|"rank"|"text"|"nps","question":string,"required":boolean,"options"?:string[],"rows"?:string[],"columns"?:string[],"min"?:number,"max"?:number}>}',
    "Rules:",
    "- Output valid JSON only. No markdown.",
    "- Include 6-12 high-quality questions.",
    "- Make first 3 questions required.",
    "- Align with campaign type and user instruction.",
    "- For multiple_choice include 3-8 options.",
    "- For nps use min 0 max 10.",
    `Campaign type: ${campaignType}`,
    `Instruction:\n${instruction}`,
  ].join("\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: "Return only strict JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI provider error: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return null;

  return parseJsonFromResponse(content);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const instruction = String(body?.instruction || "").trim();
    const campaignType = (body?.campaignType || "feedback") as CampaignType;

    if (!instruction) {
      return new Response(
        JSON.stringify({ error: "Instruction is required." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const openAiBaseUrl =
      Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";

    let draft: DraftResponse | null = null;

    if (openAiApiKey) {
      try {
        draft = await generateWithOpenAI({
          instruction,
          campaignType,
          model: openAiModel,
          apiKey: openAiApiKey,
          baseUrl: openAiBaseUrl,
        });
      } catch (error) {
        console.error("AI generation failed:", error);
      }
    }

    if (!draft) {
      draft = buildFallbackDraft(campaignType, instruction);
    }

    return new Response(
      JSON.stringify({
        draft,
        source: openAiApiKey ? "ai_or_fallback" : "fallback",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "Unable to generate campaign draft." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
