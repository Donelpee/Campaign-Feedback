// Feedback form for campaign links (public)
// Accessibility: Semantic HTML, clear headings, accessible controls, ARIA labels
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SatisfactionSlider } from "@/components/feedback/SatisfactionSlider";
import { StarRating } from "@/components/feedback/StarRating";
import { LikertScale } from "@/components/feedback/LikertScale";
import { ImprovementAreas } from "@/components/feedback/ImprovementAreas";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Clock3,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from "lucide-react";
import type {
  CampaignQuestion,
  FeedbackFormData,
  SurveySection,
  UploadedFileAnswer,
} from "@/lib/supabase-types";
import {
  findQuestionRouteTarget,
  isSurveyQuestionVisible,
  normalizeCampaignSurvey,
} from "@/lib/campaign-survey";
import {
  buildFileUploadAccept,
  formatFileUploadSummary,
  getFileUploadMaxFiles,
  getFileUploadMaxSizeMb,
} from "@/lib/file-upload";
import {
  findOtherOptionLabel,
  getOtherAnswerKey,
  getQuestionIdFromOtherAnswerKey,
  isOtherOptionSelected,
  sanitizeQuestionOptions,
} from "@/lib/campaign-answer-utils";
import { parseDateOnlyEnd, parseDateOnlyStart } from "@/lib/date-utils";

type MatrixAnswer = Record<string, string | string[]>;
type DynamicAnswer =
  | number
  | string
  | string[]
  | MatrixAnswer
  | UploadedFileAnswer[];
interface LinkData {
  id: string;
  company_name: string;
  company_logo_url: string | null;
  campaign_name: string;
  campaign_description: string | null;
  campaign_type: string | null;
  campaign_sections: SurveySection[];
  campaign_questions: CampaignQuestion[];
  is_active: boolean;
  start_date: string;
  end_date: string;
  thank_you_display_name: string | null;
  thank_you_display_preference: string | null;
}

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
}

type FeedbackThemeStyle = CSSProperties & Record<`--${string}`, string>;

function getCampaignExpiryDate(endDate: string): Date {
  return parseDateOnlyEnd(endDate);
}

function getCountdownParts(endDate: string | null | undefined, currentTime: number): CountdownParts {
  if (!endDate) {
    return { days: 0, hours: 0, minutes: 0, isExpired: false };
  }

  const expiryMs = getCampaignExpiryDate(endDate).getTime();
  const remainingMs = Math.max(0, expiryMs - currentTime);
  const totalMinutes = Math.floor(remainingMs / (1000 * 60));

  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
    isExpired: remainingMs <= 0,
  };
}

const FEEDBACK_RESPONDER_SESSION_KEY = "feedback-responder-session-id";
const FEEDBACK_SUBMISSION_COOLDOWN_MINUTES = 5;
const FEEDBACK_SUBMISSION_COOLDOWN_MESSAGE = "Please try again after 5 minutes";
const FEEDBACK_SUBMISSION_COOLDOWN_PREFIX = "feedback-submission-cooldown:";

function getFeedbackResponderSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(FEEDBACK_RESPONDER_SESSION_KEY);
    if (existing && existing.trim().length > 0) {
      return existing;
    }

    const nextValue = crypto.randomUUID();
    window.localStorage.setItem(FEEDBACK_RESPONDER_SESSION_KEY, nextValue);
    return nextValue;
  } catch {
    return null;
  }
}

function getFeedbackSubmissionCooldownKey(code: string) {
  return `${FEEDBACK_SUBMISSION_COOLDOWN_PREFIX}${code}`;
}

function getActiveFeedbackSubmissionCooldown(code: string): number | null {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(getFeedbackSubmissionCooldownKey(code));
    if (!rawValue) return null;

    const expiresAt = Number(rawValue);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.localStorage.removeItem(getFeedbackSubmissionCooldownKey(code));
      return null;
    }

    return expiresAt;
  } catch {
    return null;
  }
}

function setFeedbackSubmissionCooldown(code: string, minutes = FEEDBACK_SUBMISSION_COOLDOWN_MINUTES) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getFeedbackSubmissionCooldownKey(code),
      String(Date.now() + minutes * 60 * 1000),
    );
  } catch {
    // Ignore local storage failures; the backend cooldown still applies.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (delta !== 0) {
    switch (max) {
      case r:
        hue = ((g - b) / delta) % 6;
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
        break;
    }
  }

  hue = Math.round((hue * 60 + 360) % 360);

  return {
    h: hue,
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

function buildFeedbackThemeStyle(
  hue: number,
  saturation: number,
  lightness: number,
): FeedbackThemeStyle {
  const baseSaturation = clamp(saturation, 42, 78);
  const accentLightness = clamp(lightness, 34, 52);

  return {
    "--feedback-radial-a": `hsla(${hue}, ${clamp(baseSaturation - 2, 40, 78)}%, 78%, 0.2)`,
    "--feedback-radial-b": `hsla(${(hue + 14) % 360}, ${clamp(baseSaturation - 6, 34, 72)}%, 74%, 0.18)`,
    "--feedback-radial-c": `hsla(${(hue + 28) % 360}, ${clamp(baseSaturation - 10, 28, 66)}%, 68%, 0.16)`,
    "--feedback-bg-top": `hsl(${hue}, ${clamp(baseSaturation - 20, 28, 60)}%, 95%)`,
    "--feedback-bg-mid": `hsl(${hue}, ${clamp(baseSaturation - 16, 30, 62)}%, 91%)`,
    "--feedback-bg-bottom": `hsl(${hue}, ${clamp(baseSaturation - 10, 32, 64)}%, 87%)`,
    "--feedback-header-border": `hsla(${hue}, ${clamp(baseSaturation - 8, 36, 72)}%, 76%, 0.86)`,
    "--feedback-header-top": `hsla(${hue}, ${clamp(baseSaturation - 18, 24, 60)}%, 99%, 0.96)`,
    "--feedback-header-bottom": `hsla(${hue}, ${clamp(baseSaturation - 10, 30, 66)}%, 94%, 0.98)`,
    "--feedback-header-shadow": `hsla(${hue}, ${clamp(baseSaturation - 6, 30, 72)}%, 36%, 0.16)`,
    "--feedback-question-border": `hsla(${hue}, ${clamp(baseSaturation - 10, 34, 68)}%, 78%, 0.9)`,
    "--feedback-question-top": `hsla(${hue}, ${clamp(baseSaturation - 24, 20, 56)}%, 100%, 0.97)`,
    "--feedback-question-bottom": `hsla(${hue}, ${clamp(baseSaturation - 16, 24, 60)}%, 95%, 0.98)`,
    "--feedback-question-shadow": `hsla(${hue}, ${clamp(baseSaturation - 8, 28, 68)}%, 34%, 0.11)`,
    "--feedback-question-inner": `hsla(${hue}, ${clamp(baseSaturation - 12, 28, 64)}%, 86%, 0.9)`,
    "--feedback-question-hover": `hsla(${hue}, ${clamp(baseSaturation - 2, 36, 78)}%, 74%, 0.95)`,
    "--feedback-section-border": `hsla(${hue}, ${clamp(baseSaturation + 2, 44, 82)}%, ${accentLightness}%, 0.92)`,
    "--feedback-section-top": `hsla(${hue}, ${clamp(baseSaturation - 8, 34, 72)}%, 94%, 0.99)`,
    "--feedback-section-bottom": `hsla(${hue}, ${clamp(baseSaturation - 4, 36, 74)}%, 88%, 0.99)`,
    "--feedback-section-shadow": `hsla(${hue}, ${clamp(baseSaturation, 38, 76)}%, 32%, 0.2)`,
    "--feedback-section-inner": `hsla(${hue}, ${clamp(baseSaturation - 4, 34, 74)}%, 72%, 0.88)`,
  };
}

const DEFAULT_FEEDBACK_THEME_STYLE = buildFeedbackThemeStyle(210, 58, 44);

async function extractFeedbackThemeStyleFromLogo(
  logoUrl: string,
): Promise<FeedbackThemeStyle> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.referrerPolicy = "no-referrer";
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Unable to load logo colors."));
    nextImage.src = logoUrl;
  });

  const canvas = document.createElement("canvas");
  const size = 48;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas context is unavailable.");
  }

  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);

  const { data } = context.getImageData(0, 0, size, size);
  let totalWeight = 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.35) continue;

    const pixelRed = data[index];
    const pixelGreen = data[index + 1];
    const pixelBlue = data[index + 2];
    const max = Math.max(pixelRed, pixelGreen, pixelBlue);
    const min = Math.min(pixelRed, pixelGreen, pixelBlue);
    const contrast = max - min;
    const brightness = (pixelRed + pixelGreen + pixelBlue) / 3;

    if (brightness > 244 && contrast < 18) continue;

    const saturationWeight = contrast / 255;
    const brightnessWeight = brightness < 42 ? 0.55 : 1;
    const weight = alpha * (0.4 + saturationWeight * 1.4) * brightnessWeight;

    red += pixelRed * weight;
    green += pixelGreen * weight;
    blue += pixelBlue * weight;
    totalWeight += weight;
  }

  if (totalWeight < 1) {
    throw new Error("Logo colors were too faint to sample.");
  }

  const themeColor = rgbToHsl(
    Math.round(red / totalWeight),
    Math.round(green / totalWeight),
    Math.round(blue / totalWeight),
  );

  return buildFeedbackThemeStyle(
    themeColor.h,
    clamp(themeColor.s, 44, 78),
    clamp(themeColor.l, 36, 50),
  );
}

export default function FeedbackForm() {
  // Routing and state
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sectionHistory, setSectionHistory] = useState<string[]>([]);
  const [pendingTargetQuestionId, setPendingTargetQuestionId] = useState<string | null>(null);
  const [feedbackThemeStyle, setFeedbackThemeStyle] = useState<FeedbackThemeStyle>(
    DEFAULT_FEEDBACK_THEME_STYLE,
  );
  const pageTopRef = useRef<HTMLDivElement | null>(null);
  const formStartRef = useRef<HTMLDivElement | null>(null);
  const previousSectionIndexRef = useRef<number | null>(null);
  const [dynamicAnswers, setDynamicAnswers] = useState<
    Record<string, DynamicAnswer>
  >({});
  const [uploadingQuestions, setUploadingQuestions] = useState<Record<string, boolean>>({});
  const [fileUploadErrors, setFileUploadErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FeedbackFormData>({
    overall_satisfaction: 5,
    service_quality: 3,
    recommendation_likelihood: 3,
    improvement_areas: [],
    additional_comments: "",
  });
  const isPreviewMode = searchParams.get("preview") === "1";
  const isCooldownBlocked = loadError === FEEDBACK_SUBMISSION_COOLDOWN_MESSAGE;

  const getOtherDetails = useCallback(
    (questionId: string) => String(dynamicAnswers[getOtherAnswerKey(questionId)] ?? ""),
    [dynamicAnswers],
  );

  const clearOtherDetails = useCallback((questionId: string) => {
    setDynamicAnswers((prev) => {
      const next = { ...prev };
      delete next[getOtherAnswerKey(questionId)];
      return next;
    });
  }, []);

  const setOtherDetails = useCallback((questionId: string, value: string) => {
    setDynamicAnswers((prev) => ({
      ...prev,
      [getOtherAnswerKey(questionId)]: value,
    }));
  }, []);

  const initializeDynamicAnswers = useCallback(
    (questions: CampaignQuestion[]) => {
      if (questions.length === 0) {
        setDynamicAnswers({});
        return;
      }

      const initial: Record<string, DynamicAnswer> = {};
      questions.forEach((question) => {
        if (question.type === "multiple_choice") {
          initial[question.id] = [];
        } else if (question.type === "checkbox_matrix") {
          const rows = question.rows || [];
          const matrixState: MatrixAnswer = {};
          rows.forEach((row) => {
            matrixState[row] = [];
          });
          initial[question.id] = matrixState;
        } else if (question.type === "radio_matrix") {
          const rows = question.rows || [];
          const matrixState: MatrixAnswer = {};
          rows.forEach((row) => {
            matrixState[row] = "";
          });
          initial[question.id] = matrixState;
        } else if (question.type === "single_choice") {
          initial[question.id] = "";
        } else if (question.type === "combobox") {
          initial[question.id] = "";
        } else if (question.type === "rank") {
          initial[question.id] = [...(question.options || [])];
        } else if (question.type === "date") {
          initial[question.id] = "";
        } else if (question.type === "file_upload") {
          initial[question.id] = [];
        } else if (question.type === "textbox") {
          initial[question.id] = "";
        } else if (question.type === "textarea") {
          initial[question.id] = "";
        } else if (question.type === "label") {
          initial[question.id] = "";
        } else if (question.type === "text") {
          initial[question.id] = "";
        } else if (question.type === "nps") {
          initial[question.id] = question.min ?? 0;
        } else {
          initial[question.id] = question.min ?? 1;
        }
      });

      setDynamicAnswers(initial);
    },
    [],
  );

  const loadLinkData = useCallback(async () => {
    try {
      if (!code) return;

      if (!isPreviewMode && getActiveFeedbackSubmissionCooldown(code)) {
        setLoadError(FEEDBACK_SUBMISSION_COOLDOWN_MESSAGE);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_feedback_link_data", {
        p_code: code!,
      });

      if (error || !data) {
        setLoadError("This feedback link is not valid.");
        setIsLoading(false);
        return;
      }

      const linkInfo = data as unknown as {
        id: string;
        is_active: boolean;
        company_name: string;
        company_logo_url: string | null;
        campaign_name: string;
        campaign_description: string | null;
        campaign_type: string | null;
        campaign_questions: CampaignQuestion[] | null;
        start_date: string;
        end_date: string;
        thank_you_display_name: string | null;
        thank_you_display_preference: string | null;
      };

      if (!isPreviewMode && !linkInfo.is_active) {
        setLoadError("This feedback form is no longer accepting responses.");
        setIsLoading(false);
        return;
      }

      const now = new Date();
      const startDate = parseDateOnlyStart(linkInfo.start_date);
      const endDate = parseDateOnlyEnd(linkInfo.end_date);

      if (!isPreviewMode && now < startDate) {
        setLoadError("This feedback campaign has not started yet.");
        setIsLoading(false);
        return;
      }

      if (!isPreviewMode && now > endDate) {
        setLoadError("This feedback campaign has ended.");
        setIsLoading(false);
        return;
      }

      const normalizedSurvey = normalizeCampaignSurvey(linkInfo.campaign_questions);

      setLinkData({
        ...linkInfo,
        campaign_sections: normalizedSurvey.sections,
        campaign_questions: normalizedSurvey.questions,
      });
      initializeDynamicAnswers(normalizedSurvey.questions);
      setCurrentSectionIndex(0);
      setSectionHistory([]);
      setPendingTargetQuestionId(null);
      setLoadError(null);
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading link data:", err);
      setLoadError("Failed to load the feedback form. Please try again.");
      setIsLoading(false);
    }
  }, [code, initializeDynamicAnswers, isPreviewMode]);

  const incrementAccessCount = useCallback(async () => {
    if (!code) return;
    await supabase.rpc("increment_access_count", { link_code: code });
  }, [code]);

  useEffect(() => {
    if (!code) return;
    loadLinkData();
    if (!isPreviewMode) {
      incrementAccessCount();
    }
  }, [code, incrementAccessCount, isPreviewMode, loadLinkData]);

  useEffect(() => {
    if (isPreviewMode || !linkData?.end_date) return;

    setCurrentTime(Date.now());
    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPreviewMode, linkData?.end_date]);

  useEffect(() => {
    if (!linkData?.company_logo_url) {
      setFeedbackThemeStyle(DEFAULT_FEEDBACK_THEME_STYLE);
      return;
    }

    let isActive = true;

    void extractFeedbackThemeStyleFromLogo(linkData.company_logo_url)
      .then((nextTheme) => {
        if (isActive) {
          setFeedbackThemeStyle(nextTheme);
        }
      })
      .catch(() => {
        if (isActive) {
          setFeedbackThemeStyle(DEFAULT_FEEDBACK_THEME_STYLE);
        }
      });

    return () => {
      isActive = false;
    };
  }, [linkData?.company_logo_url]);

  const hasDynamicQuestions = (linkData?.campaign_questions?.length || 0) > 0;

  const isQuestionVisible = useCallback(
    (question: CampaignQuestion) => isSurveyQuestionVisible(question, dynamicAnswers),
    [dynamicAnswers],
  );

  const visibleDynamicQuestions = useMemo(() => {
    if (!linkData) return [];
    return (linkData.campaign_questions || []).filter((question) =>
      isQuestionVisible(question),
    );
  }, [isQuestionVisible, linkData]);

  const visibleSections = useMemo(() => {
    if (!linkData) return [];

    return (linkData.campaign_sections || [])
      .map((section) => ({
        ...section,
        questions: visibleDynamicQuestions.filter(
          (question) => question.sectionId === section.id,
        ),
      }))
      .filter((section) => section.questions.length > 0);
  }, [linkData, visibleDynamicQuestions]);

  const previewSections = useMemo(() => {
    if (!linkData) return [];

    return (linkData.campaign_sections || [])
      .map((section) => ({
        ...section,
        questions: (linkData.campaign_questions || []).filter(
          (question) => question.sectionId === section.id,
        ),
      }))
      .filter((section) => section.questions.length > 0);
  }, [linkData]);

  const displayedSections = isPreviewMode ? previewSections : visibleSections;

  useEffect(() => {
    if (isPreviewMode || visibleSections.length === 0) {
      setCurrentSectionIndex(0);
      setPendingTargetQuestionId(null);
      return;
    }

    setCurrentSectionIndex((previous) =>
      Math.min(previous, Math.max(visibleSections.length - 1, 0)),
    );
  }, [isPreviewMode, visibleSections]);

  useEffect(() => {
    if (isPreviewMode) {
      setSectionHistory([]);
      return;
    }

    const visibleSectionIds = new Set(visibleSections.map((section) => section.id));
    setSectionHistory((previous) =>
      previous.filter((sectionId) => visibleSectionIds.has(sectionId)),
    );
  }, [isPreviewMode, visibleSections]);

  const activeSection = visibleSections[currentSectionIndex] || null;
  const activeSectionQuestions = useMemo(
    () => activeSection?.questions || [],
    [activeSection],
  );
  const isLastSection = currentSectionIndex >= visibleSections.length - 1;
  const anyFilesUploading = Object.values(uploadingQuestions).some(Boolean);
  const canGoBack = sectionHistory.length > 0 || currentSectionIndex > 0;
  const totalQuestionCount = displayedSections.reduce(
    (sum, section) => sum + section.questions.length,
    0,
  );
  const displayedQuestionOrder = useMemo(
    () => displayedSections.flatMap((section) => section.questions),
    [displayedSections],
  );
  const countdownParts = useMemo(
    () => getCountdownParts(linkData?.end_date, currentTime),
    [currentTime, linkData?.end_date],
  );
  const thankYouSignoffName = useMemo(() => {
    const candidate = linkData?.thank_you_display_name?.trim();
    return candidate && candidate.length > 0 ? candidate : null;
  }, [linkData?.thank_you_display_name]);
  const thankYouMessage = useMemo(
    () =>
      !thankYouSignoffName
        ? "We appreciate your time and valuable input."
        : `${thankYouSignoffName} appreciates your time and valuable input.`,
    [thankYouSignoffName],
  );

  const getNextRouteDestination = useCallback(() => {
    for (const question of [...activeSectionQuestions].reverse()) {
      const routeTarget = findQuestionRouteTarget(question, dynamicAnswers[question.id]);
      if (!routeTarget) continue;

      const targetSectionIndex = visibleSections.findIndex(
        (section) => section.id === routeTarget.targetSectionId,
      );

      if (targetSectionIndex === -1) continue;

      return {
        sectionIndex: targetSectionIndex,
        sectionId: routeTarget.targetSectionId,
        questionId: routeTarget.targetQuestionId || null,
      };
    }

    return null;
  }, [activeSectionQuestions, dynamicAnswers, visibleSections]);

  const derivedPayload = useMemo(() => {
    if (!hasDynamicQuestions || !linkData) {
      return {
        overall_satisfaction: formData.overall_satisfaction,
        service_quality: formData.service_quality,
        recommendation_likelihood: formData.recommendation_likelihood,
        improvement_areas: formData.improvement_areas,
        additional_comments: formData.additional_comments,
        answers: {},
      };
    }

    const numericByType = {
      scale: linkData.campaign_questions.find((q) => q.type === "scale"),
      rating: linkData.campaign_questions.find((q) => q.type === "rating"),
      nps: linkData.campaign_questions.find((q) => q.type === "nps"),
      multiple: linkData.campaign_questions.find(
        (q) => q.type === "multiple_choice",
      ),
      single: linkData.campaign_questions.find(
        (q) => q.type === "single_choice",
      ),
      text: linkData.campaign_questions.find(
        (q) => q.type === "textbox" || q.type === "textarea" || q.type === "text",
      ),
    };

    const scaleAnswer = numericByType.scale
      ? Number(dynamicAnswers[numericByType.scale.id] ?? 5)
      : 5;
    const ratingAnswer = numericByType.rating
      ? Number(dynamicAnswers[numericByType.rating.id] ?? 3)
      : 3;
    const npsAnswer = numericByType.nps
      ? Number(dynamicAnswers[numericByType.nps.id] ?? 5)
      : 5;
    const multipleAnswer = numericByType.multiple
      ? ((dynamicAnswers[numericByType.multiple.id] as string[] | undefined) ??
        [])
      : [];
    const singleAnswer = numericByType.single
      ? String(dynamicAnswers[numericByType.single.id] ?? "")
      : "";
    const textAnswer = numericByType.text
      ? String(dynamicAnswers[numericByType.text.id] ?? "")
      : singleAnswer;

    return {
      overall_satisfaction: Math.max(1, Math.min(10, scaleAnswer)),
      service_quality: Math.max(1, Math.min(5, ratingAnswer)),
      recommendation_likelihood: Math.max(
        1,
        Math.min(5, Math.floor(npsAnswer / 2) + 1),
      ),
      improvement_areas: multipleAnswer,
      additional_comments: textAnswer,
      answers: Object.fromEntries(
        Object.entries(dynamicAnswers).filter(([questionId, value]) => {
          if (visibleDynamicQuestions.some((question) => question.id === questionId)) {
            return true;
          }

          const baseQuestionId = getQuestionIdFromOtherAnswerKey(questionId);
          if (!baseQuestionId) return false;

          return (
            visibleDynamicQuestions.some((question) => question.id === baseQuestionId) &&
            String(value ?? "").trim().length > 0
          );
        }),
      ),
    };
  }, [dynamicAnswers, formData, hasDynamicQuestions, linkData, visibleDynamicQuestions]);

  const isRequiredQuestionMissing = (question: CampaignQuestion) => {
    const answer = dynamicAnswers[question.id];
    const otherSelected = isOtherOptionSelected(question, answer);
    const otherDetailsMissing =
      otherSelected && getOtherDetails(question.id).trim().length === 0;

    if (!question.required) return otherDetailsMissing;

    if (question.type === "multiple_choice") {
      return !Array.isArray(answer) || answer.length === 0 || otherDetailsMissing;
    }
    if (question.type === "checkbox_matrix") {
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return true;
      const matrix = answer as MatrixAnswer;
      return Object.values(matrix).some((value) => !Array.isArray(value) || value.length === 0);
    }
    if (question.type === "radio_matrix") {
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return true;
      const matrix = answer as MatrixAnswer;
      return Object.values(matrix).some((value) => String(value ?? "").trim().length === 0);
    }
    if (question.type === "single_choice") {
      return String(answer ?? "").trim().length === 0 || otherDetailsMissing;
    }
    if (question.type === "combobox") {
      return String(answer ?? "").trim().length === 0 || otherDetailsMissing;
    }
    if (question.type === "rank") {
      return !Array.isArray(answer) || answer.length === 0;
    }
    if (question.type === "file_upload") {
      return !Array.isArray(answer) || answer.length === 0;
    }
    if (question.type === "date") {
      return String(answer ?? "").trim().length === 0;
    }
    if (question.type === "textbox" || question.type === "textarea") {
      return String(answer ?? "").trim().length === 0;
    }
    if (question.type === "label") {
      return false;
    }
    if (question.type === "text") {
      return String(answer ?? "").trim().length === 0;
    }
    return (
      answer === undefined ||
      answer === null ||
      Number.isNaN(Number(answer)) ||
      otherDetailsMissing
    );
  };

  const validateDynamicQuestions = (questionsToValidate = visibleDynamicQuestions) => {
    if (!hasDynamicQuestions || !linkData) return true;

    const missingRequired = questionsToValidate.some((question) =>
      isRequiredQuestionMissing(question),
    );

    if (missingRequired) {
      setSubmitError(
        "Please complete all required questions and add details for any Other selections before submitting.",
      );
      return false;
    }

    setSubmitError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkData || !code || isPreviewMode) return;

    setSubmitError(null);
    setShowValidationErrors(true);
    if (!validateDynamicQuestions()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke("submit-feedback-response", {
        body: {
          code,
          clientSessionId: getFeedbackResponderSessionId(),
          payload: {
            overall_satisfaction: derivedPayload.overall_satisfaction,
            service_quality: derivedPayload.service_quality,
            recommendation_likelihood: derivedPayload.recommendation_likelihood,
            improvement_areas: derivedPayload.improvement_areas,
            additional_comments: derivedPayload.additional_comments || null,
            answers: derivedPayload.answers,
          },
        },
      });

      if (error) throw error;

      setFeedbackSubmissionCooldown(code);
      setIsSubmitted(true);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      if (err instanceof FunctionsHttpError) {
        try {
          const errorBody = await err.context.json();
          const errorMessage =
            typeof errorBody?.error === "string" && errorBody.error.trim()
              ? errorBody.error
              : "Failed to submit your feedback. Please try again.";
          if (errorMessage === FEEDBACK_SUBMISSION_COOLDOWN_MESSAGE) {
            setFeedbackSubmissionCooldown(code);
          }
          setSubmitError(errorMessage);
          return;
        } catch {
          setSubmitError("Failed to submit your feedback. Please try again.");
          return;
        }
      }

      const fallbackMessage =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to submit your feedback. Please try again.";
      setSubmitError(fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueSection = () => {
    setSubmitError(null);
    setShowValidationErrors(true);
    if (!validateDynamicQuestions(activeSectionQuestions)) return;

    const routeDestination = getNextRouteDestination();
    const activeSectionId = activeSection?.id;

    if (routeDestination) {
      if (activeSectionId) {
        setSectionHistory((previous) => [...previous, activeSectionId]);
      }
      setCurrentSectionIndex(routeDestination.sectionIndex);
      setPendingTargetQuestionId(routeDestination.questionId);
      return;
    }

    const nextIndex = Math.min(
      currentSectionIndex + 1,
      Math.max(visibleSections.length - 1, 0),
    );

    if (activeSectionId && nextIndex !== currentSectionIndex) {
      setSectionHistory((previous) => [...previous, activeSectionId]);
    }

    setCurrentSectionIndex(nextIndex);
    setPendingTargetQuestionId(null);
  };

  useEffect(() => {
    if (!pendingTargetQuestionId) return;

    const elementId = `feedback-question-${pendingTargetQuestionId}`;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    const timeout = window.setTimeout(() => {
      setPendingTargetQuestionId(null);
    }, 600);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pendingTargetQuestionId, currentSectionIndex]);

  useEffect(() => {
    if (isLoading || loadError || isSubmitted || pendingTargetQuestionId || !linkData?.id) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      pageTopRef.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
      pageTopRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isLoading, loadError, isSubmitted, pendingTargetQuestionId, linkData?.id]);

  useEffect(() => {
    if (
      isPreviewMode ||
      isLoading ||
      loadError ||
      isSubmitted ||
      pendingTargetQuestionId
    ) {
      if (pendingTargetQuestionId) {
        previousSectionIndexRef.current = currentSectionIndex;
      }
      return;
    }

    const previousIndex = previousSectionIndexRef.current;
    previousSectionIndexRef.current = currentSectionIndex;

    if (previousIndex === null || previousIndex === currentSectionIndex) {
      return;
    }

    const firstQuestionId = activeSectionQuestions[0]?.id;
    const frame = window.requestAnimationFrame(() => {
      if (currentSectionIndex === 0 || !firstQuestionId) {
        pageTopRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        pageTopRef.current?.focus({ preventScroll: true });
        return;
      }

      const questionElement = document.getElementById(
        `feedback-question-${firstQuestionId}`,
      );
      questionElement?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      questionElement?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    activeSectionQuestions,
    currentSectionIndex,
    isLoading,
    isPreviewMode,
    isSubmitted,
    loadError,
    pendingTargetQuestionId,
  ]);

  if (isLoading) {
    return (
      <div className="admin-shell-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading feedback form...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="admin-shell-bg min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">
                {isCooldownBlocked ? "Please Wait" : "Unable to Load Form"}
              </h2>
              <p className="mt-2 text-muted-foreground">{loadError}</p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => navigate("/")}
              >
                Go to Homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="admin-shell-bg min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
              <h2 className="mt-4 text-2xl font-semibold text-foreground">
                Thank You!
              </h2>
              <p className="mt-2 text-muted-foreground">
                Your feedback has been submitted successfully.
              </p>
              <div className="mt-5 space-y-2">
                {thankYouSignoffName && (
                  <p className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                    {thankYouSignoffName}
                  </p>
                )}
                <p className="text-sm font-medium text-muted-foreground md:text-base">
                  {thankYouMessage}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleMultipleChoiceToggle = (questionId: string, option: string) => {
    if (isPreviewMode) return;

    const current = (dynamicAnswers[questionId] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter((value) => value !== option)
      : [...current, option];

    setDynamicAnswers((prev) => {
      const nextAnswers = { ...prev, [questionId]: next };
      if (findOtherOptionLabel(next) === null) {
        delete nextAnswers[getOtherAnswerKey(questionId)];
      }
      return nextAnswers;
    });
  };

  const handleRemoveUploadedFile = (questionId: string, filePath: string) => {
    setDynamicAnswers((prev) => {
      const current = (prev[questionId] as UploadedFileAnswer[] | undefined) ?? [];
      return {
        ...prev,
        [questionId]: current.filter((file) => file.path !== filePath),
      };
    });
  };

  const handleFileUpload = async (question: CampaignQuestion, fileList: FileList | null) => {
    if (!code || !fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const maxFiles = getFileUploadMaxFiles(question);
    const maxSizeBytes = getFileUploadMaxSizeMb(question) * 1024 * 1024;
    const currentUploads =
      (dynamicAnswers[question.id] as UploadedFileAnswer[] | undefined) ?? [];

    if (currentUploads.length + files.length > maxFiles) {
      setFileUploadErrors((prev) => ({
        ...prev,
        [question.id]: `You can upload up to ${maxFiles} file${maxFiles === 1 ? "" : "s"} for this question.`,
      }));
      return;
    }

    const oversizedFile = files.find((file) => file.size > maxSizeBytes);
    if (oversizedFile) {
      setFileUploadErrors((prev) => ({
        ...prev,
        [question.id]: `${oversizedFile.name} exceeds the ${getFileUploadMaxSizeMb(question)} MB per-file limit.`,
      }));
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!supabaseUrl || !publishableKey) {
      setFileUploadErrors((prev) => ({
        ...prev,
        [question.id]: "File uploads are not configured for this environment.",
      }));
      return;
    }
    const uploadUrl = `${supabaseUrl}/functions/v1/upload-feedback-files`;

    const body = new FormData();
    body.append("code", code);
    body.append("questionId", question.id);
    files.forEach((file) => body.append("files", file));

    setUploadingQuestions((prev) => ({ ...prev, [question.id]: true }));
    setFileUploadErrors((prev) => ({ ...prev, [question.id]: "" }));

    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        body,
      });

      const result = (await response.json()) as {
        error?: string;
        files?: UploadedFileAnswer[];
      };

      if (!response.ok) {
        throw new Error(result.error || "Upload failed.");
      }

      const uploadedFiles = Array.isArray(result.files) ? result.files : [];
      setDynamicAnswers((prev) => ({
        ...prev,
        [question.id]: [...currentUploads, ...uploadedFiles],
      }));
    } catch (error) {
      console.error("Error uploading feedback files:", error);
      setFileUploadErrors((prev) => ({
        ...prev,
        [question.id]:
          error instanceof Error ? error.message : "Failed to upload the selected files.",
      }));
    } finally {
      setUploadingQuestions((prev) => ({ ...prev, [question.id]: false }));
    }
  };

  const renderDynamicQuestion = (question: CampaignQuestion) => {
    const isRequired = question.required;
    const commonDescription = isRequired ? "Required" : "Optional";
    const otherDetails = getOtherDetails(question.id);
    const showOtherDetails = isOtherOptionSelected(question, dynamicAnswers[question.id]);

    if (question.type === "scale") {
      return (
        <SatisfactionSlider
          value={Number(dynamicAnswers[question.id] ?? question.min ?? 1)}
          onChange={(value) => {
            if (isPreviewMode) return;
            setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }));
          }}
          min={question.min ?? 1}
          max={question.max ?? 10}
          label={question.question}
          description={commonDescription}
          disabled={isPreviewMode}
        />
      );
    }

    if (question.type === "rating") {
      return (
        <StarRating
          value={Number(dynamicAnswers[question.id] ?? 3)}
          onChange={(value) => {
            if (isPreviewMode) return;
            setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }));
          }}
          label={question.question}
          description={commonDescription}
          disabled={isPreviewMode}
        />
      );
    }

    if (question.type === "nps") {
      return (
        <SatisfactionSlider
          value={Number(dynamicAnswers[question.id] ?? 0)}
          onChange={(value) => {
            if (isPreviewMode) return;
            setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }));
          }}
          min={question.min ?? 0}
          max={question.max ?? 10}
          label={question.question}
          description={commonDescription}
          disabled={isPreviewMode}
        />
      );
    }

    if (question.type === "multiple_choice") {
      const options = sanitizeQuestionOptions(question.options);
      const selected =
        (dynamicAnswers[question.id] as string[] | undefined) ?? [];
      const otherOption = findOtherOptionLabel(options);

      return (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">{question.question}</h3>
            <p className="text-sm text-muted-foreground">{commonDescription}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all border-border hover:border-muted-foreground/50 hover:bg-muted"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  disabled={isPreviewMode}
                  onCheckedChange={() =>
                    handleMultipleChoiceToggle(question.id, option)
                  }
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
          {otherOption && showOtherDetails && (
            <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
              <Label htmlFor={`${question.id}-other-details`} className="text-sm font-medium">
                Tell us more about "{otherOption}"
              </Label>
              <Input
                id={`${question.id}-other-details`}
                value={otherDetails}
                onChange={(event) => setOtherDetails(question.id, event.target.value)}
                placeholder="Add more context"
                disabled={isPreviewMode}
              />
            </div>
          )}
        </div>
      );
    }

    if (question.type === "combobox") {
      const options = sanitizeQuestionOptions(question.options);
      const selected = String(dynamicAnswers[question.id] ?? "");
      const otherOption = findOtherOptionLabel(options);
      return (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">{question.question}</h3>
            <p className="text-sm text-muted-foreground">{commonDescription}</p>
          </div>
          <Select
            value={selected}
            onValueChange={(value) => {
              if (isPreviewMode) return;
              setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }));
              if (
                !isOtherOptionSelected({ type: question.type, options: question.options }, value)
              ) {
                clearOtherDetails(question.id);
              }
            }}
            disabled={isPreviewMode}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, index) => (
                <SelectItem key={`${option}-${index}`} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {otherOption && showOtherDetails && (
            <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
              <Label htmlFor={`${question.id}-other-details`} className="text-sm font-medium">
                Tell us more about "{otherOption}"
              </Label>
              <Input
                id={`${question.id}-other-details`}
                value={otherDetails}
                onChange={(event) => setOtherDetails(question.id, event.target.value)}
                placeholder="Add more context"
                disabled={isPreviewMode}
              />
            </div>
          )}
        </div>
      );
    }

    if (question.type === "single_choice") {
      const options = sanitizeQuestionOptions(question.options);
      const selected = String(dynamicAnswers[question.id] ?? "");
      const otherOption = findOtherOptionLabel(options);

      return (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">{question.question}</h3>
            <p className="text-sm text-muted-foreground">{commonDescription}</p>
          </div>
          <RadioGroup
            value={selected}
            onValueChange={(value) => {
              if (isPreviewMode) return;
              setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }));
              if (
                !isOtherOptionSelected({ type: question.type, options: question.options }, value)
              ) {
                clearOtherDetails(question.id);
              }
            }}
            className="space-y-3"
          >
            {options.map((option) => {
              const optionId = `${question.id}-${option}`;
              return (
                <div
                  key={option}
                  className="flex items-center space-x-2 rounded-lg border p-3"
                >
                  <RadioGroupItem value={option} id={optionId} disabled={isPreviewMode} />
                  <Label htmlFor={optionId} className="font-normal text-sm">
                    {option}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
          {otherOption && showOtherDetails && (
            <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
              <Label htmlFor={`${question.id}-other-details`} className="text-sm font-medium">
                Tell us more about "{otherOption}"
              </Label>
              <Input
                id={`${question.id}-other-details`}
                value={otherDetails}
                onChange={(event) => setOtherDetails(question.id, event.target.value)}
                placeholder="Add more context"
                disabled={isPreviewMode}
              />
            </div>
          )}
        </div>
      );
    }

    if (question.type === "checkbox_matrix" || question.type === "radio_matrix") {
      const rows = question.rows || [];
      const columns = question.columns || [];
      const value =
        (dynamicAnswers[question.id] as MatrixAnswer | undefined) || {};

      const toggleMatrixCheckbox = (row: string, column: string) => {
        if (isPreviewMode) return;
        const rowSelection = Array.isArray(value[row]) ? (value[row] as string[]) : [];
        const nextSelection = rowSelection.includes(column)
          ? rowSelection.filter((item) => item !== column)
          : [...rowSelection, column];
        setDynamicAnswers((prev) => ({
          ...prev,
          [question.id]: {
            ...value,
            [row]: nextSelection,
          },
        }));
      };

      const setMatrixRadio = (row: string, column: string) => {
        if (isPreviewMode) return;
        setDynamicAnswers((prev) => ({
          ...prev,
          [question.id]: {
            ...value,
            [row]: column,
          },
        }));
      };

      return (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">{question.question}</h3>
            <p className="text-sm text-muted-foreground">{commonDescription}</p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <div
              className="grid gap-2 p-3"
              style={{
                gridTemplateColumns: `minmax(150px,1fr) repeat(${Math.max(columns.length, 1)}, minmax(110px,1fr))`,
              }}
            >
              <div />
              {columns.map((column) => (
                <div
                  key={`${question.id}-header-${column}`}
                  className="text-xs font-medium text-muted-foreground text-center"
                >
                  {column}
                </div>
              ))}

              {rows.map((row) => (
                <div key={`${question.id}-row-${row}`} className="contents">
                  <div className="text-sm">{row}</div>
                  {columns.map((column) => {
                    const cellId = `${question.id}-${row}-${column}`;
                    return (
                      <div key={cellId} className="mx-auto">
                        {question.type === "checkbox_matrix" ? (
                          <Checkbox
                            checked={
                              Array.isArray(value[row])
                                ? (value[row] as string[]).includes(column)
                                : false
                            }
                            disabled={isPreviewMode}
                            onCheckedChange={() => toggleMatrixCheckbox(row, column)}
                          />
                        ) : (
                          <input
                            type="radio"
                            name={`${question.id}-${row}`}
                            checked={String(value[row] ?? "") === column}
                            onChange={() => setMatrixRadio(row, column)}
                            disabled={isPreviewMode}
                            className="h-4 w-4 accent-primary"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (question.type === "date") {
      return (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{question.question}</h3>
          <p className="text-sm text-muted-foreground">{commonDescription}</p>
          <Input
            type="date"
            value={String(dynamicAnswers[question.id] ?? "")}
            disabled={isPreviewMode}
            onChange={(event) =>
              setDynamicAnswers((prev) => ({
                ...prev,
                [question.id]: event.target.value,
              }))
            }
          />
        </div>
      );
    }

    if (question.type === "file_upload") {
      const uploadedFiles =
        (dynamicAnswers[question.id] as UploadedFileAnswer[] | undefined) ?? [];
      const maxFiles = getFileUploadMaxFiles(question);
      const uploadSummary = formatFileUploadSummary(question);
      const uploadError = fileUploadErrors[question.id];
      const isUploading = Boolean(uploadingQuestions[question.id]);

      return (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">{question.question}</h3>
          <p className="text-sm text-muted-foreground">{commonDescription}</p>
          <p className="text-sm text-muted-foreground">{uploadSummary}</p>
          <Input
            type="file"
            multiple={maxFiles > 1}
            accept={buildFileUploadAccept(question)}
            disabled={isPreviewMode || isUploading || uploadedFiles.length >= maxFiles}
            onChange={(event) => {
              void handleFileUpload(question, event.target.files);
              event.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">
            Uploaded {uploadedFiles.length} of {maxFiles} allowed file
            {maxFiles === 1 ? "" : "s"}.
          </p>
          {isUploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading file{maxFiles === 1 ? "" : "s"}...
            </div>
          )}
          {uploadError && (
            <p className="text-sm font-medium text-destructive">{uploadError}</p>
          )}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleRemoveUploadedFile(question.id, file.path)}
                    title="Remove file"
                    disabled={isPreviewMode}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (question.type === "rank") {
      const current =
        (dynamicAnswers[question.id] as string[] | undefined) ||
        question.options ||
        [];

      const moveRank = (from: number, to: number) => {
        if (isPreviewMode) return;
        if (to < 0 || to >= current.length) return;
        const reordered = [...current];
        const [item] = reordered.splice(from, 1);
        reordered.splice(to, 0, item);
        setDynamicAnswers((prev) => ({ ...prev, [question.id]: reordered }));
      };

      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground">{question.question}</h3>
            <p className="text-sm text-muted-foreground">{commonDescription}</p>
          </div>
          <div className="space-y-2">
            {current.map((item, itemIndex) => (
              <div
                key={`${question.id}-${item}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm">
                  {itemIndex + 1}. {item}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveRank(itemIndex, itemIndex - 1)}
                    disabled={isPreviewMode || itemIndex === 0}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveRank(itemIndex, itemIndex + 1)}
                    disabled={isPreviewMode || itemIndex === current.length - 1}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (question.type === "label") {
      return (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
          <p className="text-sm text-foreground">{question.question}</p>
          <p className="text-xs text-muted-foreground">Informational label</p>
        </div>
      );
    }

    if (question.type === "textbox" || question.type === "text") {
      return (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{question.question}</h3>
          <p className="text-sm text-muted-foreground">{commonDescription}</p>
          <Input
            value={String(dynamicAnswers[question.id] ?? "")}
            disabled={isPreviewMode}
            onChange={(event) =>
              setDynamicAnswers((prev) => ({
                ...prev,
                [question.id]: event.target.value,
              }))
            }
            placeholder="Your response"
          />
        </div>
      );
    }

    if (question.type === "textarea") {
      return (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{question.question}</h3>
          <p className="text-sm text-muted-foreground">{commonDescription}</p>
          <Textarea
            value={String(dynamicAnswers[question.id] ?? "")}
            disabled={isPreviewMode}
            onChange={(event) =>
              setDynamicAnswers((prev) => ({
                ...prev,
                [question.id]: event.target.value,
              }))
            }
            placeholder="Your response"
            rows={4}
            className="resize-none"
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <h3 className="font-medium text-foreground">{question.question}</h3>
        <p className="text-sm text-muted-foreground">{commonDescription}</p>
        <Input
          value={String(dynamicAnswers[question.id] ?? "")}
          disabled={isPreviewMode}
          onChange={(event) =>
            setDynamicAnswers((prev) => ({
              ...prev,
              [question.id]: event.target.value,
            }))
          }
          placeholder="Your response"
        />
      </div>
    );
  };

  return (
    <div
      ref={pageTopRef}
      tabIndex={-1}
      className="admin-shell-bg warm-feedback-bg min-h-screen px-4 py-8 outline-none"
      style={feedbackThemeStyle}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="warm-feedback-header rounded-[28px] border border-border/60 p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              {linkData?.company_logo_url ? (
                <div>
                  <img
                    src={linkData.company_logo_url}
                    alt={`${linkData.company_name} logo`}
                    className="h-32 w-auto object-contain md:h-40"
                  />
                  {linkData.company_name && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {linkData.company_name}
                    </p>
                  )}
                </div>
              ) : linkData?.company_name ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{linkData.company_name}</span>
                </div>
              ) : null}
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {linkData?.campaign_name}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  {linkData?.campaign_description ||
                    "Your feedback is completely anonymous and helps us improve our services."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/75 p-4 md:min-w-[240px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Mode
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {isPreviewMode ? "Preview only" : "Live form"}
                  </p>
                </div>
                {!isPreviewMode && (
                  <div className="min-w-[136px] rounded-xl border-2 border-amber-300/80 bg-background/85 px-3 py-2 text-right shadow-sm">
                    <div className="flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>Expires In</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-foreground">
                      {countdownParts.isExpired
                        ? "Expired"
                        : `${countdownParts.days}d ${countdownParts.hours}h ${countdownParts.minutes}m`}
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Sections</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {hasDynamicQuestions ? displayedSections.length : 1}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Questions</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {hasDynamicQuestions ? totalQuestionCount : 5}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {isPreviewMode
                  ? "Preview keeps the published styling, disables responses, and shows all sections for review."
                  : "Complete each section and submit when you reach the end of the form."}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            ref={formStartRef}
            tabIndex={-1}
            className="space-y-6 outline-none"
          >
            {submitError && !isPreviewMode && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            {isPreviewMode && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex items-start gap-3 pt-6">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Preview mode is active.</p>
                    <p className="text-sm text-muted-foreground">
                      Inputs are intentionally disabled. Conditional questions and later sections are shown so you can review the full structure before publishing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {hasDynamicQuestions ? (
              isPreviewMode ? (
                displayedSections.length === 0 ? (
                  <Card className="warm-question-card transition-shadow duration-200">
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                      No sections are available in this campaign yet.
                    </CardContent>
                  </Card>
                ) : (
                  displayedSections.map((section, sectionIndex) => (
                    <div key={section.id} className="space-y-4">
                      <Card className="feedback-section-card">
                        <CardHeader>
                          <CardTitle className="feedback-section-title flex items-center gap-3">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {sectionIndex + 1}
                            </span>
                            {section.title}
                          </CardTitle>
                          <CardDescription className="feedback-section-description">
                            {section.description || "Section preview"}
                          </CardDescription>
                        </CardHeader>
                      </Card>

                      {section.questions.map((question) => {
                        const questionNumber =
                          displayedQuestionOrder.findIndex(
                            (candidate) => candidate.id === question.id,
                          ) + 1;

                        return (
                          <Card
                            key={question.id}
                            id={`feedback-question-${question.id}`}
                            tabIndex={-1}
                            className="warm-question-card border-border/70 shadow-sm"
                            style={{ scrollMarginTop: "1rem" }}
                          >
                            <CardHeader>
                              <CardTitle className="text-lg font-semibold">
                                Question {questionNumber}
                                {question.required && (
                                  <span className="ml-1 text-destructive">*</span>
                                )}
                              </CardTitle>
                              <CardDescription>
                                {question.required ? "Required question" : "Optional question"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>{renderDynamicQuestion(question)}</CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ))
                )
              ) : (
                <>
                  {activeSection && (
                    <Card className="feedback-section-card">
                      <CardHeader>
                        <CardTitle className="feedback-section-title">
                          {activeSection.title}
                        </CardTitle>
                        <CardDescription className="feedback-section-description">
                          Section {currentSectionIndex + 1} of {visibleSections.length}
                          {activeSection.description ? ` - ${activeSection.description}` : ""}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )}

                  {activeSectionQuestions.map((question, index) => (
                    <Card
                      key={question.id}
                      id={`feedback-question-${question.id}`}
                      tabIndex={-1}
                      className={`warm-question-card border-border/70 shadow-sm ${
                        showValidationErrors && isRequiredQuestionMissing(question)
                          ? "border-destructive/70 ring-1 ring-destructive/40"
                          : ""
                      }`}
                      style={{ scrollMarginTop: "1rem" }}
                    >
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold">
                          Question {index + 1}
                          {question.required && (
                            <span className="ml-1 text-destructive">*</span>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {question.required ? "Required question" : "Optional question"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {renderDynamicQuestion(question)}
                        {showValidationErrors && isRequiredQuestionMissing(question) && (
                          <div className="mt-4 flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <p className="text-sm">
                              This question still needs an answer or more detail.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </>
              )
            ) : (
              <>
                <Card className="warm-question-card border-border/70 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Overall Experience</CardTitle>
                    <CardDescription>
                      How would you rate your overall satisfaction with our services?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SatisfactionSlider
                      value={formData.overall_satisfaction}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          overall_satisfaction: value,
                        })
                      }
                      label="Overall Satisfaction"
                      description="Rate from 1 (Very Dissatisfied) to 10 (Very Satisfied)"
                      disabled={isPreviewMode}
                    />
                  </CardContent>
                </Card>

                <Card className="warm-question-card border-border/70 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Service Quality</CardTitle>
                    <CardDescription>
                      How would you rate the quality of our service or product?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StarRating
                      value={formData.service_quality}
                      onChange={(value) =>
                        setFormData({ ...formData, service_quality: value })
                      }
                      label="Service Quality Rating"
                      disabled={isPreviewMode}
                    />
                  </CardContent>
                </Card>

                <Card className="warm-question-card border-border/70 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Recommendation</CardTitle>
                    <CardDescription>
                      How likely are you to recommend our services to a colleague?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LikertScale
                      value={formData.recommendation_likelihood}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          recommendation_likelihood: value,
                        })
                      }
                      label="Recommendation Likelihood"
                      disabled={isPreviewMode}
                    />
                  </CardContent>
                </Card>

                <Card className="warm-question-card border-border/70 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Areas for Improvement</CardTitle>
                    <CardDescription>
                      Select any areas where you think we could improve.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ImprovementAreas
                      value={formData.improvement_areas}
                      onChange={(value) =>
                        setFormData({ ...formData, improvement_areas: value })
                      }
                      label="Select all that apply"
                      disabled={isPreviewMode}
                    />
                  </CardContent>
                </Card>

                <Card className="warm-question-card border-border/70 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Additional Comments</CardTitle>
                    <CardDescription>
                      Share any additional thoughts or suggestions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={formData.additional_comments}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          additional_comments: e.target.value,
                        })
                      }
                      placeholder="Your comments here..."
                      rows={4}
                      className="resize-none"
                      disabled={isPreviewMode}
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {!isPreviewMode &&
              (hasDynamicQuestions ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="sm:min-w-[140px]"
                    onClick={() => {
                      setPendingTargetQuestionId(null);
                      setSectionHistory((previous) => {
                        if (previous.length === 0) {
                          setCurrentSectionIndex((current) => Math.max(current - 1, 0));
                          return previous;
                        }

                        const nextHistory = [...previous];
                        const previousSectionId = nextHistory.pop();
                        const previousIndex = visibleSections.findIndex(
                          (section) => section.id === previousSectionId,
                        );

                        if (previousIndex >= 0) {
                          setCurrentSectionIndex(previousIndex);
                        } else {
                          setCurrentSectionIndex((current) => Math.max(current - 1, 0));
                        }

                        return nextHistory;
                      });
                    }}
                    disabled={!canGoBack || isSubmitting}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>

                  {isLastSection ? (
                    <Button
                      type="submit"
                      size="lg"
                      className="sm:min-w-[180px]"
                      disabled={isSubmitting || anyFilesUploading}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Feedback"
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      className="sm:min-w-[180px]"
                      onClick={handleContinueSection}
                      disabled={isSubmitting || anyFilesUploading}
                    >
                      {activeSection?.continueLabel?.trim() || "Continue"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitting || anyFilesUploading}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </Button>
              ))}
          </div>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {isPreviewMode
            ? "Preview mode does not collect or submit any responses."
            : "This survey is confidential. No personal information is collected."}
        </p>
      </div>
    </div>
  );
}
