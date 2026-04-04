import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArchiveX, Copy, GripVertical, Plus, Rows3, Trash2 } from "lucide-react";
import type {
  CampaignQuestion,
  FileUploadFormat,
  QuestionLogicOperator,
  SurveySection,
} from "@/lib/supabase-types";
import type { WizardData } from "./CampaignWizard";
import { cn } from "@/lib/utils";
import { QuickStartSection } from "./QuickStartSection";
import type { CreationMode } from "./CampaignWizard";
import {
  createDefaultSection,
  getOrderedSurveyQuestions,
} from "@/lib/campaign-survey";
import {
  FILE_UPLOAD_FORMAT_LABELS,
  formatFileUploadSummary,
  getFileUploadFormats,
  getFileUploadMaxFiles,
  getFileUploadMaxSizeMb,
} from "@/lib/file-upload";
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
  onDiscardCampaign?: () => void;
}

const questionTypeLabels: Record<CampaignQuestion["type"], string> = {
  rating: "Star Rating (1-5)",
  scale: "Linear Scale (1-10)",
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

const questionTypeDescriptions: Partial<Record<CampaignQuestion["type"], string>> = {
  single_choice: "One answer from a list.",
  multiple_choice: "Multiple answers from a list.",
  combobox: "Dropdown list selection.",
  textbox: "Short written answer.",
  textarea: "Long written answer.",
  rating: "1 to 5 star score.",
  scale: "Numeric response on a linear scale.",
  nps: "0 to 10 recommendation score.",
  checkbox_matrix: "Grid with multiple selections.",
  radio_matrix: "Grid with one choice per row.",
  rank: "Rank choices in order.",
  date: "Pick a date.",
  file_upload: "Let responders upload files.",
  label: "Add instructional text only.",
};

const availableFileFormats: FileUploadFormat[] = [
  "pdf",
  "png",
  "jpeg",
  "excel",
  "word",
];

export function StepQuestions({
  data,
  onChange,
  easyMode = true,
  showValidation = false,
  creationMode,
  onDiscardCampaign,
}: StepQuestionsProps) {
  const selectInputText = (event: React.FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const sections = useMemo(
    () =>
      data.sections && data.sections.length > 0
        ? data.sections
        : [createDefaultSection(0)],
    [data.sections],
  );
  const { questions } = data;
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    questions[0]?.id ?? null,
  );
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<
    | {
        type: "question" | "section";
        id: string;
      }
    | null
  >(null);
  const [dropTarget, setDropTarget] = useState<
    | {
        type: "question" | "section";
        id: string;
      }
    | null
  >(null);
  const [addQuestionTarget, setAddQuestionTarget] = useState<{
    afterQuestionId?: string;
    sectionId: string;
  } | null>(null);

  useEffect(() => {
    if ((data.sections?.length || 0) === 0) {
      onChange({ sections });
    }
  }, [data.sections, onChange, sections]);

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

  useEffect(() => {
    if (!highlightedQuestionId) return undefined;
    const timeout = window.setTimeout(() => setHighlightedQuestionId(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [highlightedQuestionId]);

  useEffect(() => {
    if (!highlightedSectionId) return undefined;
    const timeout = window.setTimeout(() => setHighlightedSectionId(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [highlightedSectionId]);

  const updateSurvey = (
    updatedQuestions: CampaignQuestion[],
    updatedSections: SurveySection[] = sections,
  ) => {
    const fallbackSectionId = updatedSections[0]?.id || createDefaultSection(0).id;
    const validSectionIds = new Set(updatedSections.map((section) => section.id));
    const sanitizedQuestions = updatedQuestions.map((question) => ({
      ...question,
      sectionId:
        question.sectionId && validSectionIds.has(question.sectionId)
          ? question.sectionId
          : fallbackSectionId,
    }));
    const validQuestionIds = new Set(sanitizedQuestions.map((question) => question.id));

    onChange({
      sections: updatedSections,
      questions: sanitizedQuestions.map((question) => ({
        ...question,
        visibility: question.visibility
          ? {
              ...question.visibility,
              rules: question.visibility.rules.filter((rule) =>
                validQuestionIds.has(rule.sourceQuestionId),
              ),
            }
          : undefined,
        routeRules: question.routeRules
          ?.filter((rule) => validSectionIds.has(rule.targetSectionId))
          .map((rule) => ({
            ...rule,
            targetQuestionId:
              rule.targetQuestionId && validQuestionIds.has(rule.targetQuestionId)
                ? rule.targetQuestionId
                : undefined,
          })),
      })),
    });
  };

  const updateQuestions = (updatedQuestions: CampaignQuestion[]) => {
    updateSurvey(updatedQuestions);
  };

  const getQuestionIndexById = (questionId: string) =>
    questions.findIndex((question) => question.id === questionId);

  const getDefaultSectionId = () =>
    selectedQuestionId
      ? questions.find((question) => question.id === selectedQuestionId)?.sectionId ||
        sections[0]?.id ||
        createDefaultSection(0).id
      : sections[0]?.id || createDefaultSection(0).id;

  const isOptionQuestionType = (type: CampaignQuestion["type"]) =>
    type === "multiple_choice" ||
    type === "single_choice" ||
    type === "combobox" ||
    type === "rank";

  const isMatrixQuestionType = (type: CampaignQuestion["type"]) =>
    type === "checkbox_matrix" || type === "radio_matrix";

  const createQuestionForSection = (
    sectionId: string,
    type: CampaignQuestion["type"] = "rating",
  ): CampaignQuestion => {
    const baseQuestion: CampaignQuestion = {
      id: crypto.randomUUID(),
      type,
      question: "",
      required: true,
      sectionId,
    };

    if (isOptionQuestionType(type)) {
      return {
        ...baseQuestion,
        options: ["Option 1", "Option 2"],
      };
    }

    if (isMatrixQuestionType(type)) {
      return {
        ...baseQuestion,
        rows: ["Row 1", "Row 2"],
        columns: ["Option A", "Option B"],
      };
    }

    if (type === "scale") {
      return {
        ...baseQuestion,
        min: 1,
        max: 10,
      };
    }

    if (type === "nps") {
      return {
        ...baseQuestion,
        min: 0,
        max: 10,
      };
    }

    if (type === "rating") {
      return {
        ...baseQuestion,
        min: 1,
        max: 5,
      };
    }

    if (type === "file_upload") {
      return {
        ...baseQuestion,
        allowedFileTypes: ["pdf"],
        maxFiles: 1,
        maxFileSizeMb: 10,
      };
    }

    return baseQuestion;
  };

  const insertQuestion = (newQuestion: CampaignQuestion, afterQuestionId?: string) => {
    const anchorQuestionId = afterQuestionId || selectedQuestionId;
    const selectedIndex = anchorQuestionId
      ? questions.findIndex((question) => question.id === anchorQuestionId)
      : -1;

    if (selectedIndex >= 0) {
      const updatedQuestions = [...questions];
      updatedQuestions.splice(selectedIndex + 1, 0, newQuestion);
      updateQuestions(updatedQuestions);
    } else {
      updateQuestions([...questions, newQuestion]);
    }

    setSelectedQuestionId(newQuestion.id);
    setHighlightedQuestionId(newQuestion.id);
    setHighlightedSectionId(newQuestion.sectionId);
  };

  const openAddQuestionPicker = (targetSectionId?: string, afterQuestionId?: string) => {
    setAddQuestionTarget({
      sectionId: targetSectionId || getDefaultSectionId(),
      afterQuestionId,
    });
  };

  const handleAddQuestion = (targetSectionId?: string) => {
    openAddQuestionPicker(targetSectionId);
  };

  const handleAddQuestionAfter = (afterQuestionId: string, targetSectionId?: string) => {
    openAddQuestionPicker(targetSectionId, afterQuestionId);
  };

  const handleAddQuestionOfType = (type: CampaignQuestion["type"]) => {
    const sectionId = addQuestionTarget?.sectionId || getDefaultSectionId();
    const newQuestion = createQuestionForSection(sectionId, type);
    insertQuestion(newQuestion, addQuestionTarget?.afterQuestionId);
    setAddQuestionTarget(null);
  };

  const handleAddStarterQuestions = () => {
    if (questions.length > 0) return;
    const fallbackSectionId = sections[0]?.id || createDefaultSection(0).id;
    const starterQuestions: CampaignQuestion[] = [
      {
        id: crypto.randomUUID(),
        type: "rating",
        question: "How satisfied are you with your experience?",
        required: true,
        min: 1,
        max: 5,
        sectionId: fallbackSectionId,
      },
      {
        id: crypto.randomUUID(),
        type: "single_choice",
        question: "How likely are you to use us again?",
        required: true,
        options: ["Very likely", "Maybe", "Not likely"],
        sectionId: fallbackSectionId,
      },
      {
        id: crypto.randomUUID(),
        type: "textarea",
        question: "What should we improve first?",
        required: false,
        sectionId: fallbackSectionId,
      },
    ];
    updateQuestions(starterQuestions);
    setSelectedQuestionId(starterQuestions[0].id);
  };

  const confirmRemoveQuestion = (question: CampaignQuestion) =>
    window.confirm(
      question.question.trim()
        ? `Are you sure you want to delete this question?\n\n"${question.question.trim()}"`
        : "Are you sure you want to delete this question?",
    );

  const confirmRemoveSection = (section: SurveySection | undefined) =>
    window.confirm(
      section?.title?.trim()
        ? `Are you sure you want to delete this section and its questions?\n\n"${section.title.trim()}"`
        : "Are you sure you want to delete this section and its questions?",
    );

  const confirmDiscardCampaign = () =>
    window.confirm(
      "Are you sure you want to move this campaign to trash? This will remove the current draft from the builder.",
    );

  const handleUseTemplateStory = (template: "customer" | "employee" | "event") => {
    if (questions.length > 0) return;
    const fallbackSectionId = sections[0]?.id || createDefaultSection(0).id;

    const byTemplate: Record<typeof template, CampaignQuestion[]> = {
      customer: [
        {
          id: crypto.randomUUID(),
          type: "rating",
          question: "How satisfied are you with your overall experience?",
          required: true,
          min: 1,
          max: 5,
          sectionId: fallbackSectionId,
        },
        {
          id: crypto.randomUUID(),
          type: "single_choice",
          question: "Which part of our service helped you most?",
          required: true,
          options: ["Speed", "Quality", "Support", "Price"],
          sectionId: fallbackSectionId,
        },
        {
          id: crypto.randomUUID(),
          type: "textarea",
          question: "What one thing should we improve next?",
          required: false,
          sectionId: fallbackSectionId,
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
          sectionId: fallbackSectionId,
        },
        {
          id: crypto.randomUUID(),
          type: "single_choice",
          question: "How manageable is your workload this month?",
          required: true,
          options: ["Very manageable", "Manageable", "Heavy", "Too heavy"],
          sectionId: fallbackSectionId,
        },
        {
          id: crypto.randomUUID(),
          type: "textarea",
          question: "What would help you do your best work?",
          required: false,
          sectionId: fallbackSectionId,
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
          sectionId: fallbackSectionId,
        },
        {
          id: crypto.randomUUID(),
          type: "multiple_choice",
          question: "What did you enjoy most?",
          required: true,
          options: ["Speakers", "Networking", "Venue", "Content quality"],
          sectionId: fallbackSectionId,
        },
        {
          id: crypto.randomUUID(),
          type: "textarea",
          question: "What should we improve for the next event?",
          required: false,
          sectionId: fallbackSectionId,
        },
      ],
    };

    const seeded = byTemplate[template];
    updateQuestions(seeded);
    setSelectedQuestionId(seeded[0].id);
  };

  const handleAddConversationPrompt = (promptType: "welcome" | "quality" | "improvement") => {
    const fallbackSectionId = getDefaultSectionId();
    const promptMap: Record<typeof promptType, CampaignQuestion> = {
      welcome: {
        id: crypto.randomUUID(),
        type: "single_choice",
        question: "How would you describe your experience today?",
        required: true,
        options: ["Excellent", "Good", "Okay", "Poor"],
        sectionId: fallbackSectionId,
      },
      quality: {
        id: crypto.randomUUID(),
        type: "rating",
        question: "How would you rate the quality you received?",
        required: true,
        min: 1,
        max: 5,
        sectionId: fallbackSectionId,
      },
      improvement: {
        id: crypto.randomUUID(),
        type: "textarea",
        question: "What is one change that would improve your experience?",
        required: false,
        sectionId: fallbackSectionId,
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
    const nextQuestion = { ...updated[index], ...updates };
    const validRouteChoices = new Set(getRouteChoices(nextQuestion));
    updated[index] = {
      ...nextQuestion,
      routeRules: nextQuestion.routeRules?.filter((rule) =>
        validRouteChoices.has(String(rule.answerValue)),
      ),
    };
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

    if (type === "file_upload") {
      updates.allowedFileTypes =
        current.allowedFileTypes && current.allowedFileTypes.length > 0
          ? current.allowedFileTypes
          : ["pdf"];
      updates.maxFiles = current.maxFiles || 1;
      updates.maxFileSizeMb = current.maxFileSizeMb || 10;
    }

    handleUpdateQuestion(index, updates);
  };

  const handleRemoveQuestion = (index: number) => {
    const removedQuestion = questions[index];
    const removedId = removedQuestion?.id;
    const updatedQuestions = questions.filter((_, i) => i !== index);

    if (!removedQuestion) return;

    const remainingInSection = updatedQuestions.filter(
      (question) => question.sectionId === removedQuestion.sectionId,
    );

    if (remainingInSection.length === 0 && sections.length > 1) {
      const updatedSections = sections.filter(
        (section) => section.id !== removedQuestion.sectionId,
      );
      updateSurvey(updatedQuestions, updatedSections);
    } else {
      updateQuestions(updatedQuestions);
    }

    if (removedId === selectedQuestionId) {
      setSelectedQuestionId(updatedQuestions[0]?.id ?? null);
    }
  };

  const handleAddSection = () => {
    const nextSection = createDefaultSection(sections.length);
    const insertedQuestion = createQuestionForSection(nextSection.id);
    updateSurvey(
      [...questions, insertedQuestion],
      [...sections, nextSection],
    );
    setSelectedQuestionId(insertedQuestion.id);
    setHighlightedQuestionId(insertedQuestion.id);
    setHighlightedSectionId(nextSection.id);
  };

  const handleUpdateSection = (
    sectionIndex: number,
    updates: Partial<SurveySection>,
  ) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex] = { ...updatedSections[sectionIndex], ...updates };
    updateSurvey(questions, updatedSections);
  };

  const handleRemoveSection = (sectionIndex: number) => {
    if (sections.length <= 1) return;
    const updatedSections = sections.filter((_, index) => index !== sectionIndex);
    const removedSectionId = sections[sectionIndex]?.id;
    const fallbackSectionId =
      updatedSections[Math.max(0, sectionIndex - 1)]?.id || updatedSections[0].id;

    updateSurvey(
      questions.map((question) =>
        question.sectionId === removedSectionId
          ? { ...question, sectionId: fallbackSectionId }
          : question,
      ),
      updatedSections,
    );
  };

  const orderedQuestions = getOrderedSurveyQuestions(sections, questions);
  const getSectionTitle = (sectionId?: string) =>
    sections.find((section) => section.id === sectionId)?.title || "Section";
  const getSectionQuestionCount = (sectionId: string) =>
    questions.filter((question) => question.sectionId === sectionId).length;

  const handleMoveQuestionToSection = (questionId: string, sectionId: string) => {
    const questionIndex = getQuestionIndexById(questionId);
    if (questionIndex === -1) return;
    const sourceQuestion = questions[questionIndex];
    if (sourceQuestion.sectionId === sectionId) return;

    const updatedQuestions = questions.filter((question) => question.id !== questionId);
    updatedQuestions.push({
      ...sourceQuestion,
      sectionId,
    });
    updateQuestions(updatedQuestions);
    setSelectedQuestionId(questionId);
    setHighlightedQuestionId(questionId);
    setHighlightedSectionId(sectionId);
  };

  const handleReorderQuestionByDrop = (sourceQuestionId: string, targetQuestionId: string) => {
    if (sourceQuestionId === targetQuestionId) return;

    const sourceIndex = orderedQuestions.findIndex((question) => question.id === sourceQuestionId);
    const targetIndex = orderedQuestions.findIndex((question) => question.id === targetQuestionId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...orderedQuestions];
    const [movedQuestion] = reordered.splice(sourceIndex, 1);
    const nextTargetIndex = reordered.findIndex((question) => question.id === targetQuestionId);
    const targetQuestion = reordered[nextTargetIndex];
    reordered.splice(nextTargetIndex, 0, {
      ...movedQuestion,
      sectionId: targetQuestion.sectionId,
    });

    updateQuestions(reordered);
    setSelectedQuestionId(sourceQuestionId);
    setHighlightedQuestionId(sourceQuestionId);
    setHighlightedSectionId(targetQuestion.sectionId);
  };

  const handleReorderSectionByDrop = (sourceSectionId: string, targetSectionId: string) => {
    if (sourceSectionId === targetSectionId) return;

    const sourceIndex = sections.findIndex((section) => section.id === sourceSectionId);
    const targetIndex = sections.findIndex((section) => section.id === targetSectionId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const updatedSections = [...sections];
    const [movedSection] = updatedSections.splice(sourceIndex, 1);
    updatedSections.splice(targetIndex, 0, movedSection);
    updateSurvey(questions, updatedSections);
    setHighlightedSectionId(sourceSectionId);
  };

  const getEarlierQuestions = (questionId: string) => {
    const questionIndex = orderedQuestions.findIndex((question) => question.id === questionId);
    if (questionIndex <= 0) return [] as CampaignQuestion[];
    return orderedQuestions
      .slice(0, questionIndex)
      .filter((question) => question.type !== "label");
  };

  const handleUpdateQuestionLogic = (
    questionIndex: number,
    updates: Partial<CampaignQuestion["visibility"]> & {
      sourceQuestionId?: string;
      operator?: QuestionLogicOperator;
      value?: string;
    },
  ) => {
    const question = questions[questionIndex];
    const currentRule = question.visibility?.rules?.[0] || {
      id: crypto.randomUUID(),
      sourceQuestionId: "",
      operator: "equals" as QuestionLogicOperator,
      value: "",
    };

    const nextRule = {
      ...currentRule,
      sourceQuestionId:
        updates.sourceQuestionId !== undefined
          ? updates.sourceQuestionId
          : currentRule.sourceQuestionId,
      operator: updates.operator || currentRule.operator,
      value: updates.value !== undefined ? updates.value : currentRule.value,
    };

    const nextVisibility =
      nextRule.sourceQuestionId.trim().length > 0
        ? {
            mode: updates.mode || question.visibility?.mode || "all",
            rules: [nextRule],
          }
        : undefined;

    handleUpdateQuestion(questionIndex, {
      visibility: nextVisibility,
      showIfQuestionId: nextVisibility?.rules[0]?.sourceQuestionId,
      showIfOperator: nextVisibility?.rules[0]?.operator,
      showIfValue: nextVisibility?.rules[0]?.value,
    });
  };

  const clearQuestionLogic = (questionIndex: number) => {
    handleUpdateQuestion(questionIndex, {
      visibility: undefined,
      showIfQuestionId: undefined,
      showIfOperator: undefined,
      showIfValue: undefined,
    });
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

  const handleToggleFileFormat = (
    questionIndex: number,
    format: FileUploadFormat,
    checked: boolean,
  ) => {
    const question = questions[questionIndex];
    const currentFormats = getFileUploadFormats(question);
    const nextFormats = checked
      ? Array.from(new Set([...currentFormats, format]))
      : currentFormats.filter((value) => value !== format);

    handleUpdateQuestion(questionIndex, {
      allowedFileTypes: nextFormats.length > 0 ? nextFormats : [format],
    });
  };

  const handleDuplicateQuestion = (questionId: string) => {
    const questionIndex = getQuestionIndexById(questionId);
    if (questionIndex === -1) return;

    const sourceQuestion = questions[questionIndex];
    const duplicateQuestion: CampaignQuestion = {
      ...sourceQuestion,
      id: crypto.randomUUID(),
      question: sourceQuestion.question ? `${sourceQuestion.question} (Copy)` : "",
      visibility: sourceQuestion.visibility
        ? {
            ...sourceQuestion.visibility,
            rules: sourceQuestion.visibility.rules.map((rule) => ({
              ...rule,
              id: crypto.randomUUID(),
            })),
          }
        : undefined,
      routeRules: sourceQuestion.routeRules?.map((rule) => ({
        ...rule,
        id: crypto.randomUUID(),
      })),
    };

    const updatedQuestions = [...questions];
    updatedQuestions.splice(questionIndex + 1, 0, duplicateQuestion);
    updateQuestions(updatedQuestions);
    setSelectedQuestionId(duplicateQuestion.id);
    setHighlightedQuestionId(duplicateQuestion.id);
    setHighlightedSectionId(duplicateQuestion.sectionId || null);
  };

  const getQuestionSummary = (question: CampaignQuestion) => {
    if (question.type === "file_upload") {
      return formatFileUploadSummary(question);
    }

    if (isOptionQuestionType(question.type)) {
      const optionCount = question.options?.length || 0;
      return `${optionCount} option${optionCount === 1 ? "" : "s"}`;
    }

    if (isMatrixQuestionType(question.type)) {
      const rowCount = question.rows?.length || 0;
      const columnCount = question.columns?.length || 0;
      return `${rowCount} row${rowCount === 1 ? "" : "s"} x ${columnCount} column${columnCount === 1 ? "" : "s"}`;
    }

    if (question.type === "scale" || question.type === "rating" || question.type === "nps") {
      return `${question.min ?? 1} to ${question.max ?? 5} scale`;
    }

    if (question.type === "date") {
      return "Date response";
    }

    if (question.type === "textarea" || question.type === "textbox" || question.type === "text") {
      return "Open text response";
    }

    return questionTypeLabels[question.type];
  };

  const getSimpleLogicOperator = (
    sourceQuestion?: CampaignQuestion | null,
  ): QuestionLogicOperator =>
    sourceQuestion?.type === "multiple_choice" ? "contains" : "equals";

  const getSimpleLogicChoices = (sourceQuestion?: CampaignQuestion | null): string[] => {
    if (!sourceQuestion) return [];

    if (
      sourceQuestion.type === "single_choice" ||
      sourceQuestion.type === "multiple_choice" ||
      sourceQuestion.type === "combobox" ||
      sourceQuestion.type === "rank"
    ) {
      return (sourceQuestion.options || []).filter((option) => option.trim().length > 0);
    }

    if (
      sourceQuestion.type === "rating" ||
      sourceQuestion.type === "scale" ||
      sourceQuestion.type === "nps"
    ) {
      const min = sourceQuestion.min ?? (sourceQuestion.type === "nps" ? 0 : 1);
      const max = sourceQuestion.max ?? (sourceQuestion.type === "rating" ? 5 : 10);
      return Array.from({ length: Math.max(max - min + 1, 0) }, (_, index) =>
        String(min + index),
      );
    }

    return [];
  };

  const canQuestionRouteByAnswer = (question: CampaignQuestion) =>
    question.type === "single_choice" ||
    question.type === "combobox" ||
    question.type === "rating" ||
    question.type === "scale" ||
    question.type === "nps";

  const getRouteChoices = (question: CampaignQuestion): string[] => {
    if (
      question.type === "single_choice" ||
      question.type === "combobox"
    ) {
      return (question.options || []).filter((option) => option.trim().length > 0);
    }

    if (
      question.type === "rating" ||
      question.type === "scale" ||
      question.type === "nps"
    ) {
      const min = question.min ?? (question.type === "nps" ? 0 : 1);
      const max = question.max ?? (question.type === "rating" ? 5 : 10);
      return Array.from({ length: Math.max(max - min + 1, 0) }, (_, index) =>
        String(min + index),
      );
    }

    return [];
  };

  const getBranchTargetSections = (questionId: string) => {
    const questionIndex = orderedQuestions.findIndex((question) => question.id === questionId);
    if (questionIndex === -1) return [] as SurveySection[];

    const currentQuestion = orderedQuestions[questionIndex];
    const currentSectionIndex = sections.findIndex(
      (section) => section.id === currentQuestion.sectionId,
    );

    return sections.filter((_, index) => index > currentSectionIndex);
  };

  const getSectionQuestions = (sectionId: string) =>
    orderedQuestions.filter((question) => question.sectionId === sectionId);

  const getRouteRule = (question: CampaignQuestion, answerValue: string) =>
    question.routeRules?.find((rule) => String(rule.answerValue) === answerValue);

  const handleUpdateRouteRule = (
    questionIndex: number,
    answerValue: string,
    updates: {
      targetSectionId?: string;
      targetQuestionId?: string;
    },
  ) => {
    const question = questions[questionIndex];
    const existingRules = question.routeRules || [];
    const existingRule = existingRules.find(
      (rule) => String(rule.answerValue) === answerValue,
    );

    const nextTargetSectionId =
      updates.targetSectionId !== undefined
        ? updates.targetSectionId
        : existingRule?.targetSectionId || "";
    const nextTargetQuestionId =
      updates.targetQuestionId !== undefined
        ? updates.targetQuestionId
        : existingRule?.targetQuestionId;

    const nextRules = existingRules.filter(
      (rule) => String(rule.answerValue) !== answerValue,
    );

    if (nextTargetSectionId.trim().length > 0) {
      nextRules.push({
        id: existingRule?.id || crypto.randomUUID(),
        answerValue,
        targetSectionId: nextTargetSectionId,
        targetQuestionId:
          nextTargetQuestionId && nextTargetQuestionId.trim().length > 0
            ? nextTargetQuestionId
            : undefined,
      });
    }

    handleUpdateQuestion(questionIndex, {
      routeRules: nextRules.length > 0 ? nextRules : undefined,
    });
  };

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
  const showAdvancedQuestionControls = !isLeanEditor;
  const primaryQuestionTypes: CampaignQuestion["type"][] = [
    "single_choice",
    "multiple_choice",
    "combobox",
    "textbox",
    "textarea",
    "rating",
    "scale",
    "nps",
    "checkbox_matrix",
    "radio_matrix",
    "rank",
    "date",
    "file_upload",
    "label",
  ];
  const selectedQuestionIndex = selectedQuestionId
    ? getQuestionIndexById(selectedQuestionId)
    : -1;
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
            label: "Brady Guide",
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
        <>
          <Card className="cw-soft-panel border-dashed">
            <CardContent className="py-8 text-center space-y-4">
              <p className="text-muted-foreground">
                No questions yet. Add your first question to continue.
              </p>
              <div className="flex justify-center">
                <Button variant="default" size="sm" className="cw-soft-pulse" onClick={() => handleAddQuestion()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
            </CardContent>
          </Card>

          <Sheet open={Boolean(addQuestionTarget)} onOpenChange={(open) => !open && setAddQuestionTarget(null)}>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Add question</SheetTitle>
                <SheetDescription>
                  Choose the kind of question you want, and it will open immediately in the builder.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {primaryQuestionTypes.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    className="h-auto min-h-20 justify-start rounded-2xl px-4 py-4 text-left"
                    onClick={() => handleAddQuestionOfType(type)}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{questionTypeLabels[type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {questionTypeDescriptions[type] || "Add this field type."}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </>
      );
    }

    return (
      <>
      <div className="space-y-4 pb-20 lg:pb-0">
        <div className="lg:hidden sticky bottom-4 z-20">
          <Card className="cw-soft-panel border-slate-200/90 shadow-[0_16px_35px_rgba(15,23,42,0.16)]">
            <CardContent className="grid grid-cols-2 gap-2 p-3">
              <Button type="button" onClick={handleAddQuestion}>
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
              <Button type="button" variant="outline" onClick={handleAddSection}>
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </CardContent>
          </Card>
        </div>

      <div className="space-y-3">
          {orderedQuestions.map((question, index) => {
            const actualIndex = getQuestionIndexById(question.id);
            if (actualIndex === -1) return null;

            const earlierQuestions = getEarlierQuestions(question.id);
            const activeRule = question.visibility?.rules?.[0];
            const sourceQuestion = earlierQuestions.find(
              (candidate) => candidate.id === activeRule?.sourceQuestionId,
            );
            const selectedValue =
              activeRule?.value !== undefined ? String(activeRule.value) : "";
            const simpleLogicChoices = getSimpleLogicChoices(sourceQuestion);
            const simpleLogicOperator = getSimpleLogicOperator(sourceQuestion);
            const routeChoices = getRouteChoices(question);
            const routeTargetSections = getBranchTargetSections(question.id);
            const isSelected = selectedQuestionId === question.id;
            const startsNewSection =
              index === 0 || orderedQuestions[index - 1]?.sectionId !== question.sectionId;
            const section = sections.find((candidate) => candidate.id === question.sectionId);
            const sectionIndex = sections.findIndex((candidate) => candidate.id === question.sectionId);

            return (
              <div key={question.id} className="space-y-3">
                {startsNewSection && (
                  <Card
                    className={cn(
                      "border-dashed border-slate-300 bg-slate-50/70 shadow-none transition-all",
                      highlightedSectionId === question.sectionId &&
                        "border-primary/60 bg-primary/5 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]",
                      dropTarget?.type === "section" &&
                        dropTarget.id === question.sectionId &&
                        "border-primary bg-primary/10 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]",
                    )}
                    draggable
                    onDragStart={() => {
                      setDragState({ type: "section", id: question.sectionId || "" });
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      setDragState(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropTarget({ type: "section", id: question.sectionId || "" });
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragState?.type === "section") {
                        handleReorderSectionByDrop(dragState.id, question.sectionId || "");
                      }
                      if (dragState?.type === "question") {
                        handleMoveQuestionToSection(dragState.id, question.sectionId || "");
                      }
                      setDragState(null);
                      setDropTarget(null);
                    }}
                  >
                    <CardContent className="space-y-3 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Section {sectionIndex + 1}
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {section?.title || `Section ${index + 1}`}
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-500">
                            <GripVertical className="h-3.5 w-3.5" />
                            Drag to reorder
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Section title</Label>
                          <Input
                            value={section?.title || ""}
                            onFocus={selectInputText}
                            onChange={(event) =>
                              sectionIndex >= 0
                                ? handleUpdateSection(sectionIndex, { title: event.target.value })
                                : undefined
                            }
                            placeholder={`Section ${sectionIndex + 1}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Short description</Label>
                          <Input
                            value={section?.description || ""}
                            onFocus={selectInputText}
                            onChange={(event) =>
                              sectionIndex >= 0
                                ? handleUpdateSection(sectionIndex, {
                                    description: event.target.value,
                                  })
                                : undefined
                            }
                            placeholder="What this section helps the responder do"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-1">
                        <span className="text-xs font-medium text-slate-500">
                          {getSectionQuestionCount(question.sectionId || "")} question
                          {getSectionQuestionCount(question.sectionId || "") === 1 ? "" : "s"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddQuestion(question.sectionId)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add question
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirmRemoveSection(section)) {
                              handleRemoveSection(sectionIndex);
                            }
                          }}
                          disabled={sections.length <= 1}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove Section
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className={cn("relative", isSelected && "lg:pr-24")}>
                  <Card
                    className={cn(
                      "relative border-slate-200/90 transition-all",
                      isSelected
                        ? "overflow-visible border-l-4 border-l-primary shadow-[0_18px_35px_rgba(15,23,42,0.12)]"
                        : "cursor-pointer overflow-hidden bg-white/95 shadow-sm hover:border-slate-300 hover:shadow-md",
                      highlightedQuestionId === question.id &&
                        "border-primary/60 bg-primary/[0.03] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]",
                      dropTarget?.type === "question" &&
                        dropTarget.id === question.id &&
                        "border-primary bg-primary/[0.06] shadow-[0_0_0_3px_rgba(59,130,246,0.18)]",
                    )}
                    draggable={!isSelected}
                    onClick={() => !isSelected && setSelectedQuestionId(question.id)}
                    onDragStart={() => {
                      if (isSelected) return;
                      setDragState({ type: "question", id: question.id });
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      setDragState(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(event) => {
                      if (isSelected) return;
                      event.preventDefault();
                      setDropTarget({ type: "question", id: question.id });
                    }}
                    onDrop={(event) => {
                      if (isSelected) return;
                      event.preventDefault();
                      if (dragState?.type === "question") {
                        handleReorderQuestionByDrop(dragState.id, question.id);
                      }
                      setDragState(null);
                      setDropTarget(null);
                    }}
                  >
                    <CardContent className={cn("pt-4", !isSelected && "px-4 py-4")}>
                    {isSelected ? (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Q{index + 1}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getSectionTitle(question.sectionId)}
                          </Badge>
                          {question.visibility?.rules?.length ? (
                            <Badge variant="outline" className="text-xs text-slate-600">
                              Conditional
                            </Badge>
                          ) : null}
                          {showValidation && !isQuestionClear(question) ? (
                            <Badge variant="destructive" className="text-xs">
                              Needs clarity
                            </Badge>
                          ) : null}
                          {isLeanEditor ? (
                            <Badge variant="outline" className="text-xs">
                              {isConversationBuilder ? "Conversation prompt" : "Quick question"}
                            </Badge>
                          ) : (
                            <Select
                              value={question.type}
                              onValueChange={(type: CampaignQuestion["type"]) =>
                                handleQuestionTypeChange(actualIndex, type)
                              }
                            >
                              <SelectTrigger className={easyMode ? "h-10 w-full text-sm sm:w-[230px]" : "h-8 w-full sm:w-[190px]"}>
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
                        </div>

                  <Input
                    autoFocus={isSelected && question.question.trim().length === 0}
                    placeholder="Type your question here"
                    value={question.question}
                    onFocus={selectInputText}
                    onChange={(e) =>
                      handleUpdateQuestion(actualIndex, { question: e.target.value })
                    }
                    className={easyMode ? "h-11 text-base" : ""}
                  />
                  {showValidation && !isQuestionClear(question) && (
                    <p className="text-xs font-medium text-destructive">
                      Write at least 8 characters so this question is clear.
                    </p>
                  )}

                  {showAdvancedQuestionControls && !isLeanEditor && (
                    <div className="space-y-2">
                        <Label className="text-xs">Show this question only when</Label>
                        <Select
                          value={activeRule?.sourceQuestionId || "__none__"}
                          onValueChange={(sourceQuestionId) => {
                            if (sourceQuestionId === "__none__") {
                              clearQuestionLogic(actualIndex);
                              return;
                            }

                            const nextSourceQuestion = earlierQuestions.find(
                              (candidate) => candidate.id === sourceQuestionId,
                            );
                            const nextChoices = getSimpleLogicChoices(nextSourceQuestion);

                            handleUpdateQuestionLogic(actualIndex, {
                              sourceQuestionId,
                              operator: getSimpleLogicOperator(nextSourceQuestion),
                              value: nextChoices[0] || "",
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Always show this question" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              Always show this question
                            </SelectItem>
                            {earlierQuestions.map((candidate) => (
                              <SelectItem key={candidate.id} value={candidate.id}>
                                {candidate.question || "Question above"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {earlierQuestions.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Add a question above first, then you can link an answer to this question.
                          </p>
                        )}
                    </div>
                  )}

                  {showAdvancedQuestionControls && !isLeanEditor && activeRule && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-2">
                          <Label className="text-xs">Question above</Label>
                          <p className="text-sm font-medium text-slate-900">
                            {sourceQuestion?.question || "Select a source question"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Answer is</Label>
                          {simpleLogicChoices.length > 0 ? (
                            <Select
                              value={selectedValue || simpleLogicChoices[0]}
                              onValueChange={(value) =>
                                handleUpdateQuestionLogic(actualIndex, {
                                  operator: simpleLogicOperator,
                                  value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {simpleLogicChoices.map((choice) => (
                                  <SelectItem key={`${question.id}-${choice}`} value={choice}>
                                    {choice}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={selectedValue}
                              onChange={(event) =>
                                handleUpdateQuestionLogic(actualIndex, {
                                  operator: simpleLogicOperator,
                                  value: event.target.value,
                                })
                              }
                              placeholder="Type the answer to match"
                            />
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        When someone answers{" "}
                        <span className="font-semibold text-slate-700">
                          "{selectedValue || "this value"}"
                        </span>{" "}
                        to the question above, this question will appear next.
                      </p>
                    </div>
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
                            onFocus={selectInputText}
                            onChange={(event) =>
                              handleUpdateOption(actualIndex, optionIndex, event.target.value)
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveOption(actualIndex, optionIndex)}
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
                        onClick={() => handleAddOption(actualIndex)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add option
                      </Button>
                    </div>
                  )}

                  {canQuestionRouteByAnswer(question) && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div>
                        <Label className="text-xs">Go to section based on answer</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Choose where the responder should go next for each answer.
                        </p>
                      </div>

                      {routeTargetSections.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Add another section below this one to enable answer routing.
                        </p>
                      ) : routeChoices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Add answer choices first, then you can route each answer.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {routeChoices.map((choice) => {
                            const routeRule = getRouteRule(question, choice);
                            const targetQuestions = routeRule?.targetSectionId
                              ? getSectionQuestions(routeRule.targetSectionId)
                              : [];

                            return (
                              <div
                                key={`${question.id}-route-${choice}`}
                                className="grid gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 md:grid-cols-[minmax(0,1fr)_220px_220px]"
                              >
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    Answer
                                  </p>
                                  <p className="text-sm font-semibold text-slate-900">"{choice}"</p>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Section</Label>
                                  <Select
                                    value={routeRule?.targetSectionId || "__continue__"}
                                    onValueChange={(value) =>
                                      handleUpdateRouteRule(actualIndex, choice, {
                                        targetSectionId:
                                          value === "__continue__" ? "" : value,
                                        targetQuestionId: "",
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__continue__">
                                        Continue normally
                                      </SelectItem>
                                      {routeTargetSections.map((targetSection) => (
                                        <SelectItem key={targetSection.id} value={targetSection.id}>
                                          {targetSection.title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Question in section</Label>
                                  <Select
                                    value={routeRule?.targetQuestionId || "__first__"}
                                    onValueChange={(value) =>
                                      handleUpdateRouteRule(actualIndex, choice, {
                                        targetQuestionId: value === "__first__" ? "" : value,
                                      })
                                    }
                                    disabled={!routeRule?.targetSectionId}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="First question in section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__first__">
                                        First question in section
                                      </SelectItem>
                                      {targetQuestions.map((targetQuestion, targetIndex) => (
                                        <SelectItem
                                          key={targetQuestion.id}
                                          value={targetQuestion.id}
                                        >
                                          {targetQuestion.question?.trim() ||
                                            `Question ${targetIndex + 1}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                                onFocus={selectInputText}
                                onChange={(event) =>
                                  handleMatrixEntryUpdate(
                                    actualIndex,
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
                                  handleMatrixEntryRemove(actualIndex, "rows", rowIndex)
                                }
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
                          onClick={() => handleMatrixEntryAdd(actualIndex, "rows")}
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
                              onFocus={selectInputText}
                              onChange={(event) =>
                                handleMatrixEntryUpdate(
                                  actualIndex,
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
                                handleMatrixEntryRemove(actualIndex, "columns", columnIndex)
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
                          onClick={() => handleMatrixEntryAdd(actualIndex, "columns")}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add column
                        </Button>
                      </div>
                    </div>
                  )}

                  {showAdvancedQuestionControls &&
                    !isLeanEditor &&
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
                            handleUpdateQuestion(actualIndex, {
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
                            handleUpdateQuestion(actualIndex, {
                              max: Number(
                                e.target.value || (question.type === "rating" ? 5 : 10),
                              ),
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {!isLeanEditor && question.type === "file_upload" && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div>
                        <Label className="text-xs">Upload rules</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Choose which file types are allowed and how many files can be uploaded for this question.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Maximum files</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={getFileUploadMaxFiles(question)}
                            onChange={(event) =>
                              handleUpdateQuestion(actualIndex, {
                                maxFiles: Number(event.target.value || 1),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Max size per file (MB)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={getFileUploadMaxSizeMb(question)}
                            onChange={(event) =>
                              handleUpdateQuestion(actualIndex, {
                                maxFileSizeMb: Number(event.target.value || 10),
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Allowed file formats</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {availableFileFormats.map((format) => {
                            const checked = getFileUploadFormats(question).includes(format);
                            return (
                              <label
                                key={`${question.id}-${format}`}
                                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    handleToggleFileFormat(actualIndex, format, Boolean(value))
                                  }
                                />
                                <span>{FILE_UPLOAD_FORMAT_LABELS[format]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-xs font-medium text-slate-700">
                        {formatFileUploadSummary(question)}
                      </p>
                    </div>
                  )}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleAddQuestionAfter(question.id, question.sectionId)
                              }
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Question
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDuplicateQuestion(question.id)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirmRemoveQuestion(question)) {
                                  handleRemoveQuestion(actualIndex);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`required-${index}`} className={easyMode ? "text-sm font-medium" : "text-xs"}>
                              Required
                            </Label>
                            <Switch
                              id={`required-${index}`}
                              checked={question.required}
                              onCheckedChange={(required) =>
                                handleUpdateQuestion(actualIndex, { required })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-xs text-slate-500">
                              <GripVertical className="mr-1 h-3 w-3" />
                              Drag
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              Q{index + 1}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getSectionTitle(question.sectionId)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {questionTypeLabels[question.type]}
                            </Badge>
                            {question.required ? (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            ) : null}
                            {question.visibility?.rules?.length ? (
                              <Badge variant="outline" className="text-xs text-slate-600">
                                Conditional
                              </Badge>
                            ) : null}
                            {showValidation && !isQuestionClear(question) ? (
                              <Badge variant="destructive" className="text-xs">
                                Needs clarity
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-base font-semibold text-slate-900">
                            {question.question || "Click to write your question"}
                          </p>
                          <p className="text-sm text-slate-500">{getQuestionSummary(question)}</p>
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleAddQuestionAfter(question.id, question.sectionId)
                            }
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Question
                          </Button>
                        </div>
                      </div>
                    )}
                    </CardContent>
                  </Card>
                  {isSelected ? (
                    <div className="absolute right-0 top-4 hidden lg:flex lg:flex-col lg:items-center lg:gap-2">
                      <p className="cw-builder-rail-label text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                        Builder Tools
                      </p>
                      <Button
                        type="button"
                        size="icon"
                        className="h-11 w-11 rounded-2xl shadow-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAddQuestionAfter(question.id, question.sectionId);
                        }}
                        title="Add question"
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-2xl bg-white/90 shadow-sm dark:bg-slate-800"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAddSection();
                        }}
                        title="Add section"
                      >
                        <Rows3 className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-2xl bg-white/90 text-destructive shadow-sm hover:text-destructive dark:bg-slate-800"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (confirmRemoveQuestion(question)) {
                            handleRemoveQuestion(actualIndex);
                          }
                        }}
                        title="Delete question"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-2xl bg-white/90 text-destructive shadow-sm hover:text-destructive dark:bg-slate-800"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (confirmDiscardCampaign()) {
                            onDiscardCampaign?.();
                          }
                        }}
                        title="Move campaign to trash"
                      >
                        <ArchiveX className="h-5 w-5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
      </div>
      </div>
      <Sheet open={Boolean(addQuestionTarget)} onOpenChange={(open) => !open && setAddQuestionTarget(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add question</SheetTitle>
            <SheetDescription>
              Choose the kind of question you want, and it will open immediately in the builder.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {primaryQuestionTypes.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                className="h-auto min-h-20 justify-start rounded-2xl px-4 py-4 text-left"
                onClick={() => handleAddQuestionOfType(type)}
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{questionTypeLabels[type]}</p>
                  <p className="text-xs text-muted-foreground">
                    {questionTypeDescriptions[type] || "Add this field type."}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      </>
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
              <p className="cw-completion-score text-2xl font-extrabold leading-none text-slate-900">
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

      {renderQuestionBuilder()}
    </div>
  );
}
