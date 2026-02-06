import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { StepCampaignType } from './StepCampaignType';
import { StepBasicInfo } from './StepBasicInfo';
import { StepQuestions } from './StepQuestions';
import { StepReview } from './StepReview';
import type { CampaignType, CampaignQuestion } from '@/lib/supabase-types';

export interface WizardData {
  campaignType: CampaignType;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  questions: CampaignQuestion[];
  documentContent?: string;
}

interface CampaignWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: WizardData) => Promise<void>;
}

const STEPS = ['Campaign Type', 'Basic Info', 'Questions', 'Review'];

export function CampaignWizard({ open, onOpenChange, onComplete }: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    campaignType: 'feedback',
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    questions: [],
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(wizardData);
      // Reset wizard
      setCurrentStep(0);
      setWizardData({
        campaignType: 'feedback',
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        questions: [],
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true; // Campaign type always selected
      case 1:
        return wizardData.name.trim() && wizardData.startDate && wizardData.endDate;
      case 2:
        return wizardData.questions.length > 0;
      case 3:
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
          <StepCampaignType
            campaignType={wizardData.campaignType}
            onChange={(campaignType) => updateWizardData({ campaignType })}
          />
        );
      case 1:
        return (
          <StepBasicInfo
            data={wizardData}
            onChange={updateWizardData}
          />
        );
      case 2:
        return (
          <StepQuestions
            campaignType={wizardData.campaignType}
            questions={wizardData.questions}
            onChange={(questions) => updateWizardData({ questions })}
          />
        );
      case 3:
        return <StepReview data={wizardData} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Campaign - {STEPS[currentStep]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step, index) => (
              <span
                key={step}
                className={index <= currentStep ? 'text-primary font-medium' : ''}
              >
                {step}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 min-h-[300px]">
          {renderStep()}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep === STEPS.length - 1 ? (
            <Button onClick={handleSubmit} disabled={!canProceed() || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
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
