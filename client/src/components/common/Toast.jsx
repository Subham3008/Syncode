import { AlertCircle, CheckCircle2, X } from "lucide-react";

const toneStyles = {
  success: {
    icon: CheckCircle2,
    className: "border-success/40 bg-success/10 text-[#7ee787]"
  },
  error: {
    icon: AlertCircle,
    className: "border-danger/40 bg-danger/10 text-[#ffb4ad]"
  }
};

const Toast = ({ message, tone = "success", onClose }) => {
  if (!message) {
    return null;
  }

  const toneConfig = toneStyles[tone] ?? toneStyles.success;
  const Icon = toneConfig.icon;

  return (
    <div
      className={`fixed right-4 top-20 z-50 flex w-[calc(100vw-2rem)] max-w-[360px] items-start gap-3 rounded-md border px-3.5 py-3 text-sm leading-5 shadow-2xl shadow-black/40 backdrop-blur md:right-5 ${toneConfig.className}`}
      role="status"
    >
      <Icon className="mt-0.5 shrink-0" size={18} />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      <button
        aria-label="Dismiss notification"
        className="-mr-1 rounded p-1 text-current opacity-70 transition hover:bg-white/10 hover:opacity-100"
        onClick={onClose}
        type="button"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
