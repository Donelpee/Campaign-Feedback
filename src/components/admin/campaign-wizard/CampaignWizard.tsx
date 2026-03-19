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
import { ModePicker } from "./ModePicker";
import { GuidedBuddyPanel } from "./GuidedBuddyPanel";

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

function coerceCreationMode(mode?: CreationMode): CreationMode | undefined {
  if (!mode) return undefined;
  return mode === "guided_buddy" ? "guided_buddy" : "guided_buddy";
}

function mapLegacyBuildMode(value: unknown): CreationMode | undefined {
  if (value === "manual") return "guided_buddy";
  if (value === "ai") return "conversation_builder";
  if (value === "upload") return "template_story";
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

export function CampaignWizard({
  open,
  onOpenChange,
  onComplete,
  initialDraft,
  defaultCreationMode,
  onDefaultCreationModeChange,
}: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showModePicker, setShowModePicker] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>(
    normalizeDraftData(initialDraft || EMPTY_WIZARD_DATA),
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // On open, set wizardData to initialDraft or blank
  useEffect(() => {
    if (!open) return;
    if (initialDraft) {
      const normalized = normalizeDraftData(initialDraft);
      setWizardData(normalized);
      setCurrentStep(0);
      setShowModePicker(!normalized.creationMode && !normalized.campaignId);
      setLastSavedAt(new Date().toISOString());
    } else {
      const stored = readStoredDraft();
      if (stored?.data) {
        setWizardData(stored.data);
        setCurrentStep(
          Math.max(0, Math.min(STEPS.length - 1, Number(stored.step) || 0)),
        );
        setShowModePicker(!stored.data.creationMode);
        setLastSavedAt(stored.updatedAt || null);
      } else {
        setWizardData({
          ...EMPTY_WIZARD_DATA,
          creationMode: coerceCreationMode(defaultCreationMode || undefined),
        });
        setCurrentStep(0);
        setShowModePicker(!defaultCreationMode);
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

  const canProceed = () => {
    const nameLongEnough = wizardData.name.trim().length >= 10;
    const goalLongEnough = wizardData.description.trim().length >= 10;
    const baseValid = Boolean(
      wizardData.selectedCompanyId &&
        nameLongEnough &&
        wizardData.startDate &&
        wizardData.endDate &&
        wizardData.endDate >= wizardData.startDate,
    );

    switch (currentStep) {
      case 0:
        if (wizardData.creationMode === "quick_start") {
          return baseValid;
        }
        return baseValid && goalLongEnough;
      case 1:
        return wizardData.questions.length > 0;
      case 2:
        return Boolean(
          wizardData.creationMode &&
            baseValid &&
            (wizardData.creationMode === "quick_start" || goalLongEnough) &&
            wizardData.questions.length > 0,
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
              wizardData.name.trim().length >= 10,
              Boolean(wizardData.startDate),
              Boolean(wizardData.endDate),
              Boolean(
                wizardData.startDate &&
                  wizardData.endDate &&
                  wizardData.endDate >= wizardData.startDate,
              ),
            ]
          : [
              Boolean(wizardData.selectedCompanyId),
              wizardData.name.trim().length >= 10,
              wizardData.description.trim().length >= 10,
              Boolean(wizardData.startDate),
              Boolean(wizardData.endDate),
              Boolean(
                wizardData.startDate &&
                  wizardData.endDate &&
                  wizardData.endDate >= wizardData.startDate,
              ),
            ];

      return requirements.filter(Boolean).length / requirements.length;
    }

    if (currentStep === 1) {
      if (wizardData.questions.length === 0) return 0;
      const clearQuestionCount = wizardData.questions.filter(
        (question) => question.question.trim().length >= 8,
      ).length;
      return clearQuestionCount / wizardData.questions.length;
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
  const shouldShowModePicker = showModePicker && !wizardData.campaignId;

  const modeStepCopy = useMemo(() => {
    const shortName =
      wizardData.name.trim().length > 0 && wizardData.name.trim().length < 10;
    const shortGoal =
      wizardData.creationMode !== "quick_start" &&
      wizardData.description.trim().length > 0 &&
      wizardData.description.trim().length < 10;
    const needsMoreWords = currentStep === 0 && (shortName || shortGoal);

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
    wizardData.creationMode,
    wizardData.description,
    wizardData.name,
  ]);

  const updateWizardData = (data: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  };

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
    if (shouldShowModePicker) return;
    setShowValidation(false);
    if (currentStep === 0) {
      return;
    }
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function handleNext() {
    if (shouldShowModePicker) return;
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
      setShowModePicker(true);
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
            shouldShowModePicker ? "cw-page-surface" : activeStepTheme.bgClass,
          )}
        >
          <DialogHeader className="px-3 pb-4 pt-4 sm:px-4 md:px-8 md:pt-6 md:pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                  {wizardData.campaignId
                    ? "Edit Campaign / Survey"
                    : "Create Campaign / Survey"}
                  {shouldShowModePicker || currentStep === 1
                    ? ""
                    : ` - ${STEPS[currentStep]}`}
                </DialogTitle>
                <DialogDescription className="max-w-3xl text-xs text-slate-600 sm:text-sm md:text-base">
                  {shouldShowModePicker
                    ? "Choose how you want to create your survey."
                    : activeStepTheme.subtitle}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {lastSavedAt && (
          <div className="px-3 pt-2 sm:px-4 md:px-8 md:pt-3">
            <p className="inline-flex rounded-md border border-slate-300 bg-white/80 px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm">
              Autosaved {new Date(lastSavedAt).toLocaleTimeString()}
            </p>
          </div>
        )}

        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 md:px-8 md:py-5",
            shouldShowModePicker ? "cw-page-surface" : activeStepTheme.bgClass,
          )}
        >
          <div key={currentStep} className="cw-step-panel mx-auto w-full max-w-[1280px]">
            <div className="cw-form-calm">
              {shouldShowModePicker ? (
              <ModePicker
                selectedMode={wizardData.creationMode}
                onModeSelect={(mode) => {
                  if (mode !== "guided_buddy") return;
                  updateWizardData({ creationMode: mode });
                  onDefaultCreationModeChange?.(mode);
                  setShowModePicker(false);
                  setCurrentStep(0);
                }}
              />
            ) : (
                modeStepCopy ? (
                  <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="h-full">{renderStep()}</div>
                    <div className="sticky top-4 h-[calc(100vh-220px)] min-h-[560px] self-start">
                      <GuidedBuddyPanel
                        title={modeStepCopy.title}
                        subtitle={modeStepCopy.subtitle}
                        mood={modeStepCopy.mood}
                        scene={
                          currentStep === 0
                            ? "setup"
                            : currentStep === 1
                              ? "build"
                              : "review"
                        }
                        trackStatus={
                          (showValidation && !canProceed()) ||
                          (currentStep === 0 &&
                            ((wizardData.name.trim().length > 0 &&
                              wizardData.name.trim().length < 10) ||
                              (wizardData.creationMode !== "quick_start" &&
                                wizardData.description.trim().length > 0 &&
                                wizardData.description.trim().length < 10)))
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
                )
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap justify-between gap-2 px-3 py-3 border-t bg-slate-100/95 sm:px-4 md:px-8 md:py-4">
          <Button
            variant="default"
            onClick={handleBack}
            disabled={(currentStep === 0 && shouldShowModePicker) || isSubmitting}
            className="h-11 flex-1 min-w-[130px] px-4 text-base bg-slate-700 text-white hover:bg-slate-800 sm:flex-none sm:px-5"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {shouldShowModePicker ? (
            <Button
              onClick={() => {
                if (!wizardData.creationMode) return;
                setShowModePicker(false);
                setCurrentStep(0);
              }}
              disabled={!wizardData.creationMode}
              className="h-11 flex-1 min-w-[150px] px-4 text-base sm:flex-none sm:px-6"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : currentStep === STEPS.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="cw-soft-pulse h-11 flex-1 min-w-[150px] px-4 text-base sm:flex-none sm:px-6"
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
              className="cw-soft-pulse h-11 flex-1 min-w-[150px] px-4 text-base sm:flex-none sm:px-6"
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
