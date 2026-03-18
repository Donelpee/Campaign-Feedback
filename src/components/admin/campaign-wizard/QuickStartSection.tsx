import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WandSparkles } from "lucide-react";

interface QuickStartSectionProps {
  onAddStarterQuestions: () => void;
  canAddStarterQuestions: boolean;
}

export function QuickStartSection({
  onAddStarterQuestions,
  canAddStarterQuestions,
}: QuickStartSectionProps) {
  return (
    <Card className="cw-soft-panel border-sky-200/80 bg-sky-50/60">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <div>
          <p className="text-base font-semibold text-slate-900">Quick Start helper</p>
          <p className="mt-1 text-sm text-slate-600">
            Add 3 starter questions, then edit to match your campaign.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 text-base"
          onClick={onAddStarterQuestions}
          disabled={!canAddStarterQuestions}
        >
          <WandSparkles className="mr-2 h-4 w-4" />
          Add 3 starter questions
        </Button>
      </CardContent>
    </Card>
  );
}
