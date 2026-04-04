import { cn } from "@/lib/utils";

interface LikertScaleProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

const options = [
  { value: 1, label: "Very Unlikely" },
  { value: 2, label: "Unlikely" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Likely" },
  { value: 5, label: "Very Likely" },
];

export function LikertScale({
  value,
  onChange,
  label,
  description,
  disabled = false,
}: LikertScaleProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-foreground">{label}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              disabled && "cursor-not-allowed opacity-80",
              value === option.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-muted-foreground/50 hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                value === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {option.value}
            </span>
            <span className="text-xs text-center leading-tight">
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
