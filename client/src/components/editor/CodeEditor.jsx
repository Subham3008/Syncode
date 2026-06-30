import { useMemo, useState } from "react";
import { FileCode2, RefreshCw } from "lucide-react";
import { useDocumentSync } from "../../hooks/useDocumentSync.js";
import EditorStatusBar from "./EditorStatusBar.jsx";
import LineNumbers from "./LineNumbers.jsx";
import LineOwnership from "./LineOwnership.jsx";

const getLineCount = (document) => {
  if (typeof document !== "string" || document.length === 0) {
    return 1;
  }

  return document.split("\n").length;
};

const CodeEditor = ({
  initialDocument = "",
  initialVersion = 0,
  roomCode,
  userId,
  username
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const {
    document,
    editorError,
    handleLocalChange,
    isSaving,
    isSynced,
    lineOwnership,
    requestEditorState,
    version
  } = useDocumentSync({
    roomCode,
    userId,
    username,
    initialDocument,
    initialVersion
  });
  const lineCount = useMemo(() => getLineCount(document), [document]);
  const canEdit = Boolean(roomCode && userId);

  const handleChange = (event) => {
    handleLocalChange(event.target.value, event.target.selectionStart);
  };

  const handleScroll = (event) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <section className="flex min-h-[420px] flex-1 flex-col overflow-hidden bg-canvas">
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="shrink-0 text-accent" size={18} />
          <div className="min-w-0">
            <h2 className="truncate font-mono text-sm font-semibold text-heading">main.js</h2>
            <p className="truncate text-xs text-muted">Live document</p>
          </div>
        </div>

        <button
          aria-label="Refresh editor state"
          className="grid h-8 w-8 shrink-0 place-items-center rounded border border-border bg-elevated text-muted transition hover:border-accent hover:text-accent"
          onClick={requestEditorState}
          title="Refresh editor state"
          type="button"
        >
          <RefreshCw size={15} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LineNumbers lineCount={lineCount} scrollTop={scrollTop} />
        <LineOwnership
          lineCount={lineCount}
          lineOwnership={lineOwnership}
          scrollTop={scrollTop}
        />

        <div className="relative min-w-0 flex-1 bg-[#0b1017]">
          <textarea
            aria-label="Collaborative code editor"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="h-full w-full resize-none overflow-auto border-0 bg-transparent px-4 py-4 font-mono text-sm leading-6 text-heading caret-accent outline-none selection:bg-accent/30 placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canEdit}
            onChange={handleChange}
            onScroll={handleScroll}
            placeholder="Start typing..."
            spellCheck={false}
            value={document}
          />
        </div>
      </div>

      <EditorStatusBar
        characterCount={document.length}
        editorError={editorError}
        isSaving={isSaving}
        isSynced={isSynced}
        lineCount={lineCount}
        version={version}
      />
    </section>
  );
};

export default CodeEditor;
