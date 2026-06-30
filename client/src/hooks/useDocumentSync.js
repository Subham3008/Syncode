import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOCKET_EVENTS } from "../constants/socketEvents.js";
import { socket } from "../socket/socket.js";
import { useEditorDelta } from "./useEditorDelta.js";

const normalizeRoomCode = (roomCode) => {
  if (typeof roomCode !== "string") {
    return "";
  }

  return roomCode.trim().toUpperCase();
};

const normalizeVersion = (version) => {
  const numericVersion = Number(version);

  return Number.isInteger(numericVersion) && numericVersion >= 0 ? numericVersion : 0;
};

const normalizeDocument = (document) =>
  typeof document === "string" ? document : "";

const normalizeLineOwnership = (lineOwnership) => {
  if (!lineOwnership || typeof lineOwnership !== "object" || Array.isArray(lineOwnership)) {
    return {};
  }

  return { ...lineOwnership };
};

export const useDocumentSync = ({
  roomCode,
  userId,
  username,
  initialDocument = "",
  initialVersion = 0
} = {}) => {
  const normalizedRoomCode = useMemo(() => normalizeRoomCode(roomCode), [roomCode]);
  const [document, setDocument] = useState(() => normalizeDocument(initialDocument));
  const [version, setVersion] = useState(() => normalizeVersion(initialVersion));
  const [isSynced, setIsSynced] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [lineOwnership, setLineOwnership] = useState({});
  const versionRef = useRef(version);
  const connectionRef = useRef({
    roomCode: normalizedRoomCode,
    userId,
    username
  });

  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  useEffect(() => {
    connectionRef.current = {
      roomCode: normalizedRoomCode,
      userId,
      username
    };
  }, [normalizedRoomCode, userId, username]);

  useEffect(() => {
    setDocument(normalizeDocument(initialDocument));
    setVersion(normalizeVersion(initialVersion));
    setLineOwnership({});
    setIsSynced(true);
    setIsSaving(false);
    setEditorError("");
  }, [initialDocument, initialVersion, normalizedRoomCode]);

  const handleDeltaError = useCallback((message) => {
    setEditorError(message || "Editor sync failed");
    setIsSaving(false);
    setIsSynced(false);
  }, []);

  const {
    replaceDocument,
    applyLocalChange,
    applyRemoteChange
  } = useEditorDelta({
    document,
    onDocumentChange: setDocument,
    onError: handleDeltaError
  });

  const requestEditorState = useCallback(() => {
    if (!connectionRef.current.roomCode) {
      return;
    }

    socket.emit(SOCKET_EVENTS.EDITOR_GET_STATE, {
      roomCode: connectionRef.current.roomCode
    });
  }, []);

  const applyEditorState = useCallback(
    (payload = {}) => {
      replaceDocument(payload.document);
      const nextVersion = normalizeVersion(payload.version);
      versionRef.current = nextVersion;
      setVersion(nextVersion);
      setLineOwnership(normalizeLineOwnership(payload.lineOwnership));
      setEditorError("");
      setIsSaving(false);
      setIsSynced(true);
    },
    [replaceDocument]
  );

  const handleRemoteDelta = useCallback(
    (payload = {}) => {
      const nextDocument = applyRemoteChange(payload);

      if (!nextDocument) {
        return;
      }

      const nextVersion = normalizeVersion(payload.version);

      if (nextVersion >= versionRef.current) {
        versionRef.current = nextVersion;
        setVersion(nextVersion);
      }

      setLineOwnership(normalizeLineOwnership(payload.lineOwnership));
      setEditorError("");
      setIsSynced(true);
    },
    [applyRemoteChange]
  );

  const handleEditorSync = useCallback(
    (payload = {}) => {
      const nextVersion = normalizeVersion(payload.version);

      versionRef.current = nextVersion;
      setVersion(nextVersion);
      setLineOwnership(normalizeLineOwnership(payload.lineOwnership));
      setEditorError("");
      setIsSaving(false);
      setIsSynced(true);

      if (payload.conflictResolved) {
        requestEditorState();
      }
    },
    [requestEditorState]
  );

  const handleLocalChange = useCallback(
    (nextText, cursorPosition = null) => {
      const { roomCode: currentRoomCode, userId: currentUserId, username: currentUsername } =
        connectionRef.current;

      if (!currentRoomCode || !currentUserId) {
        handleDeltaError("Room session is not ready for editor sync");
        return null;
      }

      const change = applyLocalChange(nextText, cursorPosition);

      if (!change) {
        return null;
      }

      const payload = {
        roomCode: currentRoomCode,
        userId: currentUserId,
        username: currentUsername,
        baseVersion: versionRef.current,
        delta: change.delta
      };

      setIsSaving(true);
      setIsSynced(false);
      setEditorError("");
      socket.emit(SOCKET_EVENTS.EDITOR_DELTA, payload);

      return payload;
    },
    [applyLocalChange, handleDeltaError]
  );

  useEffect(() => {
    const handleEditorState = (payload) => applyEditorState(payload);
    const handleEditorDeltaApplied = (payload) => handleRemoteDelta(payload);
    const handleEditorError = (payload = {}) => {
      handleDeltaError(payload.message || "Editor sync failed");
      requestEditorState();
    };

    socket.on(SOCKET_EVENTS.EDITOR_STATE, handleEditorState);
    socket.on(SOCKET_EVENTS.EDITOR_SYNC, handleEditorSync);
    socket.on(SOCKET_EVENTS.EDITOR_DELTA_APPLIED, handleEditorDeltaApplied);
    socket.on(SOCKET_EVENTS.EDITOR_ERROR, handleEditorError);

    requestEditorState();

    return () => {
      socket.off(SOCKET_EVENTS.EDITOR_STATE, handleEditorState);
      socket.off(SOCKET_EVENTS.EDITOR_SYNC, handleEditorSync);
      socket.off(SOCKET_EVENTS.EDITOR_DELTA_APPLIED, handleEditorDeltaApplied);
      socket.off(SOCKET_EVENTS.EDITOR_ERROR, handleEditorError);
    };
  }, [
    applyEditorState,
    handleDeltaError,
    handleEditorSync,
    handleRemoteDelta,
    requestEditorState
  ]);

  return {
    document,
    version,
    isSynced,
    isSaving,
    editorError,
    lineOwnership,
    requestEditorState,
    handleLocalChange,
    handleRemoteDelta
  };
};
