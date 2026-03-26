import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  MessageSquare,
  CheckCircle,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/lib/supabase-types";
import type { WizardData } from "./CampaignWizard";
import { QuestionPreview } from "./QuestionPreview";
import type { CreationMode } from "./CampaignWizard";
import { cn } from "@/lib/utils";
import { getOrderedSurveyQuestions, normalizeCampaignSurvey } from "@/lib/campaign-survey";

interface StepReviewProps {
  data: WizardData;
  easyMode?: boolean;
  onJumpToBuild?: () => void;
  creationMode?: CreationMode;
}

const questionTypeLabels: Record<string, string> = {
  rating: "Star Rating",
  scale: "Scale",
  multiple_choice: "Checkbox (Multiple Choice)",
  single_choice: "Radio Button",
  label: "Label",
  textbox: "Textbox",
  textarea: "Textarea",
  combobox: "Combobox",
  checkbox_matrix: "Checkbox Matrix",
  radio_matrix: "Radio Matrix",
  date: "Date",
  file_upload: "File Upload",
  rank: "Rank",
  text: "Text Field",
  nps: "NPS Score",
};

const creationModeLabel: Record<CreationMode, string> = {
  guided_buddy: "Brady Guide",
  quick_start: "Quick Start",
  template_story: "Template Story",
  conversation_builder: "Conversation Builder",
};

export function StepReview({
  data,
  easyMode = true,
  onJumpToBuild,
  creationMode,
}: StepReviewProps) {
  const mode = creationMode || data.creationMode || "guided_buddy";
  const survey = normalizeCampaignSurvey({
    version: 2,
    sections: data.sections || [],
    questions: data.questions || [],
  });
  const orderedQuestions = getOrderedSurveyQuestions(survey.sections, survey.questions);
  const isQuickStart = mode === "quick_start";
  const isTemplateStory = mode === "template_story";
  const isConversationBuilder = mode === "conversation_builder";
  const sceneContent: Record<
    CreationMode,
    { title: string; description: string }
  > = {
    guided_buddy: {
      title: "Final Check",
      description:
        "Need changes? Return to questions, edit, then come back to create.",
    },
    quick_start: {
      title: "Quick Launch Check",
      description:
        "Everything is concise and ready. Confirm details, then create.",
    },
    template_story: {
      title: "Template Story Check",
      description:
        "Confirm your chosen template questions match your campaign goal.",
    },
    conversation_builder: {
      title: "Conversation Flow Check",
      description:
        "Verify your prompt order is clear and natural before launch.",
    },
  };

  const requiredCount = orderedQuestions.filter((q) => q.required).length;
  const optionalCount = orderedQuestions.length - requiredCount;
  const readyChecks = [
    Boolean(data.name.trim()),
    Boolean(data.selectedCompanyId),
    Boolean(data.startDate && data.endDate),
    orderedQuestions.length > 0,
  ];
  const readiness = Math.round(
    (readyChecks.filter(Boolean).length / readyChecks.length) * 100,
  );
  const reviewIssues: string[] = [];
  if (!data.name.trim()) reviewIssues.push("Campaign name is missing.");
  if (!data.selectedCompanyId) reviewIssues.push("Company is not selected.");
  if (!data.startDate || !data.endDate) reviewIssues.push("Date range is incomplete.");
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    reviewIssues.push("End date must be after start date.");
  }
  if (orderedQuestions.length === 0) reviewIssues.push("Add at least one question.");
  const [company, setCompany] = useState<Company | null>(null);
  const modeTone =
    isQuickStart
      ? {
          panelClass: "border-sky-200/90",
          accentTextClass: "text-sky-900",
          accentSurfaceClass: "border-sky-200/90 bg-sky-50",
        }
      : isTemplateStory
        ? {
            panelClass: "border-violet-200/90",
            accentTextClass: "text-violet-900",
            accentSurfaceClass: "border-violet-200/90 bg-violet-50",
          }
        : isConversationBuilder
          ? {
              panelClass: "border-amber-200/90",
              accentTextClass: "text-amber-900",
              accentSurfaceClass: "border-amber-200/90 bg-amber-50",
            }
          : {
              panelClass: "border-slate-200/95",
              accentTextClass: "text-slate-900",
              accentSurfaceClass: "border-slate-200/90 bg-slate-50",
            };

  useEffect(() => {
    const loadCompany = async () => {
      if (!data.selectedCompanyId) {
        setCompany(null);
        return;
      }

      const { data: row } = await supabase
        .from("companies")
        .select("*")
        .eq("id", data.selectedCompanyId)
        .maybeSingle();

      setCompany(row ?? null);
    };

    loadCompany();
  }, [data.selectedCompanyId]);

  return (
    <div className="cw-review-soft space-y-4">
      <Card className={cn("cw-soft-panel", modeTone.panelClass)}>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
            <div className="space-y-2">
              <p className={easyMode ? "text-xl font-extrabold tracking-tight text-slate-900" : "text-lg font-bold text-slate-900"}>
                Review Campaign
              </p>
              <p className="text-sm text-slate-600">{sceneContent[mode].description}</p>
            </div>
            <div className={cn("grid w-full gap-2 rounded-xl border px-4 py-3 text-left md:min-w-[220px] md:text-right", modeTone.accentSurfaceClass)}>
              <p className={cn("text-sm font-semibold uppercase tracking-wide", modeTone.accentTextClass)}>
                Mode: {creationModeLabel[mode]}
              </p>
              <p className="text-2xl font-extrabold leading-none text-slate-900">
                {readiness}% ready
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 md:grid-cols-3">
            <p>
              <span className="font-bold">{data.questions.length}</span> questions
            </p>
            <p>
              <span className="font-bold">{requiredCount}</span> required
            </p>
            <p>
              <span className="font-bold">{survey.sections.length}</span> sections
            </p>
          </div>
          {reviewIssues.length > 0 && (
            <p className="mt-2 text-sm font-medium text-destructive">
              Fix {reviewIssues.length} item{reviewIssues.length > 1 ? "s" : ""} before creating.
            </p>
          )}
        </CardContent>
      </Card>

      {onJumpToBuild && (
        <Card
          className={`cw-soft-panel ${isConversationBuilder ? "border-amber-200/80" : ""}`}
        >
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={onJumpToBuild}>
                Edit Questions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="cw-soft-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Campaign Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid gap-4 ${isQuickStart ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Campaign Name
              </p>
              <p className="font-medium">{data.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Company</p>
              <div className="flex items-center gap-2">
                {company?.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={`${company.name} logo`}
                    className="h-7 w-7 rounded object-contain border"
                  />
                ) : (
                  <div className="h-7 w-7 rounded border bg-muted flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <p className="font-medium">
                  {company?.name ||
                    data.selectedCompanyName ||
                    "Selected company"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Builder</p>
                  <Badge variant="secondary">
                  {creationModeLabel[
                    mode
                ] || "Brady Guide"}
              </Badge>
            </div>
          </div>

          {data.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{data.description}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{new Date(data.startDate).toLocaleDateString()}</span>
              <span className="text-muted-foreground">to</span>
              <span>{new Date(data.endDate).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="cw-soft-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            {isConversationBuilder
              ? `Conversation Prompts (${orderedQuestions.length})`
              : `What Respondents Will Fill (${orderedQuestions.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold">{requiredCount}</span> required,{" "}
            <span className="font-semibold">{optionalCount}</span> optional,{" "}
            <span className="font-semibold">{survey.sections.length}</span> sections
          </div>

          <div className="space-y-3">
            {survey.sections.map((section, sectionIndex) => {
              const sectionQuestions = orderedQuestions.filter(
                (question) => question.sectionId === section.id,
              );

              if (sectionQuestions.length === 0) return null;

              return (
                <div key={section.id} className="space-y-3">
                  {sectionIndex > 0 && <Separator className="my-3" />}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Section {sectionIndex + 1}</Badge>
                      <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {sectionQuestions.length} question
                        {sectionQuestions.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    {section.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    )}
                  </div>

                  {sectionQuestions.map((question, index) => {
                    const questionNumber =
                      orderedQuestions.findIndex((candidate) => candidate.id === question.id) + 1;

                    return (
                      <div
                        key={question.id}
                        className={`flex items-start gap-3 ${
                          isTemplateStory ? "rounded-lg border border-violet-200/80 p-3" : ""
                        } ${isConversationBuilder ? "rounded-lg border border-amber-200/80 p-3" : ""}`}
                      >
                        <span className="text-xs font-medium text-muted-foreground min-w-[24px]">
                          {isConversationBuilder ? `P${questionNumber}` : `Q${questionNumber}`}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm">
                            {question.question}
                            {question.required && (
                              <span className="text-destructive ml-1">*</span>
                            )}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {questionTypeLabels[question.type]}
                            </Badge>
                            {(question.visibility?.rules.length || 0) > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Conditional
                              </Badge>
                            )}
                            {index < sectionQuestions.length - 1 && (
                              <Badge variant="outline" className="text-xs">
                                Continues in this section
                              </Badge>
                            )}
                          </div>
                          {!isQuickStart && (
                            <QuestionPreview question={question} className="mt-2" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
