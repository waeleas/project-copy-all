import * as React from "react";

import { cn } from "@/lib/utils";

const ARABIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

function toEnglishDigits(s: string) {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const a = ARABIC.indexOf(d);
    if (a > -1) return String(a);
    const p = PERSIAN.indexOf(d);
    if (p > -1) return String(p);
    return d;
  });
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onChange={
          onChange
            ? (e) => {
                const v = toEnglishDigits(e.target.value);
                if (v !== e.target.value) e.target.value = v;
                onChange(e);
              }
            : undefined
        }
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
