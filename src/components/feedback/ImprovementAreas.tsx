import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface ImprovementAreasProps {
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  description?: string;
}

const areas = [
  { id: 'communication', label: 'Communication' },
  { id: 'response_time', label: 'Response Time' },
  { id: 'product_quality', label: 'Product Quality' },
  { id: 'customer_service', label: 'Customer Service' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'technical_support', label: 'Technical Support' },
  { id: 'delivery', label: 'Delivery / Fulfillment' },
  { id: 'documentation', label: 'Documentation' },
];

export function ImprovementAreas({
  value,
  onChange,
  label,
  description,
}: ImprovementAreasProps) {
  const handleToggle = (areaId: string) => {
    if (value.includes(areaId)) {
      onChange(value.filter((v) => v !== areaId));
    } else {
      onChange([...value, areaId]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-foreground">{label}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {areas.map((area) => (
          <label
            key={area.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
              value.includes(area.id)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50 hover:bg-muted'
            )}
          >
            <Checkbox
              checked={value.includes(area.id)}
              onCheckedChange={() => handleToggle(area.id)}
            />
            <span className="text-sm">{area.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
