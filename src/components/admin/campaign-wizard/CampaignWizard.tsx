import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { StepBasicInfo } from "./StepBasicInfo";
import { StepQuestions } from "./StepQuestions";
import { StepReview } from "./StepReview";
import type { CampaignType, CampaignQuestion } from "@/lib/supabase-types";
import { cn } from "@/lib/utils";
import { GuidedBuddyPanel } from "./GuidedBuddyPanel";
import {
  getBasicInfoValidation,
  getQuestionValidation,
  type WizardWarningType,
} from "./wizardValidation";

export type CreationMode =
  | "guided_buddy"
  | "quick_start"
  | "template_story"
  | "conversation_builder";

export interface WizardData {
  draftId?: string;
  campaignId?: string;
  creationMode?: CreationMode;
  campaignType: CampaignType;
  selectedCompanyId: string;
  selectedCompanyName: string;
  name: string;
  description: string;
  startDate: string;
  lockStartDate?: boolean;
  endDate: string;
  questions: CampaignQuestion[];
  documentContent?: string;
}

interface CampaignWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: WizardData) => Promise<void>;
  initialDraft?: WizardData | null;
  defaultCreationMode?: CreationMode | null;
  onDefaultCreationModeChange?: (mode: CreationMode) => Promise<void> | void;
}

const STEPS = ["Basic Info", "Build Form", "Review"];
const WIZARD_DRAFT_KEY_V2 = "campaign-wizard-draft-v2";
const WIZARD_DRAFT_KEY_V1 = "campaign-wizard-draft-v1";
const WIZARD_DRAFT_VERSION = 2;
const WAITING_PROMPT_DELAY_MS = 30_000;
const IDLE_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "keydown",
  "pointerdown",
  "pointermove",
  "wheel",
  "touchstart",
];

interface StoredWizardDraft {
  version: number;
  data: WizardData;
  step: number;
  updatedAt: string;
}

const EMPTY_WIZARD_DATA: WizardData = {
  campaignType: "feedback",
  selectedCompanyId: "",
  selectedCompanyName: "",
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  questions: [],
  documentContent: "",
};

function coerceCreationMode(_mode?: CreationMode): CreationMode {
  return "guided_buddy";
}

function mapLegacyBuildMode(value: unknown): CreationMode | undefined {
  if (value === "manual") return "guided_buddy";
  if (value === "ai" || value === "upload") return "guided_buddy";
  return undefined;
}

function normalizeDraftData(data: unknown): WizardData {
  const incoming = (data && typeof data === "object" ? data : {}) as WizardData & {
    buildMode?: string;
  };
  const legacyMode = mapLegacyBuildMode(incoming.buildMode);
  const normalizedMode =
    incoming.creationMode && incoming.creationMode.length > 0
      ? incoming.creationMode
      : legacyMode;

  return {
    ...EMPTY_WIZARD_DATA,
    ...incoming,
    creationMode: coerceCreationMode(normalizedMode),
  };
}

function readStoredDraft(): StoredWizardDraft | null {
  try {
    const rawV2 = window.localStorage.getItem(WIZARD_DRAFT_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as StoredWizardDraft;
      if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
      return {
        version: WIZARD_DRAFT_VERSION,
        data: normalizeDraftData(parsed.data),
        step: Number(parsed.step) || 0,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }

    const rawV1 = window.localStorage.getItem(WIZARD_DRAFT_KEY_V1);
    if (!rawV1) return null;
    const parsed = JSON.parse(rawV1) as { data?: WizardData; step?: number; updatedAt?: string };
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;

    return {
      version: WIZARD_DRAFT_VERSION,
      data: normalizeDraftData(parsed.data),
      step: Number(parsed.step) || 0,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function hasWizardProgress(data: WizardData): boolean {
  return Boolean(
    data.selectedCompanyId ||
      data.name.trim() ||
      data.description.trim() ||
      data.startDate ||
      data.endDate ||
      data.questions.length > 0 ||
      data.documentContent?.trim(),
  );
}

function getWarningCopy(warningType: WizardWarningType) {
  switch (warningType) {
    case "empty_required_fields":
      return {
        title: "Please fill all required fields before clicking on the continue button.",
        subtitle: "",
      };
    case "short_text":
      return {
        title: "Add more words to continue.",
        subtitle: "Field 2 or 3 needs at least 10 characters.",
      };
    case "invalid_date_range":
      return {
        title: "Your end date cannot come before the start date.",
        subtitle: "Choose an end date that is the same as or after the start date.",
      };
    case "missing_questions":
      return {
        title: "Add at least one question before you continue.",
        subtitle: "",
      };
    case "invalid_questions":
      return {
        title: "Each question must be at least 8 characters long.",
        subtitle: "Please finish every question before continuing.",
      };
    default:
      return {
        title: "Add more words to continue.",
        subtitle: "Field 2 or 3 needs at least 10 characters.",
      };
  }
}

export function CampaignWizard({
  open,
  onOpenChange,
  onComplete,
  initialDraft,
  defaultCreationMode,
  onDefaultCreationModeChange,
}: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>(
    normalizeDraftData(initialDraft || EMPTY_WIZARD_DATA),
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isIdleDetected, setIsIdleDetected] = useState(false);

  // On open, set wizardData to initialDraft or blank
  useEffect(() => {
    if (!open) return;
    if (initialDraft) {
      const normalized = normalizeDraftData(initialDraft);
      setWizardData(normalized);
      setCurrentStep(0);
      setLastSavedAt(new Date().toISOString());
    } else {
      const stored = readStoredDraft();
      if (stored?.data) {
        setWizardData(stored.data);
        setCurrentStep(
          Math.max(0, Math.min(STEPS.length - 1, Number(stored.step) || 0)),
        );
        setLastSavedAt(stored.updatedAt || null);
      } else {
        setWizardData({
          ...EMPTY_WIZARD_DATA,
          creationMode: coerceCreationMode(defaultCreationMode || undefined),
        });
        setCurrentStep(0);
        setLastSavedAt(null);
      }
    }
  }, [open, initialDraft, defaultCreationMode]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!hasWizardProgress(wizardData)) return;

    const updatedAt = new Date().toISOString();
    const payload: StoredWizardDraft = {
      version: WIZARD_DRAFT_VERSION,
      data: wizardData,
      step: currentStep,
      updatedAt,
    };

    window.localStorage.setItem(WIZARD_DRAFT_KEY_V2, JSON.stringify(payload));
    window.localStorage.removeItem(WIZARD_DRAFT_KEY_V1);
    setLastSavedAt(updatedAt);
  }, [open, wizardData, currentStep]);

  const basicInfoValidation = getBasicInfoValidation(wizardData);
  const questionValidation = getQuestionValidation(wizardData.questions);

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return basicInfoValidation.isValid;
      case 1:
        return questionValidation.isValid;
      case 2:
        return Boolean(
          wizardData.creationMode &&
            basicInfoValidation.isValid &&
            questionValidation.isValid,
        );
      default:
        return false;
    }
  };

  const nextLabels = ["Looks good, continue", "Great, let's review"];

  const getStepProgress = () => {
    if (currentStep === 0) {
      const requirements =
        wizardData.creationMode === "quick_start"
          ? [
              Boolean(wizardData.selectedCompanyId),
              basicInfoValidation.hasName,
              Boolean(wizardData.startDate),
              Boolean(wizardData.endDate),
              !basicInfoValidation.hasInvalidDateRange &&
                Boolean(wizardData.startDate && wizardData.endDate),
            ]
          : [
              Boolean(wizardData.selectedCompanyId),
              basicInfoValidation.hasName,
              basicInfoValidation.hasDescription,
              Boolean(wizardData.startDate),
              Boolean(wizardData.endDate),
              !basicInfoValidation.hasInvalidDateRange &&
                Boolean(wizardData.startDate && wizardData.endDate),
            ];

      return requirements.filter(Boolean).length / requirements.length;
    }

    if (currentStep === 1) {
      if (wizardData.questions.length === 0) return 0;
      return questionValidation.clearQuestionCount / wizardData.questions.length;
    }

    return canProceed() ? 1 : 0.7;
  };

  const stepThemes = [
    {
      icon: ClipboardList,
      chip: "Setup Page",
      title: "Campaign Setup",
      subtitle: "Clear campaign details help your team and respondents understand purpose instantly.",
      bgClass: "cw-page-surface",
    },
    {
      icon: Sparkles,
      chip: "Build Page",
      title: "Question Builder",
      subtitle: "Use easy actions to build a strong survey with no guesswork.",
      bgClass: "cw-page-surface-build",
    },
    {
      icon: ShieldCheck,
      chip: "Review Page",
      title: "Launch Check",
      subtitle: "Review every detail clearly before creating the campaign.",
      bgClass: "cw-page-surface-review",
    },
  ] as const;

  const activeStepTheme = stepThemes[currentStep] || stepThemes[0];
  const isGuidedBuddy = wizardData.creationMode === "guided_buddy";
  const isQuickStart = wizardData.creationMode === "quick_start";
  const isTemplateStory = wizardData.creationMode === "template_story";
  const isConversationBuilder = wizardData.creationMode === "conversation_builder";
  const currentStepWarningType =
    currentStep === 0
      ? showValidation ||
        basicInfoValidation.warningType === "short_text" ||
        basicInfoValidation.warningType === "invalid_date_range"
        ? basicInfoValidation.warningType
        : "none"
      : currentStep === 1
        ? showValidation
          ? questionValidation.warningType
          : "none"
        : "none";
  const isCurrentStepIncomplete =
    currentStep < STEPS.length - 1
      ? currentStep === 0
        ? !basicInfoValidation.isValid
        : !questionValidation.isValid
      : false;
  const isCurrentStepComplete =
    currentStep < STEPS.length - 1 && !isCurrentStepIncomplete;
  const showWaitingBuddy = isCurrentStepIncomplete && isIdleDetected;
  const warningCopy = getWarningCopy(currentStepWarningType);

  const modeStepCopy = useMemo(() => {
    const needsMoreWords =
      currentStep === 0 && basicInfoValidation.warningType === "short_text";

    if (isQuickStart) {
      if (currentStep === 0) {
        return {
          mood: needsMoreWords ? ("idle" as const) : ("point" as const),
          title: "Quick setup time. Let us fill the essentials fast.",
          subtitle: needsMoreWords
            ? "Write at least 10 characters in field 2."
            : "Pick company, name the campaign, then set dates.",
        };
      }
      if (currentStep === 1) {
        return {
          mood: "point" as const,
          title: "Great. Add 3 starters or create your own questions.",
          subtitle: "Keep each question short and easy to answer.",
        };
      }
      return {
        mood: "celebrate" as const,
        title: "Quick Start is ready to launch.",
        subtitle: "Review quickly, then create your campaign.",
      };
    }

    if (isTemplateStory) {
      if (currentStep === 0) {
        return {
          mood: needsMoreWords ? ("idle" as const) : ("point" as const),
          title: "Howdy, let us set up your story campaign.",
          subtitle: needsMoreWords
            ? "Write at least 10 characters in the short field."
            : "Pick company, add campaign story name, then set dates.",
        };
      }
      if (currentStep === 1) {
        return {
          mood: "point" as const,
          title: "Choose one story template and I will help from there.",
          subtitle: "You can still edit every question after selection.",
        };
      }
      return {
        mood: "celebrate" as const,
        title: "Nice work, your story survey is lined up.",
        subtitle: "Give it one final look before launch.",
      };
    }

    if (isConversationBuilder) {
      if (currentStep === 0) {
        return {
          mood: needsMoreWords ? ("idle" as const) : ("point" as const),
          title: "Let us set up your campaign first.",
          subtitle: needsMoreWords
            ? "Write at least 10 characters in field 2 or 3."
            : "Then we will build prompts one by one.",
        };
      }
      if (currentStep === 1) {
        return {
          mood: "point" as const,
          title: "Now we talk to users in short prompt steps.",
          subtitle: "Start with welcome, then quality, then improvement.",
        };
      }
      return {
        mood: "celebrate" as const,
        title: "Great, your conversation flow is complete.",
        subtitle: "Check and create when ready.",
      };
    }

    if (!isGuidedBuddy) return null;
    if (currentStep === 0) {
      return {
        mood: needsMoreWords ? ("idle" as const) : ("point" as const),
        title: "First, tell me who this survey is for.",
        subtitle: needsMoreWords
          ? "Write at least 10 characters in field 2 or 3."
          : "Pick company, name, and dates. Keep it simple.",
      };
    }
    if (currentStep === 1) {
      return {
        mood: "point" as const,
        title: "Great. Now add clear questions.",
        subtitle: "Keep each question short and easy to answer.",
      };
    }
    return {
      mood: "celebrate" as const,
      title: "Everything looks ready to launch.",
      subtitle: "Review once, then create your campaign.",
    };
  }, [
    currentStep,
    isQuickStart,
    isConversationBuilder,
    isGuidedBuddy,
    isTemplateStory,
    basicInfoValidation.warningType,
  ]);

  const updateWizardData = (data: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  };

  useEffect(() => {
    if (!open || !isCurrentStepIncomplete) {
      setIsIdleDetected(false);
      return;
    }

    setIsIdleDetected(false);
    let timeoutId = window.setTimeout(() => {
      setIsIdleDetected(true);
    }, WAITING_PROMPT_DELAY_MS);

    const resetIdleTimer = () => {
      setIsIdleDetected(false);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsIdleDetected(true);
      }, WAITING_PROMPT_DELAY_MS);
    };

    IDLE_ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer);
    });
    document.addEventListener("focusin", resetIdleTimer);

    return () => {
      window.clearTimeout(timeoutId);
      IDLE_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
      document.removeEventListener("focusin", resetIdleTimer);
    };
  }, [open, currentStep, isCurrentStepIncomplete]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepBasicInfo
            data={wizardData}
            onChange={updateWizardData}
            isEditing={Boolean(wizardData.campaignId)}
            lockStartDate={Boolean(wizardData.lockStartDate)}
            easyMode
            showValidation={showValidation}
            creationMode={wizardData.creationMode}
          />
        );
      case 1:
        return (
          <StepQuestions
            data={wizardData}
            onChange={updateWizardData}
            easyMode
            showValidation={showValidation}
            creationMode={wizardData.creationMode}
          />
        );
      case 2:
        return (
          <StepReview
            data={wizardData}
            easyMode
            onJumpToBuild={() => setCurrentStep(1)}
            creationMode={wizardData.creationMode}
          />
        );
      default:
        return null;
    }
  };

  function handleBack() {
    setShowValidation(false);
    if (currentStep === 0) {
      return;
    }
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function handleNext() {
    if (!canProceed()) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await onComplete(wizardData);
      setCurrentStep(0);
      setWizardData(EMPTY_WIZARD_DATA);
      setLastSavedAt(null);
      window.localStorage.removeItem(WIZARD_DRAFT_KEY_V2);
      window.localStorage.removeItem(WIZARD_DRAFT_KEY_V1);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] w-full max-w-none rounded-none border-0 p-0 overflow-hidden flex flex-col shadow-none">
        <div
          className={cn(
            "cw-gradient-drift border-b",
            activeStepTheme.bgClass,
          )}
        >
          <DialogHeader className="px-3 pb-2.5 pt-3 sm:px-4 md:px-6 md:pb-3 md:pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl md:text-[1.65rem]">
                  {wizardData.campaignId
                    ? "Edit Campaign / Survey"
                    : "Create Campaign / Survey"}
                  {currentStep === 1
                    ? ""
                    : ` - ${STEPS[currentStep]}`}
                </DialogTitle>
                <DialogDescription className="max-w-3xl text-xs text-slate-600 sm:text-sm">
                  {activeStepTheme.subtitle}
                </DialogDescription>
              </div>
              {lastSavedAt && (
                <p className="inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.16)]">
                  Autosaved {new Date(lastSavedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </DialogHeader>
        </div>

        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-4 md:px-6 md:py-2.5 xl:overflow-hidden",
            activeStepTheme.bgClass,
          )}
        >
          <div
            key={currentStep}
            className="cw-step-panel mx-auto w-full max-w-[1280px] xl:h-full"
          >
            <div className="cw-form-calm xl:h-full">
              {modeStepCopy ? (
                <div className="grid gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-stretch xl:gap-4">
                  <div className="xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-2">
                    {renderStep()}
                  </div>
                  <div className="xl:h-full xl:min-h-0 xl:self-start">
                    <GuidedBuddyPanel
                      title={modeStepCopy.title}
                      subtitle={modeStepCopy.subtitle}
                      isHappy={isCurrentStepComplete}
                      isWaiting={showWaitingBuddy}
                      warningTitle={warningCopy.title}
                      warningSubtitle={warningCopy.subtitle}
                      mood={modeStepCopy.mood}
                      scene={
                        currentStep === 0
                          ? "setup"
                          : currentStep === 1
                            ? "build"
                            : "review"
                      }
                      trackStatus={
                        currentStepWarningType !== "none"
                          ? "off_track"
                          : getStepProgress() >= 0.7
                            ? "on_track"
                            : "neutral"
                      }
                      step={currentStep + 1}
                      totalSteps={STEPS.length}
                    />
                  </div>
                </div>
              ) : (
                renderStep()
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-1.5 border-t bg-slate-100/95 px-3 py-1 sm:px-4 md:px-5 md:py-1.5">
          <Button
            variant="default"
            onClick={handleBack}
            disabled={currentStep <= 0 || isSubmitting}
            className="h-9 flex-1 min-w-[116px] bg-slate-700 px-4 text-sm font-bold text-white hover:bg-slate-800 sm:flex-none"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="cw-soft-pulse h-9 flex-1 min-w-[140px] px-4 text-sm font-bold sm:flex-none"
            >
              {isSubmitting
                ? wizardData.campaignId
                  ? "Saving..."
                  : "Creating..."
                : wizardData.campaignId
                  ? "Save Changes"
                  : "Create Campaign"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="cw-soft-pulse h-9 flex-1 min-w-[140px] px-4 text-sm font-bold sm:flex-none"
            >
              {isQuickStart && currentStep === 0
                ? "Continue to questions"
                : isTemplateStory && currentStep === 0
                  ? "Continue to templates"
                  : isConversationBuilder && currentStep === 0
                    ? "Continue to conversation"
                : nextLabels[currentStep] || "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
