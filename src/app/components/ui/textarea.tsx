import * as React from "react";

import { cn } from "./utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex field-sizing-content min-h-16 w-full rounded-xl border-[1.5px] border-slate-400 dark:border-slate-600 bg-white dark:bg-[#110F20] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-all outline-none hover:border-slate-600 dark:hover:border-slate-400 focus:border-cyan-500 focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/25 focus-visible:shadow-[0_0_14px_rgba(34,211,238,0.2)] disabled:cursor-not-allowed disabled:opacity-50 resize-none md:text-sm",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };