import type { ReactNode } from "react";

type Side = "top" | "bottom" | "left" | "right";

const POSITION: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

/**
 * Lightweight CSS-only tooltip. Wrap any element (typically an icon-only
 * button) to surface a short label on hover.
 */
export function Tooltip({
  label,
  children,
  side = "bottom",
  className = "",
}: {
  label: string;
  children: ReactNode;
  side?: Side;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex group ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${POSITION[side]} whitespace-nowrap rounded-md bg-foreground text-background text-[11px] font-medium px-2 py-1 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-has-[:focus-visible]:opacity-100 group-has-[:focus-visible]:scale-100 transition-all duration-150 delay-150 shadow-lg z-[60]`}
      >
        {label}
      </span>
    </span>
  );
}
