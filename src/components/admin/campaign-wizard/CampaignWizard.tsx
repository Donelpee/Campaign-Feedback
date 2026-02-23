import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { StepBasicInfo } from "./StepBasicInfo";
import { StepQuestions } from "./StepQuestions";
import { StepReview } from "./StepReview";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/lib/supabase-types";
import type { CampaignType, CampaignQuestion } from "@/lib/supabase-types";
import { cn } from "@/lib/utils";

export type BuildMode = "ai" | "upload" | "manual";

export interface WizardData {
  draftId?: string;
  campaignId?: string;
  buildMode?: BuildMode;
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
}

const STEPS = ["Basic Info", "Build Form", "Review"];
const WIZARD_DRAFT_KEY = "campaign-wizard-draft-v1";

interface StoredWizardDraft {
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

function readStoredDraft(): StoredWizardDraft | null {
  try {
    const raw = window.localStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWizardDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
    return parsed;
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
}: CampaignWizardProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  // progress must be after currentStep is defined
  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>(
    initialDraft || EMPTY_WIZARD_DATA,
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Load company info for sticky header
  useEffect(() => {
    if (!wizardData.selectedCompanyId) {
      setCompany(null);
      return;
    }
    const loadCompany = async () => {
      const { data: row } = await supabase
        .from("companies")
        .select("*")
        .eq("id", wizardData.selectedCompanyId)
        .maybeSingle();
      setCompany(row ?? null);
    };
    loadCompany();
  }, [wizardData.selectedCompanyId]);

  // On open, set wizardData to initialDraft or blank
  useEffect(() => {
    if (!open) return;
    if (initialDraft) {
      setWizardData(initialDraft);
      setCurrentStep(0);
      setLastSavedAt(new Date().toISOString());
    } else {
      const stored = readStoredDraft();
      if (stored?.data) {
        setWizardData({ ...EMPTY_WIZARD_DATA, ...stored.data });
        setCurrentStep(
          Math.max(0, Math.min(STEPS.length - 1, Number(stored.step) || 0)),
        );
        setLastSavedAt(stored.updatedAt || null);
      } else {
        setWizardData(EMPTY_WIZARD_DATA);
        setCurrentStep(0);
        setLastSavedAt(null);
      }
    }
  }, [open, initialDraft]);

  useEffect(() => {
    if (!open) return;
    if (!hasWizardProgress(wizardData)) return;

    const updatedAt = new Date().toISOString();
    const payload: StoredWizardDraft = {
      data: wizardData,
      step: currentStep,
      updatedAt,
    };

    window.localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(payload));
    setLastSavedAt(updatedAt);
  }, [open, wizardData, currentStep]);

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return (
          wizardData.selectedCompanyId &&
          wizardData.name.trim() &&
          wizardData.description.trim() &&
          wizardData.startDate &&
          wizardData.endDate
        );
      case 1:
        return wizardData.questions.length > 0;
      case 2:
        return true;
      default:
        return false;
    }
  };

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
          />
        );
      case 1:
        return <StepQuestions data={wizardData} onChange={updateWizardData} />;
      case 2:
        return <StepReview data={wizardData} />;
      default:
        return null;
    }
  };

  function handleBack() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function handleNext() {
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
      window.localStorage.removeItem(WIZARD_DRAFT_KEY);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] h-[94vh] max-w-[1400px] p-0 overflow-hidden flex flex-col border-primary/20 shadow-2xl">
        <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-amber-50 border-b">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {wizardData.campaignId ? "Edit Campaign / Survey" : "Create Campaign / Survey"} -{" "}
              {STEPS[currentStep]}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Build and review your campaign questions before publishing. All
              steps are required. Use the Back and Next buttons to navigate. Your
              progress is autosaved as a draft.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-2 px-6 pt-4">
          <Progress value={progress} className="h-2" />
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors",
                  index < currentStep && "bg-blue-50 text-blue-700 border-blue-200",
                  index === currentStep && "bg-primary/10 text-primary border-primary/30",
                  index > currentStep && "bg-muted/40 text-muted-foreground border-border",
                )}
              >
                {step}
              </div>
            ))}
          </div>
          {lastSavedAt && (
            <p className="text-xs text-muted-foreground">
              Autosaved {new Date(lastSavedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 bg-gradient-to-b from-background to-slate-50/40">
          {renderStep()}
        </div>

        <div className="shrink-0 flex justify-between px-6 py-4 border-t bg-background/95">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
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
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
