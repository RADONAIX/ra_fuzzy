import { Info } from "lucide-react";

/**
 * Small "ⓘ" info icon that reveals a short, wrapping description on hover or
 * keyboard focus. Used beside headers and filter labels to explain them.
 * Hover/focus-visible only (a mouse click never pins it).
 */
export function InfoHint({
  text,
  side = "bottom",
  align = "left",
  iconClassName = "h-3.5 w-3.5",
  className = "",
}: {
  text: string;
  side?: "bottom" | "top";
  align?: "left" | "right";
  iconClassName?: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex group align-middle ${className}`}>
      <button
        type="button"
        aria-label={text}
        className="text-muted-foreground/50 hover:text-muted-foreground focus:outline-none focus-visible:text-muted-foreground transition-colors"
      >
        <Info className={iconClassName} />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${
          align === "right" ? "right-0" : "left-0"
        } w-72 max-w-[80vw] whitespace-normal text-left normal-case tracking-normal rounded-md bg-foreground text-background text-[11px] font-normal leading-snug px-2.5 py-1.5 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-has-[:focus-visible]:opacity-100 group-has-[:focus-visible]:scale-100 transition-all duration-150 delay-150 shadow-lg z-[60]`}
      >
        {text}
      </span>
    </span>
  );
}
