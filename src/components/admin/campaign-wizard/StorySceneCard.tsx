import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SceneAction {
  label: string;
  onClick: () => void;
}

interface StorySceneCardProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  actions?: SceneAction[];
  className?: string;
}

export function StorySceneCard({
  title,
  description,
  imageSrc,
  imageAlt,
  actions = [],
  className,
}: StorySceneCardProps) {
  return (
    <Card
      className={cn(
        "cw-soft-panel cw-soft-panel-hover relative overflow-hidden border-cyan-100/80 bg-gradient-to-r from-slate-50 via-blue-50/70 to-teal-50/70",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-sky-100/70 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-emerald-100/60 blur-2xl" />
      <CardContent className="relative z-10 pt-5">
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-700">{description}</p>
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {actions.map((action, index) => (
                  <Button
                    key={action.label}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="cw-soft-pulse border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    style={{ animationDelay: `${index * 120}ms` }}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="cw-gentle-bob rounded-2xl border border-slate-200/80 bg-white/85 p-2 shadow-sm">
              <img
                src={imageSrc}
                alt={imageAlt}
                className="h-32 w-40 object-contain md:h-36 md:w-44"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
