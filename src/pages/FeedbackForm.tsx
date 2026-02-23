// Feedback form for campaign links (public)
// Accessibility: Semantic HTML, clear headings, accessible controls, ARIA labels
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { CampaignQuestion, FeedbackFormData } from "@/lib/supabase-types";

type MatrixAnswer = Record<string, string | string[]>;
type DynamicAnswer = number | string | string[] | MatrixAnswer;
interface LinkData {
  id: string;
  company_name: string;
  company_logo_url: string | null;
  campaign_name: string;
  campaign_description: string | null;
  campaign_type: string | null;
  campaign_questions: CampaignQuestion[];
  is_active: boolean;
  start_date: string;
  end_date: string;
}

export default function FeedbackForm() {
  // Routing and state
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [dynamicAnswers, setDynamicAnswers] = useState<
    Record<string, DynamicAnswer>
  >({});
  const [formData, setFormData] = useState<FeedbackFormData>({
    overall_satisfaction: 5,
    service_quality: 3,
    recommendation_likelihood: 3,
    improvement_areas: [],
    additional_comments: "",
  });

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
      };

      if (!linkInfo.is_active) {
        setLoadError("This feedback form is no longer accepting responses.");
        setIsLoading(false);
        return;
      }

      const now = new Date();
      const startDate = new Date(linkInfo.start_date);
      const endDate = new Date(linkInfo.end_date);
      endDate.setHours(23, 59, 59, 999);

      if (now < startDate) {
        setLoadError("This feedback campaign has not started yet.");
        setIsLoading(false);
        return;
      }

      if (now > endDate) {
        setLoadError("This feedback campaign has ended.");
        setIsLoading(false);
        return;
      }

      const questions = Array.isArray(linkInfo.campaign_questions)
        ? linkInfo.campaign_questions
        : [];

      setLinkData({ ...linkInfo, campaign_questions: questions });
      initializeDynamicAnswers(questions);
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading link data:", err);
      setLoadError("Failed to load the feedback form. Please try again.");
      setIsLoading(false);
    }
  }, [code, initializeDynamicAnswers]);

  const incrementAccessCount = useCallback(async () => {
    if (!code) return;
    await supabase.rpc("increment_access_count", { link_code: code });
  }, [code]);

  useEffect(() => {
    if (!code) return;
    loadLinkData();
    incrementAccessCount();
  }, [code, incrementAccessCount, loadLinkData]);

  const hasDynamicQuestions = (linkData?.campaign_questions?.length || 0) > 0;

  const doesConditionMatch = useCallback(
    (answer: DynamicAnswer | undefined, operator: string, expectedValue: string) => {
      const expected = expectedValue.trim().toLowerCase();
      if (!expected) return true;

      const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

      const asFlatValues = (): string[] => {
        if (answer === undefined || answer === null) return [];
        if (Array.isArray(answer)) return answer.map((v) => normalize(v));
        if (typeof answer === "object") {
          return Object.values(answer as Record<string, unknown>).flatMap((value) =>
            Array.isArray(value)
              ? value.map((entry) => normalize(entry))
              : [normalize(value)],
          );
        }
        return [normalize(answer)];
      };

      const values = asFlatValues();

      const equalsMatch = values.some((value) => value === expected);
      const containsMatch = values.some((value) => value.includes(expected));

      if (operator === "not_equals") return !equalsMatch;
      if (operator === "contains") return containsMatch;
      return equalsMatch;
    },
    [],
  );

  const isQuestionVisible = useCallback(
    (question: CampaignQuestion) => {
      if (!question.showIfQuestionId) return true;
      const sourceAnswer = dynamicAnswers[question.showIfQuestionId];
      return doesConditionMatch(
        sourceAnswer,
        question.showIfOperator || "equals",
        question.showIfValue || "",
      );
    },
    [doesConditionMatch, dynamicAnswers],
  );

  const visibleDynamicQuestions = useMemo(() => {
    if (!linkData) return [];
    return (linkData.campaign_questions || []).filter((question) =>
      isQuestionVisible(question),
    );
  }, [isQuestionVisible, linkData]);

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
      answers: dynamicAnswers,
    };
  }, [dynamicAnswers, formData, hasDynamicQuestions, linkData]);

  const isRequiredQuestionMissing = (question: CampaignQuestion) => {
    if (!question.required) return false;
    const answer = dynamicAnswers[question.id];
    if (question.type === "multiple_choice") {
      return !Array.isArray(answer) || answer.length === 0;
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
      return String(answer ?? "").trim().length === 0;
    }
    if (question.type === "combobox") {
      return String(answer ?? "").trim().length === 0;
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
    return answer === undefined || answer === null || Number.isNaN(Number(answer));
  };

  const validateDynamicQuestions = () => {
    if (!hasDynamicQuestions || !linkData) return true;

    const missingRequired = visibleDynamicQuestions.some((question) =>
      isRequiredQuestionMissing(question),
    );

    if (missingRequired) {
      setSubmitError("Please complete all required questions before submitting.");
      return false;
    }

    setSubmitError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkData || !code) return;

    setSubmitError(null);
    setShowValidationErrors(true);
    if (!validateDynamicQuestions()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc("submit_feedback_response", {
        p_code: code,
        p_payload: {
          overall_satisfaction: derivedPayload.overall_satisfaction,
          service_quality: derivedPayload.service_quality,
          recommendation_likelihood: derivedPayload.recommendation_likelihood,
          improvement_areas: derivedPayload.improvement_areas,
          additional_comments: derivedPayload.additional_comments || null,
          answers: derivedPayload.answers,
        },
      });

      if (error) throw error;

      setIsSubmitted(true);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setSubmitError("Failed to submit your feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
                Unable to Load Form
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
                Your feedback has been submitted successfully. We appreciate
                your time and valuable input.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleMultipleChoiceToggle = (questionId: string, option: string) => {
    const current = (dynamicAnswers[questionId] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter((value) => value !== option)
      : [...current, option];

    setDynamicAnswers((prev) => ({ ...prev, [questionId]: next }));
  };

  const renderDynamicQuestion = (question: CampaignQuestion, index: number) => {
    const isRequired = question.required;
    const commonDescription = isRequired ? "Required" : "Optional";

    if (question.type === "scale") {
      return (
        <SatisfactionSlider
          value={Number(dynamicAnswers[question.id] ?? question.min ?? 1)}
          onChange={(value) =>
            setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }))
          }
          min={question.min ?? 1}
          max={question.max ?? 10}
          label={question.question}
          description={commonDescription}
        />
      );
    }

    if (question.type === "rating") {
      return (
        <StarRating
          value={Number(dynamicAnswers[question.id] ?? 3)}
          onChange={(value) =>
            setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }))
          }
          label={question.question}
          description={commonDescription}
        />
      );
    }

    if (question.type === "nps") {
      return (
        <SatisfactionSlider
          value={Number(dynamicAnswers[question.id] ?? 0)}
          onChange={(value) =>
            setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }))
          }
          min={question.min ?? 0}
          max={question.max ?? 10}
          label={question.question}
          description={commonDescription}
        />
      );
    }

    if (question.type === "multiple_choice") {
      const options = question.options || [];
      const selected =
        (dynamicAnswers[question.id] as string[] | undefined) ?? [];

      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground">{question.question}</h3>
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
                  onCheckedChange={() =>
                    handleMultipleChoiceToggle(question.id, option)
                  }
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (question.type === "combobox") {
      const options = question.options || [];
      const selected = String(dynamicAnswers[question.id] ?? "");
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground">{question.question}</h3>
            <p className="text-sm text-muted-foreground">{commonDescription}</p>
          </div>
          <Select
            value={selected}
            onValueChange={(value) =>
              setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (question.type === "single_choice") {
      const options = question.options || [];
      const selected = String(dynamicAnswers[question.id] ?? "");

      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground">{question.question}</h3>
            <p className="text-sm text-muted-foreground">{commonDescription}</p>
          </div>
          <RadioGroup
            value={selected}
            onValueChange={(value) =>
              setDynamicAnswers((prev) => ({ ...prev, [question.id]: value }))
            }
            className="space-y-3"
          >
            {options.map((option) => {
              const optionId = `${question.id}-${option}`;
              return (
                <div
                  key={option}
                  className="flex items-center space-x-2 rounded-lg border p-3"
                >
                  <RadioGroupItem value={option} id={optionId} />
                  <Label htmlFor={optionId} className="font-normal text-sm">
                    {option}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>
      );
    }

    if (question.type === "checkbox_matrix" || question.type === "radio_matrix") {
      const rows = question.rows || [];
      const columns = question.columns || [];
      const value =
        (dynamicAnswers[question.id] as MatrixAnswer | undefined) || {};

      const toggleMatrixCheckbox = (row: string, column: string) => {
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
            <h3 className="font-medium text-foreground">{question.question}</h3>
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
                            onCheckedChange={() => toggleMatrixCheckbox(row, column)}
                          />
                        ) : (
                          <input
                            type="radio"
                            name={`${question.id}-${row}`}
                            checked={String(value[row] ?? "") === column}
                            onChange={() => setMatrixRadio(row, column)}
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
          <h3 className="font-medium text-foreground">{question.question}</h3>
          <p className="text-sm text-muted-foreground">{commonDescription}</p>
          <Input
            type="date"
            value={String(dynamicAnswers[question.id] ?? "")}
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
      return (
        <div className="space-y-2">
          <h3 className="font-medium text-foreground">{question.question}</h3>
          <p className="text-sm text-muted-foreground">{commonDescription}</p>
          <Input
            type="file"
            onChange={(event) => {
              const files = Array.from(event.target.files || []).map((file) => file.name);
              setDynamicAnswers((prev) => ({
                ...prev,
                [question.id]: files,
              }));
            }}
          />
          {Array.isArray(dynamicAnswers[question.id]) &&
            (dynamicAnswers[question.id] as string[]).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {(dynamicAnswers[question.id] as string[]).join(", ")}
              </p>
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
                    disabled={itemIndex === 0}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveRank(itemIndex, itemIndex + 1)}
                    disabled={itemIndex === current.length - 1}
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
          <h3 className="font-medium text-foreground">{question.question}</h3>
          <p className="text-sm text-muted-foreground">{commonDescription}</p>
          <Input
            value={String(dynamicAnswers[question.id] ?? "")}
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
          <h3 className="font-medium text-foreground">{question.question}</h3>
          <p className="text-sm text-muted-foreground">{commonDescription}</p>
          <Textarea
            value={String(dynamicAnswers[question.id] ?? "")}
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
    <div className="admin-shell-bg warm-feedback-bg min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="warm-feedback-header text-center mb-8 rounded-3xl p-6">
          {linkData?.company_logo_url ? (
            <img
              src={linkData.company_logo_url}
              alt={`${linkData.company_name} logo`}
              className="h-16 w-auto mx-auto mb-4 object-contain"
            />
          ) : linkData?.company_name ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary mb-4">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{linkData.company_name}</span>
            </div>
          ) : null}
          {linkData?.company_name && linkData?.company_logo_url && (
            <p className="text-sm text-muted-foreground mb-2">
              {linkData.company_name}
            </p>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            {linkData?.campaign_name}
          </h1>
          {linkData?.campaign_description ? (
            <p className="mt-2 text-muted-foreground">
              {linkData.campaign_description}
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Your feedback is completely anonymous and helps us improve our
              services.
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {submitError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            )}
            {hasDynamicQuestions ? (
              visibleDynamicQuestions.map((question, index) => (
                <Card
                  key={question.id}
                  className={`warm-question-card transition-shadow duration-200 ${
                    showValidationErrors && isRequiredQuestionMissing(question)
                      ? "border-destructive/70 ring-1 ring-destructive/40"
                      : ""
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Question {index + 1}
                      {question.required && (
                        <span className="ml-1 text-destructive">*</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {question.required
                        ? "Required question"
                        : "Optional question"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderDynamicQuestion(question, index)}
                    {showValidationErrors &&
                      isRequiredQuestionMissing(question) && (
                        <div className="mt-4 flex items-center gap-2 text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          <p className="text-sm">This is a required question</p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <Card className="warm-question-card transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Overall Experience
                    </CardTitle>
                    <CardDescription>
                      How would you rate your overall satisfaction with our
                      services?
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
                    />
                  </CardContent>
                </Card>

                <Card className="warm-question-card transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Service Quality</CardTitle>
                    <CardDescription>
                      How would you rate the quality of our service/product?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StarRating
                      value={formData.service_quality}
                      onChange={(value) =>
                        setFormData({ ...formData, service_quality: value })
                      }
                      label="Service Quality Rating"
                    />
                  </CardContent>
                </Card>

                <Card className="warm-question-card transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Recommendation</CardTitle>
                    <CardDescription>
                      How likely are you to recommend our services to a
                      colleague?
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
                    />
                  </CardContent>
                </Card>

                <Card className="warm-question-card transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Areas for Improvement
                    </CardTitle>
                    <CardDescription>
                      Select any areas where you think we could improve
                      (optional)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ImprovementAreas
                      value={formData.improvement_areas}
                      onChange={(value) =>
                        setFormData({ ...formData, improvement_areas: value })
                      }
                      label="Select all that apply"
                    />
                  </CardContent>
                </Card>

                <Card className="warm-question-card transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Additional Comments
                    </CardTitle>
                    <CardDescription>
                      Share any additional thoughts or suggestions (optional)
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
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
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
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          This survey is confidential. No personal information is collected.
        </p>
      </div>
    </div>
  );
}
