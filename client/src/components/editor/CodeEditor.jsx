import { useEffect, useMemo, useRef, useState } from "react";
import { FileCode2, RefreshCw } from "lucide-react";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import { useDocumentSync } from "../../hooks/useDocumentSync.js";
import { socket } from "../../socket/socket.js";
import ColoredDocumentOverlay from "./ColoredDocumentOverlay.jsx";
import EditorStatusBar from "./EditorStatusBar.jsx";
import LineNumbers from "./LineNumbers.jsx";
import LineOwnership from "./LineOwnership.jsx";

const getLineCount = (document) => {
  if (typeof document !== "string" || document.length === 0) {
    return 1;
  }

  return document.split("\n").length;
};

const getOwnershipSummary = (lineOwnership, charOwnership) => {
  const owners = new Map();

  if (Array.isArray(charOwnership)) {
    charOwnership.forEach((owner) => {
      if (!owner?.userId || owners.has(owner.userId)) {
        return;
      }

      owners.set(owner.userId, owner);
    });
  }

  const lineOwners =
    lineOwnership && typeof lineOwnership === "object" && !Array.isArray(lineOwnership)
      ? Object.values(lineOwnership)
      : [];

  lineOwners.forEach((owner) => {
    if (!owner?.userId || owners.has(owner.userId)) {
      return;
    }

    owners.set(owner.userId, owner);
  });

  return Array.from(owners.values()).slice(0, 4);
};

const TYPING_STOP_DELAY_MS = 1200;

const CodeEditor = ({
  initialDocument = "",
  initialVersion = 0,
  roomCode,
  userColor = "",
  userId,
  username
}) => {
  const [editorScroll, setEditorScroll] = useState({ left: 0, top: 0 });
  const typingStopTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const {
    charOwnership,
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
    userColor,
    userId,
    username,
    initialDocument,
    initialVersion
  });
  const lineCount = useMemo(() => getLineCount(document), [document]);
  const ownershipSummary = useMemo(
    () => getOwnershipSummary(lineOwnership, charOwnership),
    [charOwnership, lineOwnership]
  );
  const canEdit = Boolean(roomCode && userId);

  const emitTypingStop = () => {
    if (!roomCode || !isTypingRef.current) {
      return;
    }

    socket.emit(SOCKET_EVENTS.TYPING_STOP, { roomCode });
    isTypingRef.current = false;
  };

  const scheduleTypingStop = () => {
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      emitTypingStop();
    }, TYPING_STOP_DELAY_MS);
  };

  const emitTypingStart = () => {
    if (!canEdit || !roomCode) {
      return;
    }

    if (!isTypingRef.current) {
      socket.emit(SOCKET_EVENTS.TYPING_START, { roomCode });
      isTypingRef.current = true;
    }

    scheduleTypingStop();
  };

  const handleChange = (event) => {
    emitTypingStart();
    handleLocalChange(event.target.value, event.target.selectionStart);
  };

  const handleScroll = (event) => {
    setEditorScroll({
      left: event.currentTarget.scrollLeft,
      top: event.currentTarget.scrollTop
    });
  };

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }

      emitTypingStop();
    };
  }, [roomCode]);

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

        <div className="flex min-w-0 items-center gap-2">
          {ownershipSummary.length ? (
            <div className="hidden min-w-0 items-center gap-1.5 rounded border border-border bg-canvas/70 px-2 py-1 md:flex">
              {ownershipSummary.map((owner) => (
                <span
                  className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted"
                  key={owner.userId}
                  title={`${owner.username} edited lines`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent"
                    style={owner.color ? { backgroundColor: owner.color } : undefined}
                  />
                  <span className="max-w-20 truncate">{owner.username}</span>
                </span>
              ))}
            </div>
          ) : null}

          <button
            aria-label="Refresh editor state"
            className="grid h-8 w-8 shrink-0 place-items-center rounded border border-border bg-elevated text-muted transition hover:border-accent hover:text-accent"
            onClick={requestEditorState}
            title="Refresh editor state"
            type="button"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LineNumbers lineCount={lineCount} scrollTop={editorScroll.top} />
        <LineOwnership
          lineCount={lineCount}
          lineOwnership={lineOwnership}
          scrollTop={editorScroll.top}
        />

        <div className="relative min-w-0 flex-1 bg-[#0b1017]">
          <ColoredDocumentOverlay
            charOwnership={charOwnership}
            document={document}
            lineOwnership={lineOwnership}
            scrollLeft={editorScroll.left}
            scrollTop={editorScroll.top}
          />
          <textarea
            aria-label="Collaborative code editor"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="relative z-10 h-full w-full resize-none overflow-auto border-0 bg-transparent px-4 py-4 font-mono text-sm leading-6 text-transparent caret-accent outline-none selection:bg-accent/30 placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canEdit}
            onChange={handleChange}
            onBlur={emitTypingStop}
            onScroll={handleScroll}
            placeholder="Start typing..."
            spellCheck={false}
            value={document}
            wrap="off"
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
