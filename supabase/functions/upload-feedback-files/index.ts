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

type FileUploadFormat = "pdf" | "png" | "jpeg" | "excel" | "word";

interface CampaignQuestion {
  id: string;
  type: string;
  allowedFileTypes?: FileUploadFormat[];
  maxFiles?: number;
  maxFileSizeMb?: number;
}

const FORMAT_EXTENSIONS: Record<FileUploadFormat, string[]> = {
  pdf: [".pdf"],
  png: [".png"],
  jpeg: [".jpg", ".jpeg"],
  excel: [".xls", ".xlsx"],
  word: [".doc", ".docx"],
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getServiceHeaders(extraHeaders?: HeadersInit): HeadersInit {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    throw new Error("Missing Supabase service credentials.");
  }

  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...(extraHeaders || {}),
  };
}

async function serviceFetch(path: string, options: RequestInit) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL.");
  }

  return fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: getServiceHeaders(options.headers),
  });
}

async function postgrest<T>(path: string): Promise<T> {
  const response = await serviceFetch(`/rest/v1/${path}`, { method: "GET" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostgREST error (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCampaignQuestions(input: unknown): CampaignQuestion[] {
  if (isRecord(input) && Number(input.version) === 2 && Array.isArray(input.questions)) {
    return input.questions.filter(isRecord) as unknown as CampaignQuestion[];
  }

  if (Array.isArray(input)) {
    return input.filter(isRecord) as unknown as CampaignQuestion[];
  }

  return [];
}

function getAllowedFormats(question: CampaignQuestion): FileUploadFormat[] {
  const allowed = Array.isArray(question.allowedFileTypes)
    ? question.allowedFileTypes.filter(
        (value): value is FileUploadFormat =>
          value === "pdf" ||
          value === "png" ||
          value === "jpeg" ||
          value === "excel" ||
          value === "word",
      )
    : [];
  return allowed.length > 0 ? allowed : ["pdf"];
}

function getMaxFiles(question: CampaignQuestion) {
  return Math.max(1, Math.min(Number(question.maxFiles || 1), 10));
}

function getMaxFileSizeBytes(question: CampaignQuestion) {
  const mb = Math.max(1, Math.min(Number(question.maxFileSizeMb || 10), 50));
  return mb * 1024 * 1024;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hasAllowedExtension(fileName: string, allowedFormats: FileUploadFormat[]) {
  const lower = fileName.toLowerCase();
  return allowedFormats.some((format) =>
    FORMAT_EXTENSIONS[format].some((extension) => lower.endsWith(extension)),
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const formData = await request.formData();
    const code = String(formData.get("code") || "").trim();
    const questionId = String(formData.get("questionId") || "").trim();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!code || !questionId || files.length === 0) {
      return jsonResponse(400, { error: "Code, questionId, and at least one file are required." });
    }

    const links = await postgrest<
      Array<{
        is_active: boolean;
        campaign: { questions: unknown; start_date: string; end_date: string } | null;
      }>
    >(
      `company_campaign_links?unique_code=eq.${encodeURIComponent(
        code,
      )}&select=is_active,campaign:campaign_id(questions,start_date,end_date)&limit=1`,
    );

    const link = links[0];
    if (!link?.is_active || !link.campaign) {
      return jsonResponse(404, { error: "This feedback link is not valid for uploads." });
    }

    const now = new Date();
    const startDate = new Date(link.campaign.start_date);
    const endDate = new Date(link.campaign.end_date);
    endDate.setHours(23, 59, 59, 999);

    if (now < startDate || now > endDate) {
      return jsonResponse(400, { error: "This feedback campaign is not accepting uploads right now." });
    }

    const question = getCampaignQuestions(link.campaign.questions).find(
      (entry) => entry.id === questionId && entry.type === "file_upload",
    );
    if (!question) {
      return jsonResponse(404, { error: "The selected upload question was not found." });
    }

    const allowedFormats = getAllowedFormats(question);
    const maxFiles = getMaxFiles(question);
    const maxFileSizeBytes = getMaxFileSizeBytes(question);

    if (files.length > maxFiles) {
      return jsonResponse(400, {
        error: `You can upload up to ${maxFiles} file${maxFiles === 1 ? "" : "s"} for this question.`,
      });
    }

    const bucket = "feedback-uploads";
    const uploadedAt = new Date().toISOString();
    const uploadedFiles: Array<{
      name: string;
      originalName: string;
      sizeBytes: number;
      mimeType: string;
      bucket: string;
      path: string;
      uploadedAt: string;
    }> = [];

    for (const file of files) {
      if (file.size > maxFileSizeBytes) {
        return jsonResponse(400, {
          error: `${file.name} exceeds the allowed size for this question.`,
        });
      }

      if (!hasAllowedExtension(file.name, allowedFormats)) {
        return jsonResponse(400, {
          error: `${file.name} is not one of the allowed file types for this question.`,
        });
      }

      const objectPath = `${code}/${questionId}/${crypto.randomUUID()}-${sanitizeFileName(
        file.name,
      )}`;

      const uploadResponse = await serviceFetch(
        `/storage/v1/object/${bucket}/${objectPath}`,
        {
          method: "POST",
          headers: {
            "x-upsert": "false",
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        },
      );

      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        throw new Error(`Storage upload failed (${uploadResponse.status}): ${text}`);
      }

      uploadedFiles.push({
        name: sanitizeFileName(file.name),
        originalName: file.name,
        sizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
        bucket,
        path: objectPath,
        uploadedAt,
      });
    }

    return jsonResponse(200, { files: uploadedFiles });
  } catch (error) {
    console.error("upload-feedback-files error:", error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Failed to upload files.",
    });
  }
});
