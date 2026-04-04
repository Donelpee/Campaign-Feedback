import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function StarRating({
  value,
  onChange,
  max = 5,
  label,
  description,
  disabled = false,
}: StarRatingProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-foreground">{label}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            disabled={disabled}
            className={cn(
              "p-1 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded",
              disabled && "cursor-not-allowed opacity-70 hover:scale-100",
              star <= value
                ? "text-warning"
                : "text-muted-foreground/30 hover:text-muted-foreground/50",
            )}
            aria-label={`Rate ${star} out of ${max} stars`}
          >
            <Star
              className={cn(
                "h-8 w-8 transition-all",
                star <= value ? "fill-current" : "",
              )}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Poor</span>
        <span>Excellent</span>
      </div>
    </div>
  );
}
