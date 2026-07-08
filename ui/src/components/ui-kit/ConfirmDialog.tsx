import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { Tooltip } from "@/components/ui-kit/Tooltip";

export type ConfirmTone = "primary" | "success" | "danger";

const TONE: Record<ConfirmTone, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onCancel,
  onConfirm,
  icon,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onCancel: () => void;
  onConfirm: () => void;
  icon?: ReactNode;
}) {
  const t = useT();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div
                className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
                  tone === "danger" ? "bg-destructive/10 text-destructive" : tone === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                }`}
              >
                {icon}
              </div>
            )}
            <h3 className="font-semibold text-foreground truncate">{title}</h3>
          </div>
          <Tooltip label={t("Close this dialog")} side="bottom">
            <button
              onClick={onCancel}
              aria-label={t("Close")}
              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
        <div className="px-5 py-4 text-sm text-muted-foreground leading-relaxed">{message}</div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Tooltip label={t("Cancel and close")} side="bottom">
            <button
              onClick={onCancel}
              className="h-9 px-4 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
            >
              {t(cancelLabel)}
            </button>
          </Tooltip>
          <Tooltip label={t("Confirm this action")} side="bottom">
            <button
              onClick={onConfirm}
              className={`h-9 px-4 rounded-lg text-sm font-medium ${TONE[tone]}`}
            >
              {t(confirmLabel)}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
