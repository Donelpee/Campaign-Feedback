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
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/lib/supabase-types";
import type { WizardData } from "./CampaignWizard";

interface StepBasicInfoProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  isEditing?: boolean;
  lockStartDate?: boolean;
}

export function StepBasicInfo({
  data,
  onChange,
  isEditing = false,
  lockStartDate = false,
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="company">Company *</Label>
        <Select
          value={data.selectedCompanyId}
          onValueChange={handleCompanyChange}
          disabled={isEditing}
        >
          <SelectTrigger id="company">
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
      </div>
      {isEditing && (
        <p className="text-xs text-muted-foreground -mt-3">
          Company cannot be changed while editing an existing campaign.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Campaign Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Q1 2026 Customer Satisfaction Survey"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          A descriptive name to identify this campaign
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="Briefly describe the purpose and goals of this campaign..."
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          This description is required and will be shown with the campaign.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date *</Label>
          <Input
            id="startDate"
            type="date"
            value={data.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            disabled={lockStartDate}
          />
          {lockStartDate && (
            <p className="text-xs text-muted-foreground">
              Start date is locked because this campaign already has responses.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date *</Label>
          <Input
            id="endDate"
            type="date"
            value={data.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
            min={data.startDate}
          />
        </div>
      </div>
    </div>
  );
}
