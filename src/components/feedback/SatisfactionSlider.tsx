import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface SatisfactionSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  description?: string;
}

export function SatisfactionSlider({
  value,
  onChange,
  min = 1,
  max = 10,
  label,
  description,
}: SatisfactionSliderProps) {
  const getColorClass = (val: number) => {
    const percentage = (val - min) / (max - min);
    if (percentage <= 0.3) return 'text-destructive';
    if (percentage <= 0.6) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">{label}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <span className={cn('text-3xl font-bold', getColorClass(value))}>
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([val]) => onChange(val)}
        min={min}
        max={max}
        step={1}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Very Dissatisfied</span>
        <span>Very Satisfied</span>
      </div>
    </div>
  );
}
