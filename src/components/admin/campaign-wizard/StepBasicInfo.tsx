import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WizardData } from './CampaignWizard';

interface StepBasicInfoProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
}

export function StepBasicInfo({ data, onChange }: StepBasicInfoProps) {
  return (
    <div className="space-y-6">
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
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Briefly describe the purpose and goals of this campaign..."
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date *</Label>
          <Input
            id="startDate"
            type="date"
            value={data.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
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
