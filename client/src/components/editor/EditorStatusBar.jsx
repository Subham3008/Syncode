import { memo } from "react";
import { AlertTriangle, CheckCircle2, Cloud, Loader2, WifiOff } from "lucide-react";

const getStatus = ({ editorError, isSaving, isSynced, syncStatus }) => {
  if (syncStatus === "failed" || editorError) {
    return {
      icon: AlertTriangle,
      label: "Sync failed",
      className: "text-danger"
    };
  }

  if (syncStatus === "reconnecting") {
    return {
      icon: WifiOff,
      label: "Reconnecting",
      className: "text-warning"
    };
  }

  if (syncStatus === "offline") {
    return {
      icon: WifiOff,
      label: "Offline",
      className: "text-danger"
    };
  }

  if (syncStatus === "interrupted") {
    return {
      icon: AlertTriangle,
      label: "Sync interrupted",
      className: "text-warning"
    };
  }

  if (syncStatus === "saving" || isSaving) {
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
  syncMessage = "",
  syncStatus = "synced",
  version = 0
}) => {
  const status = getStatus({ editorError, isSaving, isSynced, syncStatus });
  const StatusIcon = status.icon;
  const statusDetail = editorError || syncMessage;
  const isSpinning = syncStatus === "saving" || (isSaving && syncStatus !== "interrupted");

  return (
    <footer className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t border-border bg-[#111820] px-4 py-1.5 text-xs text-muted">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 font-medium ${status.className}`}>
          <StatusIcon className={isSpinning ? "animate-spin" : ""} size={14} />
          {status.label}
        </span>
        <span className="font-mono">v{version}</span>
        <span>{lineCount} lines</span>
        <span>{characterCount} chars</span>
      </div>

      {statusDetail ? (
        <p className={`min-w-0 max-w-full truncate md:max-w-[50%] ${status.className}`}>
          {statusDetail}
        </p>
      ) : null}
    </footer>
  );
};

export default memo(EditorStatusBar);
