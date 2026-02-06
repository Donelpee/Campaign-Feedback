import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, MessageSquare, CheckCircle } from 'lucide-react';
import type { WizardData } from './CampaignWizard';

interface StepReviewProps {
  data: WizardData;
}

const campaignTypeLabels: Record<string, string> = {
  feedback: 'Customer Feedback',
  employee_survey: 'Employee Survey',
  product_research: 'Product Research',
  event_evaluation: 'Event Evaluation',
};

const questionTypeLabels: Record<string, string> = {
  rating: 'Star Rating',
  scale: 'Scale',
  multiple_choice: 'Multiple Choice',
  text: 'Free Text',
  nps: 'NPS Score',
};

export function StepReview({ data }: StepReviewProps) {
  const requiredCount = data.questions.filter((q) => q.required).length;

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
              <p className="text-xs text-muted-foreground mb-1">Campaign Name</p>
              <p className="font-medium">{data.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <Badge variant="secondary">
                {campaignTypeLabels[data.campaignType]}
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
            Questions ({data.questions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm mb-3">
            <span className="text-muted-foreground">{requiredCount} required, </span>
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
