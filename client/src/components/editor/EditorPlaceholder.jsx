import { SquarePen } from "lucide-react";

const EditorPlaceholder = ({ document = "" }) => {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-canvas">
      <div className="flex h-10 items-center border-b border-border bg-surface px-4">
        <span className="font-mono text-xs text-muted">main.js</span>
      </div>
      <div className="grid flex-1 place-items-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-accent/30 bg-elevated text-accent shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
            <SquarePen size={22} strokeWidth={1.8} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-heading">
            Shared document workspace
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Current document length: <span className="font-mono text-body">{document.length}</span>
          </p>
        </div>
      </div>
    </section>
  );
};

export default EditorPlaceholder;
