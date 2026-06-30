import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOCKET_EVENTS } from "../constants/socketEvents.js";
import { socket } from "../socket/socket.js";
import { useEditorDelta } from "./useEditorDelta.js";
import {
  applyRemoteDelta,
  createDeltaFromTextChange
} from "../utils/delta.utils.js";

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

const normalizeCharOwnership = (charOwnership) => {
  if (!Array.isArray(charOwnership)) {
    return [];
  }

  return charOwnership;
};

const EDITOR_ACK_TIMEOUT_MS = 8000;
const EDITOR_FLUSH_DELAY_MS = 35;

const createClientMutationId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `mutation_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const getDeltaOwner = ({ userColor = "", userId = "", username = "" } = {}) => ({
  color: userColor,
  userId,
  username
});

const applyDeltaToOwnership = ({
  charOwnership = [],
  delta,
  lineOwnership = {},
  owner
}) => {
  if (!delta || !owner?.userId || !owner?.username) {
    return {
      charOwnership: normalizeCharOwnership(charOwnership).slice(),
      lineOwnership: normalizeLineOwnership(lineOwnership)
    };
  }

  const insertedLength = typeof delta.text === "string" ? delta.text.length : 0;
  const startPosition = Number.isInteger(delta.position) ? delta.position : 0;
  const removedLength = Number.isInteger(delta.length) ? delta.length : 0;
  const lineNumber = Number.isInteger(delta.lineNumber) && delta.lineNumber > 0
    ? delta.lineNumber
    : 1;
  const nextLineOwnership = {
    ...normalizeLineOwnership(lineOwnership),
    [String(lineNumber)]: owner
  };
  const nextCharOwnership = normalizeCharOwnership(charOwnership).slice();
  const insertedOwnership = Array.from({ length: insertedLength }, () => owner);

  if (delta.type === "insert") {
    nextCharOwnership.splice(startPosition, 0, ...insertedOwnership);
  } else if (delta.type === "delete") {
    nextCharOwnership.splice(startPosition, removedLength);
  } else {
    nextCharOwnership.splice(startPosition, removedLength, ...insertedOwnership);
  }

  return {
    charOwnership: nextCharOwnership,
    lineOwnership: nextLineOwnership
  };
};

const transformPositionForDelta = (position, delta) => {
  if (!delta || !Number.isInteger(position)) {
    return position;
  }

  const deltaPosition = Number.isInteger(delta.position) ? delta.position : 0;
  const insertedLength = typeof delta.text === "string" ? delta.text.length : 0;
  const removedLength = Number.isInteger(delta.length) ? delta.length : 0;

  if (delta.type === "insert") {
    return deltaPosition <= position ? position + insertedLength : position;
  }

  if (delta.type === "delete") {
    if (deltaPosition >= position) {
      return position;
    }

    const removedBeforePosition = Math.min(removedLength, position - deltaPosition);
    return Math.max(deltaPosition, position - removedBeforePosition);
  }

  if (delta.type === "replace") {
    let nextPosition = position;

    if (deltaPosition < nextPosition) {
      const removedBeforePosition = Math.min(removedLength, nextPosition - deltaPosition);
      nextPosition = Math.max(deltaPosition, nextPosition - removedBeforePosition);
    }

    return deltaPosition <= nextPosition ? nextPosition + insertedLength : nextPosition;
  }

  return position;
};

const transformDeltaForOptimisticDeltas = (delta, optimisticDeltas = []) => {
  if (!delta || !Array.isArray(optimisticDeltas) || optimisticDeltas.length === 0) {
    return delta;
  }

  const transformedPosition = optimisticDeltas.reduce(
    (position, optimisticPayload) => transformPositionForDelta(position, optimisticPayload.delta),
    delta.position
  );

  return {
    ...delta,
    position: transformedPosition
  };
};

export const useDocumentSync = ({
  roomCode,
  userColor = "",
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
  const [charOwnership, setCharOwnership] = useState([]);
  const versionRef = useRef(version);
  const pendingMutationIdsRef = useRef(new Set());
  const handledMutationIdsRef = useRef(new Set());
  const optimisticDeltasRef = useRef([]);
  const latestDocumentRef = useRef(normalizeDocument(initialDocument));
  const confirmedDocumentRef = useRef(normalizeDocument(initialDocument));
  const localRevisionRef = useRef(0);
  const inFlightMutationIdRef = useRef("");
  const inFlightRevisionRef = useRef(0);
  const flushQueuedDeltaRef = useRef(null);
  const flushTimerRef = useRef(null);
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
    setCharOwnership([]);
    setIsSynced(true);
    setIsSaving(false);
    setEditorError("");
    pendingMutationIdsRef.current.clear();
    handledMutationIdsRef.current.clear();
    optimisticDeltasRef.current = [];
    latestDocumentRef.current = normalizeDocument(initialDocument);
    confirmedDocumentRef.current = normalizeDocument(initialDocument);
    localRevisionRef.current = 0;
    inFlightMutationIdRef.current = "";
    inFlightRevisionRef.current = 0;
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, [initialDocument, initialVersion, normalizedRoomCode]);

  const applyOwnershipWithOptimisticDeltas = useCallback(({
    charOwnership: confirmedCharOwnership = [],
    lineOwnership: confirmedLineOwnership = {}
  } = {}) => {
    const ownership = optimisticDeltasRef.current.reduce(
      (currentOwnership, optimisticPayload) =>
        applyDeltaToOwnership({
          ...currentOwnership,
          delta: optimisticPayload.delta,
          owner: optimisticPayload.owner
        }),
      {
        charOwnership: normalizeCharOwnership(confirmedCharOwnership).slice(),
        lineOwnership: normalizeLineOwnership(confirmedLineOwnership)
      }
    );

    setLineOwnership(ownership.lineOwnership);
    setCharOwnership(ownership.charOwnership);
  }, []);

  const updateSavingState = useCallback(() => {
    setIsSaving(
      pendingMutationIdsRef.current.size > 0
      || Boolean(inFlightMutationIdRef.current)
      || latestDocumentRef.current !== confirmedDocumentRef.current
    );
  }, []);

  const removePendingMutation = useCallback((clientMutationId = "") => {
    if (clientMutationId) {
      pendingMutationIdsRef.current.delete(clientMutationId);
    } else {
      pendingMutationIdsRef.current.clear();
    }

    updateSavingState();
  }, [updateSavingState]);

  const handleDeltaError = useCallback((message) => {
    setEditorError(message || "Editor sync failed");
    pendingMutationIdsRef.current.clear();
    handledMutationIdsRef.current.clear();
    optimisticDeltasRef.current = [];
    inFlightMutationIdRef.current = "";
    inFlightRevisionRef.current = 0;
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setIsSaving(false);
    setIsSynced(false);
  }, []);

  const pushOptimisticOwnership = useCallback((payload) => {
    if (!payload?.delta || !payload.owner?.userId || !payload.owner?.username) {
      return;
    }

    optimisticDeltasRef.current.push(payload);

    setLineOwnership((currentOwnership) =>
      applyDeltaToOwnership({
        charOwnership: [],
        delta: payload.delta,
        lineOwnership: currentOwnership,
        owner: payload.owner
      }).lineOwnership
    );
    setCharOwnership((currentOwnership) => {
      const ownership = applyDeltaToOwnership({
        charOwnership: currentOwnership,
        delta: payload.delta,
        lineOwnership: {},
        owner: payload.owner
      });

      return ownership.charOwnership;
    });
  }, []);

  const removeOptimisticOwnership = useCallback((revision = 0) => {
    if (!revision) {
      optimisticDeltasRef.current = [];
      return;
    }

    optimisticDeltasRef.current = optimisticDeltasRef.current.filter(
      (payload) => payload.revision > revision
    );
  }, []);

  const {
    documentRef,
    replaceDocument,
    applyLocalChange,
    applyRemoteChange
  } = useEditorDelta({
    document,
    onDocumentChange: setDocument,
    onError: handleDeltaError
  });

  useEffect(() => {
    latestDocumentRef.current = documentRef.current;
  }, [document, documentRef]);

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
      const safeDocument = normalizeDocument(payload.document);
      const nextVersion = normalizeVersion(payload.version);
      versionRef.current = nextVersion;
      confirmedDocumentRef.current = safeDocument;
      latestDocumentRef.current = safeDocument;
      setVersion(nextVersion);
      removeOptimisticOwnership();
      applyOwnershipWithOptimisticDeltas({
        charOwnership: payload.charOwnership,
        lineOwnership: payload.lineOwnership
      });
      setEditorError("");
      removePendingMutation();
      setIsSynced(true);
    },
    [
      applyOwnershipWithOptimisticDeltas,
      removeOptimisticOwnership,
      removePendingMutation,
      replaceDocument
    ]
  );

  const handleRemoteDelta = useCallback(
    (payload = {}) => {
      let nextConfirmedDocument = confirmedDocumentRef.current;
      const hasLocalChanges = latestDocumentRef.current !== confirmedDocumentRef.current
        || Boolean(inFlightMutationIdRef.current);

      try {
        nextConfirmedDocument = applyRemoteDelta(nextConfirmedDocument, payload.delta);
      } catch {
        requestEditorState();
        return;
      }

      confirmedDocumentRef.current = nextConfirmedDocument;

      if (!hasLocalChanges) {
        const nextDocument = applyRemoteChange(payload);

        if (!nextDocument) {
          return;
        }

        latestDocumentRef.current = nextDocument;
      }

      const nextVersion = normalizeVersion(payload.version);

      if (nextVersion >= versionRef.current) {
        versionRef.current = nextVersion;
        setVersion(nextVersion);
      }

      if (hasLocalChanges) {
        const transformedRemoteDelta = transformDeltaForOptimisticDeltas(
          payload.delta,
          optimisticDeltasRef.current
        );

        try {
          const nextDocument = applyRemoteDelta(documentRef.current, transformedRemoteDelta);
          replaceDocument(nextDocument);
          latestDocumentRef.current = nextDocument;
        } catch {
          requestEditorState();
          return;
        }
      }

      applyOwnershipWithOptimisticDeltas({
        charOwnership: payload.charOwnership,
        lineOwnership: payload.lineOwnership
      });
      setEditorError("");
      setIsSynced(latestDocumentRef.current === confirmedDocumentRef.current);
      flushQueuedDeltaRef.current?.();
    },
    [
      applyOwnershipWithOptimisticDeltas,
      applyRemoteChange,
      documentRef,
      replaceDocument,
      requestEditorState
    ]
  );

  const handleEditorSync = useCallback(
    (payload = {}) => {
      const nextVersion = normalizeVersion(payload.version);
      const confirmedRevision = inFlightRevisionRef.current;
      const clientMutationId = typeof payload.clientMutationId === "string"
        ? payload.clientMutationId
        : "";

      if (clientMutationId && handledMutationIdsRef.current.has(clientMutationId)) {
        flushQueuedDeltaRef.current?.();
        return;
      }

      if (
        clientMutationId
        && inFlightMutationIdRef.current === clientMutationId
      ) {
        inFlightMutationIdRef.current = "";
        inFlightRevisionRef.current = 0;
      }

      if (nextVersion < versionRef.current) {
        removeOptimisticOwnership(confirmedRevision);
        removePendingMutation(clientMutationId);
        flushQueuedDeltaRef.current?.();
        return;
      }

      try {
        confirmedDocumentRef.current = applyRemoteDelta(
          confirmedDocumentRef.current,
          payload.delta
        );
      } catch {
        requestEditorState();
        return;
      }

      versionRef.current = nextVersion;
      setVersion(nextVersion);
      removeOptimisticOwnership(confirmedRevision);
      applyOwnershipWithOptimisticDeltas({
        charOwnership: payload.charOwnership,
        lineOwnership: payload.lineOwnership
      });
      setEditorError("");
      removePendingMutation(clientMutationId);
      if (clientMutationId) {
        handledMutationIdsRef.current.add(clientMutationId);
      }
      if (latestDocumentRef.current === confirmedDocumentRef.current) {
        replaceDocument(confirmedDocumentRef.current);
        setIsSynced(true);
      } else {
        setIsSynced(false);
      }

      if (payload.conflictResolved) {
        requestEditorState();
      }

      flushQueuedDeltaRef.current?.();
    },
    [
      applyOwnershipWithOptimisticDeltas,
      removeOptimisticOwnership,
      removePendingMutation,
      requestEditorState
    ]
  );

  const flushQueuedDelta = useCallback(() => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (inFlightMutationIdRef.current) {
      updateSavingState();
      return;
    }

    if (!socket.connected) {
      updateSavingState();
      return;
    }

    const { roomCode: currentRoomCode, userId: currentUserId, username: currentUsername } =
      connectionRef.current;
    const confirmedDocument = confirmedDocumentRef.current;
    const latestDocument = latestDocumentRef.current;
    const delta = createDeltaFromTextChange(confirmedDocument, latestDocument);

    if (!delta) {
      setIsSynced(true);
      updateSavingState();
      return;
    }

    if (!currentRoomCode || !currentUserId) {
      handleDeltaError("Room session is not ready for editor sync");
      return;
    }

    const clientMutationId = createClientMutationId();
    const revision = localRevisionRef.current;
    const payload = {
      clientMutationId,
      roomCode: currentRoomCode,
      userId: currentUserId,
      username: currentUsername,
      baseVersion: versionRef.current,
      delta
    };

    inFlightMutationIdRef.current = payload.clientMutationId;
    inFlightRevisionRef.current = revision;
    pendingMutationIdsRef.current.add(payload.clientMutationId);
    updateSavingState();

    socket.timeout(EDITOR_ACK_TIMEOUT_MS).emit(
      SOCKET_EVENTS.EDITOR_DELTA,
      payload,
      (ackError, response = {}) => {
        if (inFlightMutationIdRef.current === payload.clientMutationId) {
          inFlightMutationIdRef.current = "";
          inFlightRevisionRef.current = 0;
        }

        if (ackError) {
          pendingMutationIdsRef.current.delete(payload.clientMutationId);
          removeOptimisticOwnership(revision);
          updateSavingState();
          setIsSynced(false);
          setEditorError("Editor sync timed out. Refreshed the latest room state.");
          requestEditorState();
          return;
        }

        if (!response.success) {
          pendingMutationIdsRef.current.delete(payload.clientMutationId);
          removeOptimisticOwnership(revision);
          handleDeltaError(response.message || "Editor sync failed");
          requestEditorState();
          return;
        }

        handleEditorSync(response.data);
      }
    );
  }, [
    handleDeltaError,
    handleEditorSync,
    removeOptimisticOwnership,
    requestEditorState,
    updateSavingState
  ]);

  useEffect(() => {
    flushQueuedDeltaRef.current = flushQueuedDelta;
  }, [flushQueuedDelta]);

  const scheduleEditorFlush = useCallback(() => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
    }

    flushTimerRef.current = window.setTimeout(() => {
      flushQueuedDeltaRef.current?.();
    }, EDITOR_FLUSH_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

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

      localRevisionRef.current += 1;

      const payload = {
        clientMutationId: createClientMutationId(),
        owner: getDeltaOwner({
          userColor,
          userId: currentUserId,
          username: currentUsername
        }),
        roomCode: currentRoomCode,
        userId: currentUserId,
        username: currentUsername,
        delta: change.delta,
        revision: localRevisionRef.current
      };

      latestDocumentRef.current = change.nextDocument;
      pushOptimisticOwnership(payload);
      setIsSaving(true);
      setIsSynced(false);
      setEditorError("");
      scheduleEditorFlush();

      return payload;
    },
    [
      applyLocalChange,
      handleDeltaError,
      pushOptimisticOwnership,
      scheduleEditorFlush,
      userColor
    ]
  );

  useEffect(() => {
    const handleEditorState = (payload) => applyEditorState(payload);
    const handleEditorDeltaApplied = (payload) => handleRemoteDelta(payload);
    const handleEditorError = (payload = {}) => {
      handleDeltaError(payload.message || "Editor sync failed");
      requestEditorState();
    };
    const handleSocketDisconnect = () => {
      if (
        pendingMutationIdsRef.current.size > 0
        || inFlightMutationIdRef.current
        || latestDocumentRef.current !== confirmedDocumentRef.current
      ) {
        handleDeltaError("Editor connection dropped before changes were confirmed");
      }
    };
    const handleSocketConnect = () => {
      flushQueuedDeltaRef.current?.();
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleSocketConnect);
    socket.on(SOCKET_EVENTS.EDITOR_STATE, handleEditorState);
    socket.on(SOCKET_EVENTS.EDITOR_SYNC, handleEditorSync);
    socket.on(SOCKET_EVENTS.EDITOR_DELTA_APPLIED, handleEditorDeltaApplied);
    socket.on(SOCKET_EVENTS.EDITOR_ERROR, handleEditorError);
    socket.on(SOCKET_EVENTS.DISCONNECT, handleSocketDisconnect);

    requestEditorState();

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleSocketConnect);
      socket.off(SOCKET_EVENTS.EDITOR_STATE, handleEditorState);
      socket.off(SOCKET_EVENTS.EDITOR_SYNC, handleEditorSync);
      socket.off(SOCKET_EVENTS.EDITOR_DELTA_APPLIED, handleEditorDeltaApplied);
      socket.off(SOCKET_EVENTS.EDITOR_ERROR, handleEditorError);
      socket.off(SOCKET_EVENTS.DISCONNECT, handleSocketDisconnect);
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
    charOwnership,
    lineOwnership,
    requestEditorState,
    handleLocalChange,
    handleRemoteDelta
  };
};
