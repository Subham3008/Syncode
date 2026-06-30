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

const normalizeCharOwnership = (charOwnership) => {
  if (!Array.isArray(charOwnership)) {
    return [];
  }

  return charOwnership;
};

const EDITOR_ACK_TIMEOUT_MS = 8000;

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
  const queuedDeltasRef = useRef([]);
  const optimisticDeltasRef = useRef([]);
  const inFlightMutationIdRef = useRef("");
  const flushQueuedDeltaRef = useRef(null);
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
    queuedDeltasRef.current = [];
    optimisticDeltasRef.current = [];
    inFlightMutationIdRef.current = "";
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
      || queuedDeltasRef.current.length > 0
      || Boolean(inFlightMutationIdRef.current)
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
    queuedDeltasRef.current = [];
    optimisticDeltasRef.current = [];
    inFlightMutationIdRef.current = "";
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

  const removeOptimisticOwnership = useCallback((clientMutationId = "") => {
    if (!clientMutationId) {
      optimisticDeltasRef.current = [];
      return;
    }

    optimisticDeltasRef.current = optimisticDeltasRef.current.filter(
      (payload) => payload.clientMutationId !== clientMutationId
    );
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
      const nextDocument = applyRemoteChange(payload);

      if (!nextDocument) {
        return;
      }

      const nextVersion = normalizeVersion(payload.version);

      if (nextVersion >= versionRef.current) {
        versionRef.current = nextVersion;
        setVersion(nextVersion);
      }

      applyOwnershipWithOptimisticDeltas({
        charOwnership: payload.charOwnership,
        lineOwnership: payload.lineOwnership
      });
      setEditorError("");
      setIsSynced(true);
    },
    [applyOwnershipWithOptimisticDeltas, applyRemoteChange]
  );

  const handleEditorSync = useCallback(
    (payload = {}) => {
      const nextVersion = normalizeVersion(payload.version);

      if (
        payload.clientMutationId
        && inFlightMutationIdRef.current === payload.clientMutationId
      ) {
        inFlightMutationIdRef.current = "";
      }

      if (nextVersion < versionRef.current) {
        removeOptimisticOwnership(payload.clientMutationId);
        removePendingMutation(payload.clientMutationId);
        flushQueuedDeltaRef.current?.();
        return;
      }

      versionRef.current = nextVersion;
      setVersion(nextVersion);
      removeOptimisticOwnership(payload.clientMutationId);
      applyOwnershipWithOptimisticDeltas({
        charOwnership: payload.charOwnership,
        lineOwnership: payload.lineOwnership
      });
      setEditorError("");
      removePendingMutation(payload.clientMutationId);
      setIsSynced(true);

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
    const nextQueuedDelta = queuedDeltasRef.current.shift();

    if (!nextQueuedDelta) {
      updateSavingState();
      return;
    }

    if (inFlightMutationIdRef.current) {
      queuedDeltasRef.current.unshift(nextQueuedDelta);
      updateSavingState();
      return;
    }

    if (!socket.connected) {
      queuedDeltasRef.current.unshift(nextQueuedDelta);
      updateSavingState();
      return;
    }

    const payload = {
      ...nextQueuedDelta,
      baseVersion: versionRef.current
    };

    inFlightMutationIdRef.current = payload.clientMutationId;
    pendingMutationIdsRef.current.add(payload.clientMutationId);
    updateSavingState();

    socket.timeout(EDITOR_ACK_TIMEOUT_MS).emit(
      SOCKET_EVENTS.EDITOR_DELTA,
      payload,
      (ackError, response = {}) => {
        if (inFlightMutationIdRef.current === payload.clientMutationId) {
          inFlightMutationIdRef.current = "";
        }

        if (ackError) {
          pendingMutationIdsRef.current.delete(payload.clientMutationId);
          queuedDeltasRef.current = [];
          removeOptimisticOwnership(payload.clientMutationId);
          updateSavingState();
          setIsSynced(false);
          setEditorError("Editor sync timed out. Refreshed the latest room state.");
          requestEditorState();
          return;
        }

        if (!response.success) {
          pendingMutationIdsRef.current.delete(payload.clientMutationId);
          queuedDeltasRef.current = [];
          removeOptimisticOwnership(payload.clientMutationId);
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
        clientMutationId: createClientMutationId(),
        owner: getDeltaOwner({
          userColor,
          userId: currentUserId,
          username: currentUsername
        }),
        roomCode: currentRoomCode,
        userId: currentUserId,
        username: currentUsername,
        delta: change.delta
      };

      pushOptimisticOwnership(payload);
      queuedDeltasRef.current.push(payload);
      setIsSaving(true);
      setIsSynced(false);
      setEditorError("");
      flushQueuedDeltaRef.current?.();

      return payload;
    },
    [applyLocalChange, handleDeltaError, pushOptimisticOwnership, userColor]
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
        || queuedDeltasRef.current.length > 0
        || inFlightMutationIdRef.current
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
