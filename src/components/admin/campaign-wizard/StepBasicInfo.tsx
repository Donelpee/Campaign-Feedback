import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/lib/supabase-types";
import type { WizardData } from "./CampaignWizard";
import { Sparkles } from "lucide-react";
import type { CreationMode } from "./CampaignWizard";

interface StepBasicInfoProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  isEditing?: boolean;
  lockStartDate?: boolean;
  easyMode?: boolean;
  showValidation?: boolean;
  creationMode?: CreationMode;
}

export function StepBasicInfo({
  data,
  onChange,
  isEditing = false,
  lockStartDate = false,
  easyMode = true,
  showValidation = false,
  creationMode,
}: StepBasicInfoProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      setIsLoadingCompanies(true);
      const { data: rows } = await supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true });

      setCompanies(rows ?? []);
      setIsLoadingCompanies(false);
    };

    loadCompanies();
  }, []);

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find((item) => item.id === companyId);
    onChange({
      selectedCompanyId: companyId,
      selectedCompanyName: company?.name ?? "",
    });
  };

  const companyMissing = !data.selectedCompanyId;
  const nameMissing = !data.name.trim();
  const nameTooShort = data.name.trim().length > 0 && data.name.trim().length < 10;
  const descriptionMissing = !data.description.trim();
  const descriptionTooShort =
    data.description.trim().length > 0 && data.description.trim().length < 10;
  const startDateMissing = !data.startDate;
  const endDateMissing = !data.endDate;
  const invalidDateRange =
    Boolean(data.startDate && data.endDate) && data.endDate < data.startDate;
  const dateRangeComplete =
    Boolean(data.startDate && data.endDate) && !invalidDateRange;
  const isQuickStart = creationMode === "quick_start";

  const checks = [
    !companyMissing,
    !nameMissing,
    ...(isQuickStart ? [] : [!descriptionMissing]),
    !startDateMissing,
    !endDateMissing,
    dateRangeComplete,
  ];
  const completed = checks.filter(Boolean).length;
  const percent = Math.round((completed / checks.length) * 100);
  const hasBlockingIssue =
    companyMissing ||
    nameMissing ||
    nameTooShort ||
    (!isQuickStart && (descriptionMissing || descriptionTooShort)) ||
    startDateMissing ||
    endDateMissing ||
    invalidDateRange;
  const isTemplateStory = creationMode === "template_story";
  const isConversationBuilder = creationMode === "conversation_builder";
  const modeMeta = isQuickStart
    ? {
      label: "Quick Start setup",
      toneClass: "border-sky-200/80 bg-sky-50/50",
      nameLabel: "2. Campaign Name *",
      namePlaceholder: "Example: March Nkọwa",
        goalLabel: "3. Campaign Goal *",
        goalPlaceholder: "Example: Learn what customers liked this month.",
      }
    : isTemplateStory
      ? {
          label: "Template Story setup",
          toneClass: "border-violet-200/80 bg-violet-50/45",
          nameLabel: "2. Story Campaign Name *",
          namePlaceholder: "Example: New Product Story Feedback",
          goalLabel: "3. Story Goal *",
          goalPlaceholder: "Example: Validate if this launch story was clear and useful.",
        }
      : isConversationBuilder
        ? {
            label: "Conversation setup",
            toneClass: "border-amber-200/80 bg-amber-50/50",
            nameLabel: "2. Conversation Name *",
            namePlaceholder: "Example: Support Experience Conversation",
            goalLabel: "3. Conversation Goal *",
            goalPlaceholder: "Example: Understand service quality through short prompts.",
          }
        : {
            label: "Guided setup",
            toneClass: "border-slate-200 bg-slate-50/55",
            nameLabel: "2. Give Your Survey a Name *",
            namePlaceholder: "Example: Happy Clients Check-In",
            goalLabel: "3. Explain the Goal *",
            goalPlaceholder:
              "Example: We want to learn what we are doing well and what we should improve.",
          };

  return (
    <div className="space-y-6">
      <Card className={`cw-soft-panel cw-soft-panel-hover ${modeMeta.toneClass}`}>
        <CardContent className="pt-5 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-slate-900">Campaign Details</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-300 bg-white/85 px-3 py-1.5 text-sm font-extrabold text-slate-800 shadow-sm">
                <Sparkles className="h-4 w-4" />
                {percent}% complete
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200">
              <div
                className="h-2.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            {showValidation && hasBlockingIssue && (
              <p className="text-sm font-medium text-destructive">
                Complete all required fields to continue.
              </p>
            )}
          </div>

          {isQuickStart ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company" className={easyMode ? "text-base font-semibold" : ""}>
                    1. Pick a Company *
                  </Label>
                  <Select
                    value={data.selectedCompanyId}
                    onValueChange={handleCompanyChange}
                    disabled={isEditing}
                  >
                    <SelectTrigger
                      id="company"
                      className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                    >
                      <SelectValue
                        placeholder={
                          isLoadingCompanies ? "Loading companies..." : "Select a company"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showValidation && companyMissing && (
                    <p className="text-xs font-medium text-destructive">
                      Select a company to continue.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className={easyMode ? "text-base font-semibold" : ""}>
                    {modeMeta.nameLabel}
                  </Label>
                  <Input
                    id="name"
                    placeholder={modeMeta.namePlaceholder}
                    value={data.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                  />
                  {showValidation && nameMissing && (
                    <p className="text-xs font-medium text-destructive">
                      Enter a campaign name to continue.
                    </p>
                  )}
                  {showValidation && !nameMissing && nameTooShort && (
                    <p className="text-xs font-medium text-destructive">
                      Campaign name must be at least 10 characters.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className={easyMode ? "text-base font-semibold" : ""}>
                    3. Start Date *
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={data.startDate}
                    onChange={(e) => onChange({ startDate: e.target.value })}
                    disabled={lockStartDate}
                    className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                  />
                  {showValidation && startDateMissing && (
                    <p className="text-xs font-medium text-destructive">
                      Select a start date.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className={easyMode ? "text-base font-semibold" : ""}>
                    4. End Date *
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={data.endDate}
                    onChange={(e) => onChange({ endDate: e.target.value })}
                    min={data.startDate}
                    className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                  />
                  {showValidation && endDateMissing && (
                    <p className="text-xs font-medium text-destructive">
                      Select an end date.
                    </p>
                  )}
                  {showValidation && invalidDateRange && (
                    <p className="text-xs font-medium text-destructive">
                      End date must be the same as or after start date.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : isTemplateStory ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
                <p className="text-sm font-semibold text-violet-900">Story framing</p>
                <p className="mt-1 text-sm text-violet-800">
                  Start with a clear campaign context before selecting your template.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className={easyMode ? "text-base font-semibold" : ""}>
                  {modeMeta.nameLabel}
                </Label>
                <Input
                  id="name"
                  placeholder={modeMeta.namePlaceholder}
                  value={data.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                />
                {showValidation && nameMissing && (
                  <p className="text-xs font-medium text-destructive">
                    Enter a campaign name to continue.
                  </p>
                )}
                {showValidation && !nameMissing && nameTooShort && (
                  <p className="text-xs font-medium text-destructive">
                    Campaign name must be at least 10 characters.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className={easyMode ? "text-base font-semibold" : ""}>
                  {modeMeta.goalLabel}
                </Label>
                <Textarea
                  id="description"
                  placeholder={modeMeta.goalPlaceholder}
                  value={data.description}
                  onChange={(e) => onChange({ description: e.target.value })}
                  rows={3}
                  className={easyMode ? "text-base transition-colors hover:border-slate-400" : ""}
                />
                {showValidation && descriptionMissing && (
                  <p className="text-xs font-medium text-destructive">
                    Add a short campaign goal to continue.
                  </p>
                )}
                {showValidation && !descriptionMissing && descriptionTooShort && (
                  <p className="text-xs font-medium text-destructive">
                    Goal must be at least 10 characters.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company" className={easyMode ? "text-base font-semibold" : ""}>
                    1. Pick a Company *
                  </Label>
                  <Select
                    value={data.selectedCompanyId}
                    onValueChange={handleCompanyChange}
                    disabled={isEditing}
                  >
                    <SelectTrigger
                      id="company"
                      className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                    >
                      <SelectValue
                        placeholder={
                          isLoadingCompanies ? "Loading companies..." : "Select a company"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showValidation && companyMissing && (
                    <p className="text-xs font-medium text-destructive">
                      Select a company to continue.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate" className={easyMode ? "text-base font-semibold" : ""}>
                    4. Start Date *
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={data.startDate}
                    onChange={(e) => onChange({ startDate: e.target.value })}
                    disabled={lockStartDate}
                    className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                  />
                  {showValidation && startDateMissing && (
                    <p className="text-xs font-medium text-destructive">
                      Select a start date.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className={easyMode ? "text-base font-semibold" : ""}>
                  5. End Date *
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={data.endDate}
                  onChange={(e) => onChange({ endDate: e.target.value })}
                  min={data.startDate}
                  className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                />
                {showValidation && endDateMissing && (
                  <p className="text-xs font-medium text-destructive">
                    Select an end date.
                  </p>
                )}
                {showValidation && invalidDateRange && (
                  <p className="text-xs font-medium text-destructive">
                    End date must be the same as or after start date.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="company" className={easyMode ? "text-base font-semibold" : ""}>
                  1. Pick a Company *
                </Label>
                <Select
                  value={data.selectedCompanyId}
                  onValueChange={handleCompanyChange}
                  disabled={isEditing}
                >
                  <SelectTrigger
                    id="company"
                    className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                  >
                    <SelectValue
                      placeholder={
                        isLoadingCompanies ? "Loading companies..." : "Select a company"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showValidation && companyMissing && (
                  <p className="text-xs font-medium text-destructive">
                    Select a company to continue.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className={easyMode ? "text-base font-semibold" : ""}>
                  {modeMeta.nameLabel}
                </Label>
                <Input
                  id="name"
                  placeholder={modeMeta.namePlaceholder}
                  value={data.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                />
                {showValidation && nameMissing && (
                  <p className="text-xs font-medium text-destructive">
                    Enter a campaign name to continue.
                  </p>
                )}
                {showValidation && !nameMissing && nameTooShort && (
                  <p className="text-xs font-medium text-destructive">
                    Campaign name must be at least 10 characters.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className={easyMode ? "text-base font-semibold" : ""}>
                  {modeMeta.goalLabel}
                </Label>
                <Textarea
                  id="description"
                  placeholder={modeMeta.goalPlaceholder}
                  value={data.description}
                  onChange={(e) => onChange({ description: e.target.value })}
                  rows={3}
                  className={easyMode ? "text-base transition-colors hover:border-slate-400" : ""}
                />
                {showValidation && descriptionMissing && (
                  <p className="text-xs font-medium text-destructive">
                    Add a short campaign goal to continue.
                  </p>
                )}
                {showValidation && !descriptionMissing && descriptionTooShort && (
                  <p className="text-xs font-medium text-destructive">
                    Goal must be at least 10 characters.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className={easyMode ? "text-base font-semibold" : ""}>
                    {isConversationBuilder ? "4. Conversation Start Date *" : "4. Start Date *"}
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={data.startDate}
                    onChange={(e) => onChange({ startDate: e.target.value })}
                    disabled={lockStartDate}
                    className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                  />
                  {showValidation && startDateMissing && (
                    <p className="text-xs font-medium text-destructive">
                      Select a start date.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className={easyMode ? "text-base font-semibold" : ""}>
                    {isConversationBuilder ? "5. Conversation End Date *" : "5. End Date *"}
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={data.endDate}
                    onChange={(e) => onChange({ endDate: e.target.value })}
                    min={data.startDate}
                    className={easyMode ? "h-11 text-base transition-colors hover:border-slate-400" : ""}
                  />
                  {showValidation && endDateMissing && (
                    <p className="text-xs font-medium text-destructive">
                      Select an end date.
                    </p>
                  )}
                  {showValidation && invalidDateRange && (
                    <p className="text-xs font-medium text-destructive">
                      End date must be the same as or after start date.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
