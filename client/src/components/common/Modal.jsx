import { X } from "lucide-react";
import Button from "./Button.jsx";

const Modal = ({
  open,
  title,
  description,
  children,
  footer,
  onClose
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-md border border-border bg-surface shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-heading">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>
          <Button
            aria-label="Close modal"
            className="h-8 w-8 p-0"
            onClick={onClose}
            size="sm"
            variant="secondary"
          >
            <X size={15} />
          </Button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Modal;
