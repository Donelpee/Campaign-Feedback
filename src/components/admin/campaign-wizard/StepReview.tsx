import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

interface StepReviewProps {
  data: WizardData;
}

const questionTypeLabels: Record<string, string> = {
  rating: "Star Rating",
  scale: "Scale",
  multiple_choice: "Multiple Choice",
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

const buildModeLabel: Record<string, string> = {
  ai: "AI Builder",
  upload: "Document Upload Builder",
  manual: "Manual Builder",
};

export function StepReview({ data }: StepReviewProps) {
  const requiredCount = data.questions.filter((q) => q.required).length;
  const [company, setCompany] = useState<Company | null>(null);

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
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Campaign Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
                {buildModeLabel[data.buildMode || "manual"] || "Manual Builder"}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            What Respondents Will Fill ({data.questions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm mb-3">
            <span className="text-muted-foreground">
              {requiredCount} required,{" "}
            </span>
            <span className="text-muted-foreground">
              {data.questions.length - requiredCount} optional
            </span>
          </div>

          <div className="space-y-3">
            {data.questions.map((question, index) => (
              <div key={question.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex items-start gap-3">
                  <span className="text-xs font-medium text-muted-foreground min-w-[24px]">
                    Q{index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">
                      {question.question}
                      {question.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {questionTypeLabels[question.type]}
                    </Badge>
                    {question.showIfQuestionId && (
                      <Badge variant="outline" className="text-xs mt-1 ml-1">
                        Conditional
                      </Badge>
                    )}
                    <QuestionPreview question={question} className="mt-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
