import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Upload,
  Wand2,
  GripVertical,
  Loader2,
  ArrowUp,
  ArrowDown,
  Copy,
  FileUp,
  PencilLine,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type { CampaignQuestion } from "@/lib/supabase-types";
import type { WizardData, BuildMode } from "./CampaignWizard";
import {
  extractInstructionFromFile,
  generateDraftFromInstruction,
  generateDraftWithAI,
} from "@/lib/campaign-generator";
import { QuestionPreview } from "./QuestionPreview";
import { futureReleaseFlags } from "@/config/futureReleaseFlags";

interface StepQuestionsProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
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

const conditionOperatorLabels: Record<
  NonNullable<CampaignQuestion["showIfOperator"]>,
  string
> = {
  equals: "Equals",
  not_equals: "Does not equal",
  contains: "Contains",
};

const starterTemplate: CampaignQuestion[] = [
  {
    id: "1",
    type: "scale",
    question: "How satisfied are you overall?",
    required: true,
    min: 1,
    max: 10,
  },
  {
    id: "2",
    type: "single_choice",
    question: "How likely are you to recommend us?",
    required: true,
    options: ["Very unlikely", "Unlikely", "Neutral", "Likely", "Very likely"],
  },
  {
    id: "3",
    type: "multiple_choice",
    question: "Which areas can we improve?",
    required: false,
    options: ["Communication", "Response time", "Quality", "Support"],
  },
  {
    id: "4",
    type: "text",
    question: "Any additional comments?",
    required: false,
  },
];

export function StepQuestions({ data, onChange }: StepQuestionsProps) {
  const { toast } = useToast();
  const { campaignType, questions, buildMode } = data;
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [isGeneratingFromInstruction, setIsGeneratingFromInstruction] =
    useState(false);
  const [instructionText, setInstructionText] = useState(
    data.documentContent || "",
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    questions[0]?.id ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedModeEnabled =
    buildMode === "manual" ||
    (buildMode === "ai" && futureReleaseFlags.aiAssistedBuilder) ||
    (buildMode === "upload" && futureReleaseFlags.uploadDocumentBuilder);

  useEffect(() => {
    if (questions.length === 0) {
      setSelectedQuestionId(null);
      return;
    }

    const exists =
      selectedQuestionId &&
      questions.some((question) => question.id === selectedQuestionId);
    if (!exists) {
      setSelectedQuestionId(questions[0].id);
    }
  }, [questions, selectedQuestionId]);

  const setBuildMode = (mode: BuildMode) => {
    onChange({ buildMode: mode });
  };

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

  const handleConditionToggle = (questionIndex: number, enabled: boolean) => {
    const question = questions[questionIndex];
    const previousQuestions = questions.slice(0, questionIndex);
    if (!enabled) {
      handleUpdateQuestion(questionIndex, {
        showIfQuestionId: undefined,
        showIfOperator: undefined,
        showIfValue: undefined,
      });
      return;
    }

    const defaultSource = previousQuestions[0];
    handleUpdateQuestion(questionIndex, {
      showIfQuestionId: defaultSource?.id,
      showIfOperator: "equals",
      showIfValue: "",
    });
  };

  const handleDuplicateQuestion = (index: number) => {
    const source = questions[index];
    const duplicated: CampaignQuestion = {
      ...source,
      id: crypto.randomUUID(),
      question: source.question ? `${source.question} (copy)` : "",
    };

    const updated = [...questions];
    updated.splice(index + 1, 0, duplicated);
    updateQuestions(updated);
    setSelectedQuestionId(duplicated.id);
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

  const handleOptionFocus = (
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    if (/^Option\s+\d+$/i.test(value.trim())) {
      handleUpdateOption(questionIndex, optionIndex, "");
    }
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex];
    const options = [...(question.options || [])].filter(
      (_, index) => index !== optionIndex,
    );
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

  const handleMatrixEntryAdd = (
    questionIndex: number,
    kind: "rows" | "columns",
  ) => {
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
    const next = source.filter((_, index) => index !== valueIndex);
    handleUpdateQuestion(questionIndex, { [kind]: next } as Partial<CampaignQuestion>);
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= questions.length) return;
    const reordered = [...questions];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    updateQuestions(reordered);
  };

  const handleUseSuggestions = () => {
    const suggested = starterTemplate.map((q) => ({
      ...q,
      id: crypto.randomUUID(),
    }));
    updateQuestions(suggested);
    toast({
      title: "Questions added",
      description: `${suggested.length} starter questions have been added.`,
    });
  };

  const handleGenerateFromInstruction = async () => {
    if (!instructionText.trim()) {
      toast({
        variant: "destructive",
        title: "Instruction required",
        description: "Add campaign instructions before generating.",
      });
      return;
    }

    setIsGeneratingFromInstruction(true);
    try {
      const aiDraft = await generateDraftWithAI(instructionText, campaignType);
      const draft =
        aiDraft || generateDraftFromInstruction(instructionText, campaignType);

      onChange({
        documentContent: instructionText,
        questions: draft.questions,
        name: data.name.trim() ? data.name : draft.name,
        description: data.description.trim() ? data.description : draft.description,
      });

      toast({
        title: "Draft generated",
        description: `Generated ${draft.questions.length} questions${aiDraft ? " with AI" : ""}.`,
      });
    } catch (error) {
      console.error("Error generating draft from instruction:", error);
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "Could not generate a draft from the instruction. Please try again.",
      });
    } finally {
      setIsGeneratingFromInstruction(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/plain",
      "text/csv",
      "application/json",
      "text/markdown",
    ];

    if (!validTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a PDF, Word, Excel, TXT, CSV, JSON, or Markdown file.",
      });
      return;
    }

    setIsProcessingDocument(true);
    try {
      const extractedInstruction = await extractInstructionFromFile(file);
      setInstructionText(extractedInstruction);

      const aiDraft = await generateDraftWithAI(
        extractedInstruction,
        campaignType,
      );
      const draft =
        aiDraft || generateDraftFromInstruction(extractedInstruction, campaignType);

      onChange({
        documentContent: extractedInstruction,
        questions: draft.questions,
        name: data.name.trim() ? data.name : draft.name,
        description: data.description.trim() ? data.description : draft.description,
      });

      toast({
        title: "Document processed",
        description: `Generated ${draft.questions.length} questions from ${file.name}${aiDraft ? " with AI" : ""}.`,
      });
    } catch (error) {
      console.error("Error processing document:", error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: "Could not process the uploaded file. Try a supported format.",
      });
    } finally {
      setIsProcessingDocument(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const selectedQuestion =
    questions.find((question) => question.id === selectedQuestionId) || null;
  const hasQuestions = questions.length > 0;
  const hasBasicInfo = Boolean(
    data.selectedCompanyName &&
      data.name.trim() &&
      data.description.trim() &&
      data.startDate &&
      data.endDate,
  );

  const buildFlowSteps = [
    {
      key: "method",
      title: "Choose Method",
      done: Boolean(buildMode),
    },
    {
      key: "generate",
      title: "Generate or Import",
      done: hasQuestions,
    },
    {
      key: "refine",
      title: "Refine Questions",
      done: hasQuestions,
    },
  ];

  const renderQuestionBuilder = () => {
    if (questions.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-muted-foreground">
              No questions yet. Continue with your selected method to generate questions, or add one manually.
            </p>
            <div className="flex justify-center">
              <Button variant="default" size="sm" onClick={handleAddQuestion}>
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3 relative">
          {questions.map((question, index) => (
            <Card
              key={question.id}
              className={selectedQuestionId === question.id ? "border-primary" : ""}
              onClick={() => setSelectedQuestionId(question.id)}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Q{index + 1}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => moveQuestion(index, index - 1)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => moveQuestion(index, index + 1)}
                        disabled={index === questions.length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Select
                        value={question.type}
                        onValueChange={(type: CampaignQuestion["type"]) =>
                          handleQuestionTypeChange(index, type)
                        }
                      >
                        <SelectTrigger className="w-[180px] h-8">
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

                      <div className="flex items-center gap-2 ml-auto">
                        <Label htmlFor={`required-${index}`} className="text-xs">
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
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDuplicateQuestion(index)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
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
                    />

                    {isOptionQuestionType(question.type) && (
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
                              onFocus={() =>
                                handleOptionFocus(index, optionIndex, option)
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

                    {isMatrixQuestionType(question.type) && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Rows</Label>
                          {(question.rows && question.rows.length > 0
                            ? question.rows
                            : ["Row 1"]
                          ).map((row, rowIndex) => (
                            <div
                              key={`${question.id}-row-${rowIndex}`}
                              className="flex items-center gap-2"
                            >
                              <Input
                                value={row}
                                placeholder={`Row ${rowIndex + 1}`}
                                onChange={(event) =>
                                  handleMatrixEntryUpdate(
                                    index,
                                    "rows",
                                    rowIndex,
                                    event.target.value,
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  handleMatrixEntryRemove(index, "rows", rowIndex)
                                }
                                disabled={(question.rows?.length || 0) <= 1}
                                title="Remove row"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
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
                                  handleMatrixEntryUpdate(
                                    index,
                                    "columns",
                                    columnIndex,
                                    event.target.value,
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  handleMatrixEntryRemove(index, "columns", columnIndex)
                                }
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

                    {(question.type === "scale" ||
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

                    <div className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            Conditional display
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Show this question based on another answer.
                          </p>
                        </div>
                        <Switch
                          checked={Boolean(question.showIfQuestionId)}
                          onCheckedChange={(checked) =>
                            handleConditionToggle(index, checked)
                          }
                          disabled={index === 0}
                        />
                      </div>

                      {question.showIfQuestionId && (
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Question</Label>
                            <Select
                              value={question.showIfQuestionId}
                              onValueChange={(value) =>
                                handleUpdateQuestion(index, {
                                  showIfQuestionId: value,
                                })
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Source question" />
                              </SelectTrigger>
                              <SelectContent>
                                {questions.slice(0, index).map((sourceQuestion) => (
                                  <SelectItem key={sourceQuestion.id} value={sourceQuestion.id}>
                                    {sourceQuestion.question || "Untitled question"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Operator</Label>
                            <Select
                              value={question.showIfOperator || "equals"}
                              onValueChange={(
                                value: NonNullable<CampaignQuestion["showIfOperator"]>,
                              ) =>
                                handleUpdateQuestion(index, {
                                  showIfOperator: value,
                                })
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Operator" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(conditionOperatorLabels).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Value</Label>
                            <Input
                              value={question.showIfValue || ""}
                              onChange={(event) =>
                                handleUpdateQuestion(index, {
                                  showIfValue: event.target.value,
                                })
                              }
                              className="h-9"
                              placeholder="Expected answer"
                            />
                          </div>
                        </div>
                      )}

                      {index === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          First question cannot be conditional.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="sticky bottom-3 flex justify-end pointer-events-none">
            <Button
              variant="default"
              size="sm"
              onClick={handleAddQuestion}
              className="pointer-events-auto shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </div>
        </div>

        <Card className="h-fit sticky top-0">
          <CardContent className="pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium">Preview</p>
              <p className="text-xs text-muted-foreground">
                Select a question to preview how respondents will see it.
              </p>
            </div>

            {selectedQuestion ? (
              <div className="space-y-3 rounded-md border p-3">
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
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-r from-sky-50 via-blue-50 to-amber-50">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {buildFlowSteps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-2">
                <Badge variant={step.done ? "default" : "outline"}>
                  {step.done ? (
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    `${index + 1}.`
                  )}
                  {step.title}
                </Badge>
                {index < buildFlowSteps.length - 1 && (
                  <span className="text-xs text-muted-foreground">{"->"}</span>
                )}
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            <p>
              Campaign details for this form:{" "}
              <span className="font-medium text-foreground">
                {data.selectedCompanyName || "No company selected"}
              </span>{" "}
              |{" "}
              <span className="font-medium text-foreground">
                {data.name || "Untitled campaign"}
              </span>{" "}
              |{" "}
              <span className="font-medium text-foreground">
                {data.startDate || "Start date missing"}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {data.endDate || "End date missing"}
              </span>
            </p>
            {!hasBasicInfo && (
              <p className="mt-1 text-destructive">
                Basic Info is incomplete. Go back and fill company, campaign
                name, description, start date, and end date.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {!buildMode ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>How do you want to build this campaign form?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3 items-stretch">
            <Button
              variant="outline"
              className="h-full min-h-[170px] w-full py-4 px-4 flex flex-col items-start justify-start gap-2 text-left whitespace-normal break-words leading-snug rounded-xl border-sky-300 bg-gradient-to-br from-sky-50 to-blue-50 hover:from-sky-100 hover:to-blue-100"
              onClick={() => setBuildMode("ai")}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="font-semibold text-sm">Use AI Builder</span>
              <span className="text-xs text-muted-foreground whitespace-normal break-words">
                Describe the campaign and generate questions with AI.
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-full min-h-[170px] w-full py-4 px-4 flex flex-col items-start justify-start gap-2 text-left whitespace-normal break-words leading-snug rounded-xl border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100"
              onClick={() => setBuildMode("upload")}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                <FileUp className="h-4 w-4" />
              </span>
              <span className="font-semibold text-sm">Upload Document</span>
              <span className="text-xs text-muted-foreground whitespace-normal break-words">
                Upload your campaign document and generate questions from it.
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-full min-h-[170px] w-full py-4 px-4 flex flex-col items-start justify-start gap-2 text-left whitespace-normal break-words leading-snug rounded-xl border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100"
              onClick={() => setBuildMode("manual")}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                <PencilLine className="h-4 w-4" />
              </span>
              <span className="font-semibold text-sm">Create Manually</span>
              <span className="text-xs text-muted-foreground whitespace-normal break-words">
                Build your form from scratch and add each question yourself.
              </span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-blue-200 bg-blue-50/60">
            <CardContent className="pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">
                  Build Mode:{" "}
                  {buildMode === "ai"
                    ? "AI Builder"
                    : buildMode === "upload"
                      ? "Upload Document"
                      : "Manual Builder"}
                </p>
                <p className="text-xs text-muted-foreground">
                  You can switch mode any time. Existing questions remain editable.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onChange({ buildMode: undefined })}>
                Change Method
              </Button>
            </CardContent>
          </Card>

          {buildMode === "ai" && !futureReleaseFlags.aiAssistedBuilder && (
            <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <CardContent className="pt-6 space-y-2">
                <p className="text-sm font-semibold text-amber-700">AI Builder - Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  AI-assisted campaign generation is scheduled for a future release.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBuildMode("manual")}
                >
                  Continue With Manual Builder
                </Button>
              </CardContent>
            </Card>
          )}

          {buildMode === "upload" && !futureReleaseFlags.uploadDocumentBuilder && (
            <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <CardContent className="pt-6 space-y-2">
                <p className="text-sm font-semibold text-amber-700">Document Upload - Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  Document-based campaign generation is scheduled for a future release.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBuildMode("manual")}
                >
                  Continue With Manual Builder
                </Button>
              </CardContent>
            </Card>
          )}

          {buildMode === "ai" && futureReleaseFlags.aiAssistedBuilder && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="instruction-input">AI Prompt</Label>
                  <Textarea
                    id="instruction-input"
                    rows={5}
                    value={instructionText}
                    onChange={(event) => {
                      const value = event.target.value;
                      setInstructionText(value);
                      onChange({ documentContent: value });
                    }}
                    placeholder="Example: Build a customer service survey for Q1. Ask about satisfaction (1-10), support quality, recommendation likelihood, key improvement areas, and open comments."
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleGenerateFromInstruction}
                  disabled={isGeneratingFromInstruction || !instructionText.trim()}
                >
                  {isGeneratingFromInstruction ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Generate Draft From Instructions
                </Button>
              </CardContent>
            </Card>
          )}

          {buildMode === "upload" && futureReleaseFlags.uploadDocumentBuilder && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json,.md"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingDocument}
                >
                  {isProcessingDocument ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload Campaign Document
                </Button>
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, Word, Excel, TXT, CSV, JSON, and Markdown.
                </p>
              </CardContent>
            </Card>
          )}

          {buildMode === "manual" && (
            <Card>
              <CardContent className="pt-6 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleUseSuggestions}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Use Starter Template
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddQuestion}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Question
                </Button>
              </CardContent>
            </Card>
          )}

          {selectedModeEnabled && renderQuestionBuilder()}
        </>
      )}
    </div>
  );
}
