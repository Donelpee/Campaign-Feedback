import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ModeCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  selected?: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
  onSelect: () => void;
}

export function ModeCard({
  title,
  subtitle,
  icon: Icon,
  selected = false,
  disabled = false,
  comingSoon = false,
  onSelect,
}: ModeCardProps) {
  return (
    <Card
      className={cn(
        "cw-soft-panel cw-soft-panel-hover min-h-[220px]",
        selected && "border-primary/60 ring-2 ring-primary/20",
        disabled && "opacity-70",
      )}
    >
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          {comingSoon && <Badge variant="secondary">Coming soon</Badge>}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-slate-600">{subtitle}</p>
        <Button
          className="h-11 w-full text-base"
          variant={selected ? "default" : "outline"}
          disabled={disabled}
          onClick={onSelect}
        >
          {disabled ? "Not available yet" : selected ? "Selected" : "Choose mode"}
        </Button>
      </CardContent>
    </Card>
  );
}
