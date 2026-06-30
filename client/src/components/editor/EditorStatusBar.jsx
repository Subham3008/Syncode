import { memo } from "react";
import { AlertTriangle, CheckCircle2, Cloud, Loader2 } from "lucide-react";

const getStatus = ({ isSaving, isSynced, editorError }) => {
  if (editorError) {
    return {
      icon: AlertTriangle,
      label: "Sync issue",
      className: "text-danger"
    };
  }

  if (isSaving) {
    return {
      icon: Loader2,
      label: "Saving",
      className: "text-warning"
    };
  }

  if (isSynced) {
    return {
      icon: CheckCircle2,
      label: "Synced",
      className: "text-success"
    };
  }

  return {
    icon: Cloud,
    label: "Pending",
    className: "text-accent"
  };
};

const EditorStatusBar = ({
  characterCount = 0,
  editorError = "",
  isSaving = false,
  isSynced = true,
  lineCount = 1,
  version = 0
}) => {
  const status = getStatus({ isSaving, isSynced, editorError });
  const StatusIcon = status.icon;

  return (
    <footer className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2 text-xs text-muted">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 font-medium ${status.className}`}>
          <StatusIcon className={isSaving ? "animate-spin" : ""} size={14} />
          {status.label}
        </span>
        <span className="font-mono">v{version}</span>
        <span>{lineCount} lines</span>
        <span>{characterCount} chars</span>
      </div>

      {editorError ? (
        <p className="min-w-0 max-w-full truncate text-danger md:max-w-[50%]">
          {editorError}
        </p>
      ) : null}
    </footer>
  );
};

export default memo(EditorStatusBar);
