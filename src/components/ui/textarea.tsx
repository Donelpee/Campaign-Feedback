// Accessible Textarea component
import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-offset-background placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      aria-invalid={props["aria-invalid"] ?? false}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
