import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import type { CampaignQuestion } from "@/lib/supabase-types";
import type { WizardData } from "./CampaignWizard";
import { cn } from "@/lib/utils";
import { QuestionPreview } from "./QuestionPreview";
import { QuickStartSection } from "./QuickStartSection";
import type { CreationMode } from "./CampaignWizard";
import {
  getQuestionValidation,
  isQuestionClear,
} from "./wizardValidation";

interface StepQuestionsProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  easyMode?: boolean;
  showValidation?: boolean;
  creationMode?: CreationMode;
}

const questionTypeLabels: Record<CampaignQuestion["type"], string> = {
  rating: "Star Rating (1-5)",
  scale: "Scale (1-10)",
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
  text: "Text Field (Legacy)",
  nps: "NPS Score (0-10)",
};

export function StepQuestions({
  data,
  onChange,
  easyMode = true,
  showValidation = false,
  creationMode,
}: StepQuestionsProps) {
  const { questions } = data;
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    questions[0]?.id ?? null,
  );

  useEffect(() => {
    if (questions.length === 0) {
      setSelectedQuestionId(null);
      return;
    }
    const exists = selectedQuestionId && questions.some((q) => q.id === selectedQuestionId);
    if (!exists) {
      setSelectedQuestionId(questions[0].id);
    }
  }, [questions, selectedQuestionId]);

  const updateQuestions = (updatedQuestions: CampaignQuestion[]) => {
    onChange({ questions: updatedQuestions });
  };

  const isOptionQuestionType = (type: CampaignQuestion["type"]) =>
    type === "multiple_choice" ||
    type === "single_choice" ||
    type === "combobox" ||
    type === "rank";

  const isMatrixQuestionType = (type: CampaignQuestion["type"]) =>
    type === "checkbox_matrix" || type === "radio_matrix";

  const handleAddQuestion = () => {
    const newQuestion: CampaignQuestion = {
      id: crypto.randomUUID(),
      type: "rating",
      question: "",
      required: true,
    };
    updateQuestions([...questions, newQuestion]);
    setSelectedQuestionId(newQuestion.id);
  };

  const handleAddStarterQuestions = () => {
    if (questions.length > 0) return;
    const starterQuestions: CampaignQuestion[] = [
      {
        id: crypto.randomUUID(),
        type: "rating",
        question: "How satisfied are you with your experience?",
        required: true,
        min: 1,
        max: 5,
      },
      {
        id: crypto.randomUUID(),
        type: "single_choice",
        question: "How likely are you to use us again?",
        required: true,
        options: ["Very likely", "Maybe", "Not likely"],
      },
      {
        id: crypto.randomUUID(),
        type: "textarea",
        question: "What should we improve first?",
        required: false,
      },
    ];
    updateQuestions(starterQuestions);
    setSelectedQuestionId(starterQuestions[0].id);
  };

  const handleUseTemplateStory = (template: "customer" | "employee" | "event") => {
    if (questions.length > 0) return;

    const byTemplate: Record<typeof template, CampaignQuestion[]> = {
      customer: [
        {
          id: crypto.randomUUID(),
          type: "rating",
          question: "How satisfied are you with your overall experience?",
          required: true,
          min: 1,
          max: 5,
        },
        {
          id: crypto.randomUUID(),
          type: "single_choice",
          question: "Which part of our service helped you most?",
          required: true,
          options: ["Speed", "Quality", "Support", "Price"],
        },
        {
          id: crypto.randomUUID(),
          type: "textarea",
          question: "What one thing should we improve next?",
          required: false,
        },
      ],
      employee: [
        {
          id: crypto.randomUUID(),
          type: "scale",
          question: "How supported do you feel in your current role?",
          required: true,
          min: 1,
          max: 10,
        },
        {
          id: crypto.randomUUID(),
          type: "single_choice",
          question: "How manageable is your workload this month?",
          required: true,
          options: ["Very manageable", "Manageable", "Heavy", "Too heavy"],
        },
        {
          id: crypto.randomUUID(),
          type: "textarea",
          question: "What would help you do your best work?",
          required: false,
        },
      ],
      event: [
        {
          id: crypto.randomUUID(),
          type: "rating",
          question: "How would you rate this event overall?",
          required: true,
          min: 1,
          max: 5,
        },
        {
          id: crypto.randomUUID(),
          type: "multiple_choice",
          question: "What did you enjoy most?",
          required: true,
          options: ["Speakers", "Networking", "Venue", "Content quality"],
        },
        {
          id: crypto.randomUUID(),
          type: "textarea",
          question: "What should we improve for the next event?",
          required: false,
        },
      ],
    };

    const seeded = byTemplate[template];
    updateQuestions(seeded);
    setSelectedQuestionId(seeded[0].id);
  };

  const handleAddConversationPrompt = (promptType: "welcome" | "quality" | "improvement") => {
    const promptMap: Record<typeof promptType, CampaignQuestion> = {
      welcome: {
        id: crypto.randomUUID(),
        type: "single_choice",
        question: "How would you describe your experience today?",
        required: true,
        options: ["Excellent", "Good", "Okay", "Poor"],
      },
      quality: {
        id: crypto.randomUUID(),
        type: "rating",
        question: "How would you rate the quality you received?",
        required: true,
        min: 1,
        max: 5,
      },
      improvement: {
        id: crypto.randomUUID(),
        type: "textarea",
        question: "What is one change that would improve your experience?",
        required: false,
      },
    };

    const nextQuestion = promptMap[promptType];
    const updatedQuestions = [...questions, nextQuestion];
    updateQuestions(updatedQuestions);
    setSelectedQuestionId(nextQuestion.id);
  };

  const handleUpdateQuestion = (
    index: number,
    updates: Partial<CampaignQuestion>,
  ) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    updateQuestions(updated);
  };

  const handleQuestionTypeChange = (
    index: number,
    type: CampaignQuestion["type"],
  ) => {
    const current = questions[index];
    const updates: Partial<CampaignQuestion> = { type };

    if (isOptionQuestionType(type)) {
      updates.options =
        current.options && current.options.length > 0
          ? current.options
          : ["Option 1", "Option 2"];
      updates.rows = undefined;
      updates.columns = undefined;
    } else if (isMatrixQuestionType(type)) {
      updates.rows =
        current.rows && current.rows.length > 0 ? current.rows : ["Row 1", "Row 2"];
      updates.columns =
        current.columns && current.columns.length > 0
          ? current.columns
          : ["Option A", "Option B"];
      updates.options = undefined;
    } else {
      updates.options = undefined;
      updates.rows = undefined;
      updates.columns = undefined;
    }

    if (type === "scale" || type === "nps" || type === "rating") {
      updates.min = type === "nps" ? 0 : 1;
      updates.max = type === "rating" ? 5 : 10;
    } else {
      updates.min = undefined;
      updates.max = undefined;
    }

    handleUpdateQuestion(index, updates);
  };

  const handleRemoveQuestion = (index: number) => {
    const removedId = questions[index]?.id;
    const updatedQuestions = questions.filter((_, i) => i !== index);
    updateQuestions(updatedQuestions);
    if (removedId === selectedQuestionId) {
      setSelectedQuestionId(updatedQuestions[0]?.id ?? null);
    }
  };

  const handleUpdateOption = (
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    const question = questions[questionIndex];
    const options = [...(question.options || [""])];
    options[optionIndex] = value;
    handleUpdateQuestion(questionIndex, { options });
  };

  const handleAddOption = (questionIndex: number) => {
    const question = questions[questionIndex];
    const options = [...(question.options || [])];
    options.push(`Option ${options.length + 1}`);
    handleUpdateQuestion(questionIndex, { options });
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex];
    const options = [...(question.options || [])].filter((_, i) => i !== optionIndex);
    handleUpdateQuestion(questionIndex, { options });
  };

  const handleMatrixEntryUpdate = (
    questionIndex: number,
    kind: "rows" | "columns",
    valueIndex: number,
    value: string,
  ) => {
    const question = questions[questionIndex];
    const source = kind === "rows" ? question.rows || [] : question.columns || [];
    const next = [...source];
    next[valueIndex] = value;
    handleUpdateQuestion(questionIndex, { [kind]: next } as Partial<CampaignQuestion>);
  };

  const handleMatrixEntryAdd = (questionIndex: number, kind: "rows" | "columns") => {
    const question = questions[questionIndex];
    const source = kind === "rows" ? question.rows || [] : question.columns || [];
    const label = kind === "rows" ? "Row" : "Column";
    const next = [...source, `${label} ${source.length + 1}`];
    handleUpdateQuestion(questionIndex, { [kind]: next } as Partial<CampaignQuestion>);
  };

  const handleMatrixEntryRemove = (
    questionIndex: number,
    kind: "rows" | "columns",
    valueIndex: number,
  ) => {
    const question = questions[questionIndex];
    const source = kind === "rows" ? question.rows || [] : question.columns || [];
    const next = source.filter((_, i) => i !== valueIndex);
    handleUpdateQuestion(questionIndex, { [kind]: next } as Partial<CampaignQuestion>);
  };

  const selectedQuestion =
    questions.find((question) => question.id === selectedQuestionId) || null;
  const requiredCount = questions.filter((question) => question.required).length;
  const optionalCount = questions.length - requiredCount;
  const questionValidation = getQuestionValidation(questions);
  const clearQuestions = questionValidation.clearQuestionCount;
  const completionScore = questions.length
    ? Math.round((clearQuestions / questions.length) * 100)
    : 0;
  const isQuickStart = creationMode === "quick_start";
  const isTemplateStory = creationMode === "template_story";
  const isConversationBuilder = creationMode === "conversation_builder";
  const isLeanEditor = isQuickStart || isConversationBuilder;
  const modeMeta = isQuickStart
    ? {
        label: "Quick Start",
        toneClass: "border-sky-200/80 bg-sky-50/55",
        accentTextClass: "text-sky-900",
        accentSurfaceClass: "border-sky-200/90 bg-sky-50",
      }
    : isTemplateStory
      ? {
          label: "Template Story",
          toneClass: "border-violet-200/80 bg-violet-50/45",
          accentTextClass: "text-violet-900",
          accentSurfaceClass: "border-violet-200/90 bg-violet-50",
        }
      : isConversationBuilder
        ? {
            label: "Conversation Builder",
            toneClass: "border-amber-200/80 bg-amber-50/50",
            accentTextClass: "text-amber-900",
            accentSurfaceClass: "border-amber-200/90 bg-amber-50",
          }
        : {
            label: "Guided Buddy",
            toneClass: "border-slate-200 bg-slate-50/55",
            accentTextClass: "text-slate-900",
            accentSurfaceClass: "border-slate-200/90 bg-slate-50",
          };
  const basicInfoMessage = isQuickStart
    ? "Complete company, campaign name, and dates first."
    : "Complete company, campaign name, goal, and dates first.";
  const hasBasicInfo = Boolean(
    data.selectedCompanyName &&
      data.name.trim() &&
      (isQuickStart ? true : data.description.trim()) &&
      data.startDate &&
      data.endDate,
  );

  const renderQuestionBuilder = () => {
    if (questions.length === 0) {
      return (
        <Card className="cw-soft-panel border-dashed">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-muted-foreground">
              No questions yet. Add your first question to continue.
            </p>
            <div className="flex justify-center">
              <Button variant="default" size="sm" className="cw-soft-pulse" onClick={handleAddQuestion}>
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div
        className={cn(
          "grid gap-4",
          isConversationBuilder ? "lg:grid-cols-1" : "lg:grid-cols-[1.35fr_0.95fr]",
        )}
      >
        <div className="space-y-3 relative">
          {questions.map((question, index) => (
            <Card
              key={question.id}
              className={cn(
                "cw-soft-panel",
                selectedQuestionId === question.id ? "border-primary/50" : "",
              )}
              onClick={() => setSelectedQuestionId(question.id)}
            >
              <CardContent className="pt-4">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Q{index + 1}
                    </Badge>
                    {isLeanEditor ? (
                      <Badge variant="outline" className="text-xs">
                        {isConversationBuilder ? "Conversation prompt" : "Quick question"}
                      </Badge>
                    ) : (
                      <Select
                        value={question.type}
                        onValueChange={(type: CampaignQuestion["type"]) =>
                          handleQuestionTypeChange(index, type)
                        }
                      >
                        <SelectTrigger className={easyMode ? "h-9.5 w-full text-sm sm:w-[210px]" : "h-8 w-full sm:w-[180px]"}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(questionTypeLabels).map(([type, label]) => (
                            <SelectItem key={type} value={type}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                      <Label htmlFor={`required-${index}`} className={easyMode ? "text-sm font-medium" : "text-xs"}>
                        Required
                      </Label>
                      <Switch
                        id={`required-${index}`}
                        checked={question.required}
                        onCheckedChange={(required) =>
                          handleUpdateQuestion(index, { required })
                        }
                      />
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveQuestion(index)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <Input
                    placeholder="Enter your question..."
                    value={question.question}
                    onChange={(e) =>
                      handleUpdateQuestion(index, { question: e.target.value })
                    }
                    className={easyMode ? "h-11 text-base" : ""}
                  />
                  {showValidation && !isQuestionClear(question) && (
                    <p className="text-xs font-medium text-destructive">
                      Write at least 8 characters so this question is clear.
                    </p>
                  )}

                  {!isLeanEditor && isOptionQuestionType(question.type) && (
                    <div className="space-y-2">
                      <Label className="text-xs">Options</Label>
                      {(question.options && question.options.length > 0
                        ? question.options
                        : ["Option 1"]
                      ).map((option, optionIndex) => (
                        <div
                          key={`${question.id}-option-${optionIndex}`}
                          className="flex items-center gap-2"
                        >
                          <Input
                            value={option}
                            placeholder={`Option ${optionIndex + 1}`}
                            onChange={(event) =>
                              handleUpdateOption(index, optionIndex, event.target.value)
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveOption(index, optionIndex)}
                            disabled={(question.options?.length || 0) <= 1}
                            title="Remove option"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddOption(index)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add option
                      </Button>
                    </div>
                  )}

                  {!isLeanEditor && isMatrixQuestionType(question.type) && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Rows</Label>
                        {(question.rows && question.rows.length > 0 ? question.rows : ["Row 1"]).map(
                          (row, rowIndex) => (
                            <div
                              key={`${question.id}-row-${rowIndex}`}
                              className="flex items-center gap-2"
                            >
                              <Input
                                value={row}
                                placeholder={`Row ${rowIndex + 1}`}
                                onChange={(event) =>
                                  handleMatrixEntryUpdate(index, "rows", rowIndex, event.target.value)
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMatrixEntryRemove(index, "rows", rowIndex)}
                                disabled={(question.rows?.length || 0) <= 1}
                                title="Remove row"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ),
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleMatrixEntryAdd(index, "rows")}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add row
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Columns</Label>
                        {(question.columns && question.columns.length > 0
                          ? question.columns
                          : ["Option A"]
                        ).map((column, columnIndex) => (
                          <div
                            key={`${question.id}-column-${columnIndex}`}
                            className="flex items-center gap-2"
                          >
                            <Input
                              value={column}
                              placeholder={`Column ${columnIndex + 1}`}
                              onChange={(event) =>
                                handleMatrixEntryUpdate(index, "columns", columnIndex, event.target.value)
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleMatrixEntryRemove(index, "columns", columnIndex)}
                              disabled={(question.columns?.length || 0) <= 1}
                              title="Remove column"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleMatrixEntryAdd(index, "columns")}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add column
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isLeanEditor &&
                    (question.type === "scale" ||
                    question.type === "nps" ||
                    question.type === "rating") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Min</Label>
                        <Input
                          type="number"
                          value={question.min ?? (question.type === "nps" ? 0 : 1)}
                          onChange={(e) =>
                            handleUpdateQuestion(index, {
                              min: Number(
                                e.target.value || (question.type === "nps" ? 0 : 1),
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Max</Label>
                        <Input
                          type="number"
                          value={question.max ?? (question.type === "rating" ? 5 : 10)}
                          onChange={(e) =>
                            handleUpdateQuestion(index, {
                              max: Number(
                                e.target.value || (question.type === "rating" ? 5 : 10),
                              ),
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

        </div>

        {!isConversationBuilder && (
          <Card className="cw-soft-panel h-fit sticky top-0">
          <CardContent className="pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium">Preview</p>
              <p className="text-xs text-muted-foreground">Selected question preview.</p>
            </div>

            {selectedQuestion ? (
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/55 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {questionTypeLabels[selectedQuestion.type]}
                  </Badge>
                  {selectedQuestion.required && <Badge variant="outline">Required</Badge>}
                </div>
                <p className="text-sm font-medium">
                  {selectedQuestion.question || "Untitled question"}
                </p>
                <QuestionPreview question={selectedQuestion} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add a question to view preview.
              </p>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className={cn("cw-soft-panel", modeMeta.toneClass)}>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
            <div className="space-y-2">
              <p className="text-xl font-extrabold tracking-tight text-slate-900">
                Question Builder
              </p>
              <p className="text-sm text-slate-600">
                {isQuickStart
                  ? "Start with 3 sample questions, then edit what you need."
                  : isTemplateStory
                    ? "Pick a story template, then customize the questions."
                    : isConversationBuilder
                      ? "Build one conversational prompt at a time."
                      : "Add and edit questions directly."}
              </p>
            </div>
            <div
              className={cn(
                "grid w-full gap-2 rounded-xl border px-4 py-3 text-left md:min-w-[220px] md:text-right",
                modeMeta.accentSurfaceClass,
              )}
            >
              <p className={cn("text-sm font-semibold uppercase tracking-wide", modeMeta.accentTextClass)}>
                Mode: {modeMeta.label}
              </p>
              <p className="text-2xl font-extrabold leading-none text-slate-900">
                {completionScore}% completion
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 md:grid-cols-3">
            <p>
              <span className="font-bold">{questions.length}</span> questions
            </p>
            <p>
              <span className="font-bold">{requiredCount}</span> required
            </p>
            <p>
              <span className="font-bold">{optionalCount}</span> optional
            </p>
          </div>
        </CardContent>
      </Card>

      {!hasBasicInfo && (
        <p className="text-sm font-medium text-amber-900">{basicInfoMessage}</p>
      )}

      {isQuickStart && (
        <QuickStartSection
          onAddStarterQuestions={handleAddStarterQuestions}
          canAddStarterQuestions={questions.length === 0}
        />
      )}

      {isTemplateStory && (
        <Card className="cw-soft-panel">
          <CardContent className="pt-5">
            <div className="grid gap-2 md:grid-cols-3">
              <Button variant="outline" size="sm" className="h-11 justify-start px-4 text-sm font-semibold" onClick={() => handleUseTemplateStory("customer")}>
                Customer Experience Template
              </Button>
              <Button variant="outline" size="sm" className="h-11 justify-start px-4 text-sm font-semibold" onClick={() => handleUseTemplateStory("employee")}>
                Employee Check-In Template
              </Button>
              <Button variant="outline" size="sm" className="h-11 justify-start px-4 text-sm font-semibold" onClick={() => handleUseTemplateStory("event")}>
                Event Debrief Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isConversationBuilder && (
        <Card className="cw-soft-panel">
          <CardContent className="pt-5">
            <div className="grid gap-2 md:grid-cols-3">
            <Button
              variant="outline"
              size="sm"
              className="h-11 justify-start px-4 text-sm font-semibold"
              onClick={() => handleAddConversationPrompt("welcome")}
            >
              Add welcome prompt
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-11 justify-start px-4 text-sm font-semibold"
              onClick={() => handleAddConversationPrompt("quality")}
            >
              Add quality prompt
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-11 justify-start px-4 text-sm font-semibold"
              onClick={() => handleAddConversationPrompt("improvement")}
            >
              Add improvement prompt
            </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showValidation && questions.length === 0 && (
        <p className="text-sm font-medium text-destructive">
          Add at least one question before you continue.
        </p>
      )}

      {showValidation && questionValidation.warningType === "invalid_questions" && (
        <p className="text-sm font-medium text-destructive">
          Make every question at least 8 characters long before you continue.
        </p>
      )}

      {!isQuickStart && !isConversationBuilder && !isTemplateStory && (
        <Card className="cw-soft-panel">
          <CardContent className="pt-5 flex flex-wrap gap-2">
            <Button variant="default" size="sm" onClick={handleAddQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </CardContent>
        </Card>
      )}

      {renderQuestionBuilder()}
    </div>
  );
}
