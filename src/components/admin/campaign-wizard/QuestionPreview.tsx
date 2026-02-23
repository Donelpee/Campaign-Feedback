import { Fragment } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampaignQuestion } from "@/lib/supabase-types";

interface QuestionPreviewProps {
  question: CampaignQuestion;
  className?: string;
}

export function QuestionPreview({ question, className }: QuestionPreviewProps) {
  const sanitizeOptions = (values?: string[]) =>
    (values || [])
      .map((value) => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);

  if (question.type === "multiple_choice") {
    const options = sanitizeOptions(question.options).length
      ? sanitizeOptions(question.options)
      : ["Option 1", "Option 2"];
    return (
      <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
        {options.map((option) => (
          <div
            key={option}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            <Checkbox checked={false} />
            <span className="text-sm">{option}</span>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "single_choice") {
    const options = sanitizeOptions(question.options).length
      ? sanitizeOptions(question.options)
      : ["Option 1", "Option 2"];
    return (
      <RadioGroup
        className={className ? `space-y-2 ${className}` : "space-y-2"}
      >
        {options.map((option) => {
          const optionId = `preview-${question.id}-${option}`;
          return (
            <div
              key={option}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <RadioGroupItem value={option} id={optionId} />
              <Label htmlFor={optionId} className="text-sm font-normal">
                {option}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  if (question.type === "text") {
    return (
      <Input
        className={className}
        placeholder="Single-line text input"
        disabled
      />
    );
  }

  if (question.type === "label") {
    return (
      <p className={className ? `text-sm text-muted-foreground ${className}` : "text-sm text-muted-foreground"}>
        Informational label text
      </p>
    );
  }

  if (question.type === "textbox") {
    return (
      <Input
        className={className}
        placeholder="Single-line text input"
        disabled
      />
    );
  }

  if (question.type === "textarea") {
    return (
      <Textarea
        className={className}
        placeholder="Long-form text input"
        disabled
      />
    );
  }

  if (question.type === "combobox") {
    const options = sanitizeOptions(question.options).length
      ? sanitizeOptions(question.options)
      : ["Option 1", "Option 2"];
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Select one option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option, index) => (
            <SelectItem key={`${option}-${index}`} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (question.type === "date") {
    return <Input type="date" className={className} disabled />;
  }

  if (question.type === "file_upload") {
    return <Input type="file" className={className} disabled />;
  }

  if (question.type === "rank") {
    const options = question.options?.length
      ? question.options
      : ["Option 1", "Option 2", "Option 3"];
    return (
      <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
        {options.map((option, index) => (
          <div
            key={option}
            className="flex items-center justify-between rounded-md border p-2 text-sm"
          >
            <span>{option}</span>
            <span className="text-xs text-muted-foreground">Rank {index + 1}</span>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "checkbox_matrix" || question.type === "radio_matrix") {
    const rows = question.rows?.length ? question.rows : ["Row 1", "Row 2"];
    const columns = question.columns?.length
      ? question.columns
      : ["Option A", "Option B"];

    return (
      <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
        <div className="grid gap-2" style={{ gridTemplateColumns: `minmax(120px,1fr) repeat(${columns.length}, minmax(90px,1fr))` }}>
          <div />
          {columns.map((column) => (
            <div key={column} className="text-xs font-medium text-muted-foreground text-center">
              {column}
            </div>
          ))}
          {rows.map((row) => (
            <Fragment key={row}>
              <div key={`${row}-label`} className="text-sm">{row}</div>
              {columns.map((column) => (
                <div key={`${row}-${column}`} className="mx-auto">
                  {question.type === "checkbox_matrix" ? (
                    <Checkbox checked={false} />
                  ) : (
                    <span className="inline-flex h-4 w-4 rounded-full border border-muted-foreground/40" />
                  )}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "rating") {
    const stars = Math.max(1, Math.min(question.max ?? 5, 10));
    return (
      <div
        className={
          className
            ? `flex items-center gap-2 ${className}`
            : "flex items-center gap-2"
        }
      >
        {Array.from({ length: stars }, (_, index) => (
          <span key={index} className="text-xl text-muted-foreground">
            ★
          </span>
        ))}
      </div>
    );
  }

  const min = question.min ?? (question.type === "nps" ? 0 : 1);
  const max = question.max ?? 10;
  const values = Array.from(
    { length: Math.min(max - min + 1, 11) },
    (_, index) => min + index,
  );

  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs"
          >
            {value}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
