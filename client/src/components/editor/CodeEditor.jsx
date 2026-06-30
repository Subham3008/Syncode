import { useEffect, useMemo, useRef, useState } from "react";
import { FileCode2, RefreshCw, UsersRound } from "lucide-react";
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
const TYPING_RENEW_INTERVAL_MS = 700;

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
  const typingRenewedAtRef = useRef(0);
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
    syncMessage,
    syncStatus,
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

    socket.emit(SOCKET_EVENTS.PRESENCE_STOP_TYPING, { roomCode });
    isTypingRef.current = false;
    typingRenewedAtRef.current = 0;
  };

  const scheduleTypingStop = () => {
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      emitTypingStop();
    }, TYPING_STOP_DELAY_MS);
  };

  const emitTypingStart = (cursorPosition = null) => {
    if (!canEdit || !roomCode) {
      return;
    }

    const now = Date.now();

    if (
      !isTypingRef.current
      || now - typingRenewedAtRef.current >= TYPING_RENEW_INTERVAL_MS
    ) {
      socket.emit(SOCKET_EVENTS.PRESENCE_TYPING, {
        roomCode,
        cursorPosition
      });
      isTypingRef.current = true;
      typingRenewedAtRef.current = now;
    }

    scheduleTypingStop();
  };

  const handleChange = (event) => {
    emitTypingStart(event.target.selectionStart);
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
    <section className="flex min-h-[420px] flex-1 flex-col overflow-hidden bg-[#0b1017]">
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-border bg-[#111820] px-3">
        <div className="flex h-full min-w-0 items-center gap-2 border-r border-border bg-[#0b1017] px-3">
          <FileCode2 className="shrink-0 text-accent" size={16} />
          <h2 className="truncate font-mono text-sm font-semibold text-heading">main.js</h2>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          {ownershipSummary.length ? (
            <div className="hidden min-w-0 items-center gap-2 rounded border border-border bg-[#0b1017] px-2 py-1 md:flex">
              <UsersRound size={14} className="text-muted" />
              {ownershipSummary.map((owner) => (
                <span
                  className="-ml-1 grid h-6 w-6 place-items-center rounded-full border border-[#111820] text-[10px] font-semibold text-white first:ml-0"
                  key={owner.userId}
                  title={`${owner.username} edited lines`}
                  style={owner.color ? { backgroundColor: owner.color } : undefined}
                >
                  {owner.username?.charAt(0)?.toUpperCase() || "U"}
                </span>
              ))}
            </div>
          ) : null}

          <button
            aria-label="Refresh editor state"
            className="grid h-8 w-8 shrink-0 place-items-center rounded border border-border bg-[#0b1017] text-muted transition hover:border-accent hover:text-accent"
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

        <div className="relative min-w-0 flex-1 bg-[#080d13]">
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
        syncMessage={syncMessage}
        syncStatus={syncStatus}
        version={version}
      />
    </section>
  );
};

export default CodeEditor;
