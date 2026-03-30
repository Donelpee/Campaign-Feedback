import type { CampaignQuestion, FileUploadFormat } from "./supabase-types";

export const FILE_UPLOAD_FORMAT_LABELS: Record<FileUploadFormat, string> = {
  pdf: "PDF",
  png: "PNG",
  jpeg: "JPEG",
  excel: "Excel",
  word: "Word",
};

export const FILE_UPLOAD_FORMAT_ACCEPT: Record<FileUploadFormat, string[]> = {
  pdf: [".pdf", "application/pdf"],
  png: [".png", "image/png"],
  jpeg: [".jpg", ".jpeg", "image/jpeg"],
  excel: [
    ".xls",
    ".xlsx",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  word: [
    ".doc",
    ".docx",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

const DEFAULT_FILE_UPLOAD_FORMATS: FileUploadFormat[] = ["pdf"];
const DEFAULT_MAX_FILES = 1;
const DEFAULT_MAX_FILE_SIZE_MB = 10;

export function getFileUploadFormats(question: CampaignQuestion): FileUploadFormat[] {
  const selected = (question.allowedFileTypes || []).filter(
    (value): value is FileUploadFormat => value in FILE_UPLOAD_FORMAT_ACCEPT,
  );
  return selected.length > 0 ? selected : DEFAULT_FILE_UPLOAD_FORMATS;
}

export function getFileUploadMaxFiles(question: CampaignQuestion): number {
  return Math.max(1, Math.min(Number(question.maxFiles || DEFAULT_MAX_FILES), 10));
}

export function getFileUploadMaxSizeMb(question: CampaignQuestion): number {
  return Math.max(
    1,
    Math.min(Number(question.maxFileSizeMb || DEFAULT_MAX_FILE_SIZE_MB), 50),
  );
}

export function buildFileUploadAccept(question: CampaignQuestion): string {
  return getFileUploadFormats(question)
    .flatMap((format) => FILE_UPLOAD_FORMAT_ACCEPT[format])
    .join(",");
}

export function formatFileUploadSummary(question: CampaignQuestion): string {
  const formats = getFileUploadFormats(question).map(
    (format) => FILE_UPLOAD_FORMAT_LABELS[format],
  );
  const maxFiles = getFileUploadMaxFiles(question);
  const maxSizeMb = getFileUploadMaxSizeMb(question);

  return `Upload up to ${maxFiles} supported file${maxFiles === 1 ? "" : "s"}: ${formats.join(", ")}. Max ${maxSizeMb} MB per file.`;
}

export function isAllowedUploadExtension(
  fileName: string,
  allowedFormats: FileUploadFormat[],
): boolean {
  const lower = fileName.toLowerCase();
  return allowedFormats.some((format) =>
    FILE_UPLOAD_FORMAT_ACCEPT[format].some(
      (candidate) => candidate.startsWith(".") && lower.endsWith(candidate),
    ),
  );
}
