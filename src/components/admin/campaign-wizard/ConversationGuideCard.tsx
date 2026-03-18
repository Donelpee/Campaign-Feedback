import { MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GuideItem {
  label: string;
  done: boolean;
}

interface ConversationGuideCardProps {
  stage: string;
  prompt: string;
  checklist?: GuideItem[];
  hint?: string;
  className?: string;
}

export function ConversationGuideCard({
  stage,
  prompt,
  checklist = [],
  hint,
  className,
}: ConversationGuideCardProps) {
  return (
    <Card
      className={cn(
        "cw-fade-rise border-blue-200 bg-gradient-to-r from-sky-50 via-cyan-50 to-emerald-50",
        className,
      )}
    >
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge variant="secondary" className="bg-white/90">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              {stage}
            </Badge>
            <div className="cw-slide-in rounded-2xl rounded-tl-sm bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[15px] leading-relaxed text-slate-800">{prompt}</p>
            </div>
          </div>
          <div className="cw-pop-in inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
            <MessageCircle className="h-5 w-5" />
          </div>
        </div>

        {checklist.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "cw-fade-rise rounded-lg border px-3 py-2 text-sm",
                  item.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white/80 text-slate-600",
                )}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                {item.done ? "Done:" : "Next:"} {item.label}
              </div>
            ))}
          </div>
        )}

        {hint && <p className="text-sm text-slate-600">{hint}</p>}
      </CardContent>
    </Card>
  );
}
