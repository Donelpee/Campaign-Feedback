import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MessageSquare, Users, Package, CalendarCheck } from 'lucide-react';
import type { CampaignType } from '@/lib/supabase-types';

interface StepCampaignTypeProps {
  campaignType: CampaignType;
  onChange: (type: CampaignType) => void;
}

const campaignTypes: {
  type: CampaignType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: 'feedback',
    title: 'Customer Feedback',
    description: 'NPS, satisfaction ratings, and service quality surveys for clients',
    icon: MessageSquare,
  },
  {
    type: 'employee_survey',
    title: 'Employee Survey',
    description: 'Internal staff engagement, satisfaction, and feedback collection',
    icon: Users,
  },
  {
    type: 'product_research',
    title: 'Product Research',
    description: 'Market research, product feedback, and feature prioritization',
    icon: Package,
  },
  {
    type: 'event_evaluation',
    title: 'Event Evaluation',
    description: 'Post-event feedback, session ratings, and attendee satisfaction',
    icon: CalendarCheck,
  },
];

export function StepCampaignType({ campaignType, onChange }: StepCampaignTypeProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the type of campaign you want to create. This will help us suggest relevant questions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaignTypes.map(({ type, title, description, icon: Icon }) => (
          <Card
            key={type}
            className={cn(
              'cursor-pointer transition-all hover:border-primary/50',
              campaignType === type && 'border-primary ring-2 ring-primary/20'
            )}
            onClick={() => onChange(type)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  campaignType === type ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
