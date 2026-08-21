import * as React from "react";
import { cn } from "../../lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5 text-sm leading-6 text-[var(--ink)] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/15 disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
