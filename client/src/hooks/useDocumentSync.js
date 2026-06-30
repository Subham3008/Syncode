import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOCKET_EVENTS } from "../constants/socketEvents.js";
import { socket } from "../socket/socket.js";
import { useEditorDelta } from "./useEditorDelta.js";
import { applyRemoteDelta } from "../utils/delta.utils.js";

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

const SYNC_STATUSES = {
  FAILED: "failed",
  INTERRUPTED: "interrupted",
  OFFLINE: "offline",
  RECONNECTING: "reconnecting",
  SAVING: "saving",
  SYNCED: "synced"
};

const EDITOR_ACK_TIMEOUT_MS = 5000;
const EDITOR_FLUSH_DELAY_MS = 40;
const EDITOR_RETRY_DELAY_MS = 650;
const EDITOR_MAX_RETRY_ATTEMPTS = 3;
const HANDLED_DELTA_LIMIT = 400;

const isDeltaRejectionRecoverable = (message = "") =>
  /ahead|baseversion|bounds|history|stale|join the room|conflict|version/i.test(message);

const createClientDeltaId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `delta_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const createStateRequestId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `state_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const getPayloadClientDeltaId = (payload = {}) => {
  if (typeof payload.clientDeltaId === "string" && payload.clientDeltaId.trim()) {
    return payload.clientDeltaId.trim();
  }

  if (typeof payload.clientMutationId === "string" && payload.clientMutationId.trim()) {
    return payload.clientMutationId.trim();
  }

  return "";
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

const getRecentDeltaClientDeltaId = (delta = {}) => {
  if (typeof delta.clientDeltaId === "string" && delta.clientDeltaId.trim()) {
    return delta.clientDeltaId.trim();
  }

  if (typeof delta.clientMutationId === "string" && delta.clientMutationId.trim()) {
    return delta.clientMutationId.trim();
  }

  return "";
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
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUSES.SYNCED);
  const [syncMessage, setSyncMessage] = useState("");
  const [isSynced, setIsSynced] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [lineOwnership, setLineOwnership] = useState({});
  const [charOwnership, setCharOwnership] = useState([]);
  const versionRef = useRef(version);
  const pendingDeltasRef = useRef(new Map());
  const outgoingDeltaIdsRef = useRef([]);
  const handledDeltaIdsRef = useRef(new Set());
  const handledDeltaOrderRef = useRef([]);
  const optimisticDeltasRef = useRef([]);
  const latestDocumentRef = useRef(normalizeDocument(initialDocument));
  const confirmedDocumentRef = useRef(normalizeDocument(initialDocument));
  const localRevisionRef = useRef(0);
  const flushTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const flushQueuedDeltasRef = useRef(null);
  const stateRequestsRef = useRef(new Map());
  const syncIssueRef = useRef(null);
  const connectionRef = useRef({
    roomCode: normalizedRoomCode,
    userId,
    username
  });

  const {
    documentRef,
    replaceDocument,
    applyLocalChange
  } = useEditorDelta({
    document,
    onDocumentChange: setDocument,
    onError: (message) => {
      syncIssueRef.current = {
        level: SYNC_STATUSES.FAILED,
        message: message || "Sync failed"
      };
    }
  });

  const hasUnconfirmedChanges = useCallback(() => (
    pendingDeltasRef.current.size > 0
    || latestDocumentRef.current !== confirmedDocumentRef.current
  ), []);

  const updateSyncState = useCallback(() => {
    const hasPendingChanges = hasUnconfirmedChanges();
    const issue = syncIssueRef.current;
    let nextStatus = SYNC_STATUSES.SYNCED;
    let nextMessage = "";

    if (!socket.connected) {
      nextStatus = socket.active === false
        ? SYNC_STATUSES.OFFLINE
        : SYNC_STATUSES.RECONNECTING;
      nextMessage = hasPendingChanges
        ? "Connection interrupted with unsynced editor changes"
        : "Connecting to the editor";
    } else if (issue?.level === SYNC_STATUSES.FAILED) {
      nextStatus = SYNC_STATUSES.FAILED;
      nextMessage = issue.message || "Sync failed";
    } else if (issue?.level === SYNC_STATUSES.INTERRUPTED) {
      nextStatus = SYNC_STATUSES.INTERRUPTED;
      nextMessage = issue.message || "Sync interrupted. Retrying editor changes";
    } else if (hasPendingChanges) {
      nextStatus = SYNC_STATUSES.SAVING;
      nextMessage = "Saving editor changes";
    }

    setSyncStatus(nextStatus);
    setSyncMessage(nextMessage);
    setIsSaving(
      nextStatus === SYNC_STATUSES.SAVING
      || (nextStatus === SYNC_STATUSES.INTERRUPTED && hasPendingChanges)
    );
    setIsSynced(nextStatus === SYNC_STATUSES.SYNCED);
    setEditorError(nextStatus === SYNC_STATUSES.FAILED ? nextMessage : "");
  }, [hasUnconfirmedChanges]);

  const setRecoverableSyncIssue = useCallback((message) => {
    syncIssueRef.current = {
      level: SYNC_STATUSES.INTERRUPTED,
      message: message || "Sync interrupted. Retrying editor changes"
    };
    updateSyncState();
  }, [updateSyncState]);

  const setFailedSyncIssue = useCallback((message) => {
    syncIssueRef.current = {
      level: SYNC_STATUSES.FAILED,
      message: message || "Sync failed"
    };
    updateSyncState();
  }, [updateSyncState]);

  const clearRecoverableSyncIssue = useCallback(() => {
    if (syncIssueRef.current?.level === SYNC_STATUSES.INTERRUPTED) {
      syncIssueRef.current = null;
    }

    updateSyncState();
  }, [updateSyncState]);

  const rememberHandledDeltaId = useCallback((clientDeltaId = "") => {
    if (!clientDeltaId || handledDeltaIdsRef.current.has(clientDeltaId)) {
      return;
    }

    handledDeltaIdsRef.current.add(clientDeltaId);
    handledDeltaOrderRef.current.push(clientDeltaId);

    while (handledDeltaOrderRef.current.length > HANDLED_DELTA_LIMIT) {
      const expiredDeltaId = handledDeltaOrderRef.current.shift();
      handledDeltaIdsRef.current.delete(expiredDeltaId);
    }
  }, []);

  const queueDeltaForSend = useCallback((clientDeltaId = "") => {
    if (!clientDeltaId || outgoingDeltaIdsRef.current.includes(clientDeltaId)) {
      return;
    }

    outgoingDeltaIdsRef.current.push(clientDeltaId);
  }, []);

  const removeQueuedDelta = useCallback((clientDeltaId = "") => {
    if (!clientDeltaId) {
      return;
    }

    outgoingDeltaIdsRef.current = outgoingDeltaIdsRef.current.filter(
      (queuedDeltaId) => queuedDeltaId !== clientDeltaId
    );
  }, []);

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

  const removeOptimisticDelta = useCallback((clientDeltaId = "") => {
    if (!clientDeltaId) {
      optimisticDeltasRef.current = [];
      return;
    }

    optimisticDeltasRef.current = optimisticDeltasRef.current.filter(
      (payload) => payload.clientDeltaId !== clientDeltaId
    );
  }, []);

  const requestEditorState = useCallback((options = {}) => {
    if (!connectionRef.current.roomCode) {
      return "";
    }

    const requestId = createStateRequestId();

    stateRequestsRef.current.set(requestId, {
      reason: options.reason || "manual",
      revision: localRevisionRef.current
    });

    socket.emit(SOCKET_EVENTS.EDITOR_GET_STATE, {
      roomCode: connectionRef.current.roomCode,
      requestId,
      reason: options.reason || "manual"
    });

    return requestId;
  }, []);

  const scheduleEditorFlush = useCallback(() => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
    }

    flushTimerRef.current = window.setTimeout(() => {
      flushQueuedDeltasRef.current?.();
    }, EDITOR_FLUSH_DELAY_MS);
  }, []);

  const scheduleRetryFlush = useCallback((delayMs = EDITOR_RETRY_DELAY_MS) => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
    }

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      flushQueuedDeltasRef.current?.();
    }, delayMs);
  }, []);

  const reconcileEditorState = useCallback(
    (payload = {}) => {
      const safeDocument = normalizeDocument(payload.document);
      const nextVersion = normalizeVersion(payload.version);
      const requestId = typeof payload.requestId === "string" ? payload.requestId : "";
      const requestMeta = requestId ? stateRequestsRef.current.get(requestId) : null;

      if (requestId) {
        stateRequestsRef.current.delete(requestId);
      }

      const recentDeltaIds = new Set(
        (Array.isArray(payload.recentDeltas) ? payload.recentDeltas : [])
          .map(getRecentDeltaClientDeltaId)
          .filter(Boolean)
      );
      const nextOptimisticDeltas = [];
      let nextDocument = safeDocument;
      let replayFailed = false;

      for (const optimisticPayload of optimisticDeltasRef.current) {
        const pendingDeltaId = optimisticPayload.clientDeltaId;

        if (recentDeltaIds.has(pendingDeltaId)) {
          pendingDeltasRef.current.delete(pendingDeltaId);
          removeQueuedDelta(pendingDeltaId);
          rememberHandledDeltaId(pendingDeltaId);
          continue;
        }

        nextOptimisticDeltas.push(optimisticPayload);

        try {
          nextDocument = applyRemoteDelta(nextDocument, optimisticPayload.delta);
        } catch {
          replayFailed = true;
          break;
        }
      }

      if (replayFailed) {
        setFailedSyncIssue("Sync failed. Local editor changes could not be reconciled.");
        return;
      }

      const hasLateInitialEdits = Boolean(
        requestMeta
        && requestMeta.reason === "initial"
        && localRevisionRef.current > requestMeta.revision
      );

      confirmedDocumentRef.current = safeDocument;
      latestDocumentRef.current = nextDocument;
      optimisticDeltasRef.current = nextOptimisticDeltas;
      versionRef.current = nextVersion;
      setVersion(nextVersion);
      replaceDocument(nextDocument);

      applyOwnershipWithOptimisticDeltas({
        charOwnership: payload.charOwnership,
        lineOwnership: payload.lineOwnership
      });

      for (const optimisticPayload of nextOptimisticDeltas) {
        const pendingPayload = pendingDeltasRef.current.get(optimisticPayload.clientDeltaId);

        if (pendingPayload) {
          pendingPayload.needsRetry = true;
          queueDeltaForSend(optimisticPayload.clientDeltaId);
        }
      }

      if (hasLateInitialEdits && nextOptimisticDeltas.length > 0) {
        setRecoverableSyncIssue("Initial editor state arrived late. Preserving local changes.");
      } else {
        clearRecoverableSyncIssue();
      }

      if (nextOptimisticDeltas.length > 0) {
        scheduleRetryFlush(0);
      }
    },
    [
      applyOwnershipWithOptimisticDeltas,
      clearRecoverableSyncIssue,
      queueDeltaForSend,
      rememberHandledDeltaId,
      removeQueuedDelta,
      replaceDocument,
      scheduleRetryFlush,
      setFailedSyncIssue,
      setRecoverableSyncIssue
    ]
  );

  const handleAppliedDelta = useCallback(
    (payload = {}, { fromAck = false } = {}) => {
      if (normalizeRoomCode(payload.roomCode) !== connectionRef.current.roomCode) {
        return;
      }

      const clientDeltaId = getPayloadClientDeltaId(payload);
      const isPendingLocalDelta = clientDeltaId
        ? pendingDeltasRef.current.has(clientDeltaId)
        : false;

      if (
        clientDeltaId
        && handledDeltaIdsRef.current.has(clientDeltaId)
        && !isPendingLocalDelta
      ) {
        return;
      }

      if (import.meta.env.DEV) {
        console.debug("[editor-sync] delta received", {
          clientDeltaId,
          fromAck,
          clientSentAt: payload.clientSentAt,
          serverReceivedAt: payload.serverReceivedAt,
          redisAppliedAt: payload.redisAppliedAt,
          serverBroadcastAt: payload.serverBroadcastAt,
          clientReceivedAt: Date.now()
        });
      }

      const pendingPayload = clientDeltaId
        ? pendingDeltasRef.current.get(clientDeltaId)
        : null;
      const isOwnDelta = Boolean(pendingPayload);
      const nextVersion = normalizeVersion(payload.serverVersion ?? payload.version);

      if (!isOwnDelta && (payload.duplicate || nextVersion <= versionRef.current)) {
        rememberHandledDeltaId(clientDeltaId);
        updateSyncState();
        return;
      }

      let nextConfirmedDocument = confirmedDocumentRef.current;

      try {
        nextConfirmedDocument = applyRemoteDelta(nextConfirmedDocument, payload.delta);
      } catch {
        setRecoverableSyncIssue("Sync interrupted. Refreshing the latest editor state.");
        requestEditorState({ reason: "delta-apply-error" });
        return;
      }

      confirmedDocumentRef.current = nextConfirmedDocument;

      if (nextVersion >= versionRef.current) {
        versionRef.current = nextVersion;
        setVersion(nextVersion);
      }

      if (isOwnDelta) {
        pendingDeltasRef.current.delete(clientDeltaId);
        removeQueuedDelta(clientDeltaId);
        removeOptimisticDelta(clientDeltaId);
        rememberHandledDeltaId(clientDeltaId);

        if (payload.conflictResolved) {
          setRecoverableSyncIssue("Sync interrupted. Rechecking transformed editor changes.");
          requestEditorState({ reason: "conflict-resolved" });
        }
      } else {
        const optimisticDeltas = optimisticDeltasRef.current;
        const hasLocalOptimisticDeltas = optimisticDeltas.length > 0;

        try {
          const deltaForLocalDocument = hasLocalOptimisticDeltas
            ? transformDeltaForOptimisticDeltas(payload.delta, optimisticDeltas)
            : payload.delta;
          const nextLocalDocument = applyRemoteDelta(documentRef.current, deltaForLocalDocument);

          replaceDocument(nextLocalDocument);
          latestDocumentRef.current = nextLocalDocument;
        } catch {
          setRecoverableSyncIssue("Sync interrupted. Refreshing the latest editor state.");
          requestEditorState({ reason: "remote-delta-apply-error" });
          return;
        }

        rememberHandledDeltaId(clientDeltaId);
      }

      applyOwnershipWithOptimisticDeltas({
        charOwnership: payload.charOwnership,
        lineOwnership: payload.lineOwnership
      });

      if (payload.conflictResolved && isOwnDelta) {
        return;
      }

      clearRecoverableSyncIssue();
      updateSyncState();
      flushQueuedDeltasRef.current?.();
    },
    [
      applyOwnershipWithOptimisticDeltas,
      clearRecoverableSyncIssue,
      documentRef,
      rememberHandledDeltaId,
      removeOptimisticDelta,
      removeQueuedDelta,
      replaceDocument,
      requestEditorState,
      setRecoverableSyncIssue,
      updateSyncState
    ]
  );

  const handleDeltaRejected = useCallback(
    (clientDeltaId, response = {}) => {
      const message = response.message || "Sync failed";
      const pendingPayload = pendingDeltasRef.current.get(clientDeltaId);

      if (clientDeltaId) {
        removeQueuedDelta(clientDeltaId);
      }

      if (pendingPayload && isDeltaRejectionRecoverable(message)) {
        pendingPayload.needsRetry = true;
        pendingPayload.sentAt = 0;
        queueDeltaForSend(clientDeltaId);
        setRecoverableSyncIssue("Sync interrupted. Refreshing latest document and retrying changes.");
        requestEditorState({ reason: "delta-rejected" });
        return;
      }

      setFailedSyncIssue(message);
      requestEditorState({ reason: "delta-rejected" });
    },
    [
      queueDeltaForSend,
      removeQueuedDelta,
      requestEditorState,
      setFailedSyncIssue,
      setRecoverableSyncIssue
    ]
  );

  const handleDeltaAckTimeout = useCallback(
    (clientDeltaId = "") => {
      const pendingPayload = pendingDeltasRef.current.get(clientDeltaId);

      if (!pendingPayload) {
        return;
      }

      pendingPayload.retryAttempts += 1;

      if (pendingPayload.retryAttempts > EDITOR_MAX_RETRY_ATTEMPTS) {
        setFailedSyncIssue("Sync failed after repeated realtime retry attempts.");
        requestEditorState({ reason: "retry-exhausted" });
        return;
      }

      pendingPayload.needsRetry = true;
      queueDeltaForSend(clientDeltaId);
      setRecoverableSyncIssue("Sync interrupted. Retrying editor changes.");
      scheduleRetryFlush(EDITOR_RETRY_DELAY_MS * pendingPayload.retryAttempts);
    },
    [
      queueDeltaForSend,
      requestEditorState,
      scheduleRetryFlush,
      setFailedSyncIssue,
      setRecoverableSyncIssue
    ]
  );

  const emitPendingDelta = useCallback(
    (pendingPayload) => {
      const clientDeltaId = pendingPayload.clientDeltaId;
      const clientSentAt = Date.now();

      pendingPayload.sentAt = clientSentAt;
      pendingPayload.needsRetry = false;

      const outboundPayload = {
        roomCode: pendingPayload.roomCode,
        userId: pendingPayload.userId,
        username: pendingPayload.username,
        clientDeltaId,
        clientMutationId: clientDeltaId,
        clientSentAt,
        baseVersion: pendingPayload.baseVersion,
        delta: pendingPayload.delta
      };

      if (import.meta.env.DEV) {
        console.debug("[editor-sync] delta emit", {
          clientDeltaId,
          baseVersion: outboundPayload.baseVersion,
          clientSentAt
        });
      }

      socket.timeout(EDITOR_ACK_TIMEOUT_MS).emit(
        SOCKET_EVENTS.EDITOR_DELTA,
        outboundPayload,
        (ackError, response = {}) => {
          if (!pendingDeltasRef.current.has(clientDeltaId)) {
            return;
          }

          if (ackError) {
            handleDeltaAckTimeout(clientDeltaId);
            return;
          }

          if (!response.success) {
            handleDeltaRejected(clientDeltaId, response);
            return;
          }

          if (response.data) {
            handleAppliedDelta(response.data, { fromAck: true });
          }
        }
      );
    },
    [handleAppliedDelta, handleDeltaAckTimeout, handleDeltaRejected]
  );

  const flushQueuedDeltas = useCallback(() => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (!socket.connected) {
      updateSyncState();
      return;
    }

    const hasInFlightDelta = Array.from(pendingDeltasRef.current.values()).some(
      (pendingPayload) => pendingPayload.sentAt && !pendingPayload.needsRetry
    );

    if (hasInFlightDelta) {
      updateSyncState();
      return;
    }

    while (outgoingDeltaIdsRef.current.length > 0) {
      const clientDeltaId = outgoingDeltaIdsRef.current.shift();
      const pendingPayload = pendingDeltasRef.current.get(clientDeltaId);

      if (!pendingPayload) {
        continue;
      }

      if (pendingPayload.sentAt && !pendingPayload.needsRetry) {
        outgoingDeltaIdsRef.current.unshift(clientDeltaId);
        updateSyncState();
        return;
      }

      emitPendingDelta(pendingPayload);
      break;
    }

    updateSyncState();
  }, [emitPendingDelta, updateSyncState]);

  useEffect(() => {
    flushQueuedDeltasRef.current = flushQueuedDeltas;
  }, [flushQueuedDeltas]);

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
    const safeDocument = normalizeDocument(initialDocument);
    const safeVersion = normalizeVersion(initialVersion);

    setDocument(safeDocument);
    setVersion(safeVersion);
    setLineOwnership({});
    setCharOwnership([]);
    setSyncStatus(SYNC_STATUSES.SYNCED);
    setSyncMessage("");
    setIsSynced(true);
    setIsSaving(false);
    setEditorError("");
    pendingDeltasRef.current.clear();
    outgoingDeltaIdsRef.current = [];
    handledDeltaIdsRef.current.clear();
    handledDeltaOrderRef.current = [];
    optimisticDeltasRef.current = [];
    latestDocumentRef.current = safeDocument;
    confirmedDocumentRef.current = safeDocument;
    localRevisionRef.current = 0;
    stateRequestsRef.current.clear();
    syncIssueRef.current = null;
    versionRef.current = safeVersion;

    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [normalizedRoomCode]);

  useEffect(() => {
    latestDocumentRef.current = documentRef.current;
  }, [document, documentRef]);

  useEffect(() => () => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const handleLocalChange = useCallback(
    (nextText, cursorPosition = null) => {
      const { roomCode: currentRoomCode, userId: currentUserId, username: currentUsername } =
        connectionRef.current;

      if (!currentRoomCode || !currentUserId) {
        setFailedSyncIssue("Room session is not ready for editor sync");
        return null;
      }

      const change = applyLocalChange(nextText, cursorPosition);

      if (!change) {
        return null;
      }

      localRevisionRef.current += 1;

      const clientDeltaId = createClientDeltaId();
      const payload = {
        baseVersion: versionRef.current + optimisticDeltasRef.current.length,
        clientDeltaId,
        owner: getDeltaOwner({
          userColor,
          userId: currentUserId,
          username: currentUsername
        }),
        roomCode: currentRoomCode,
        userId: currentUserId,
        username: currentUsername,
        delta: change.delta,
        revision: localRevisionRef.current,
        retryAttempts: 0,
        sentAt: 0,
        needsRetry: false
      };

      latestDocumentRef.current = change.nextDocument;
      pendingDeltasRef.current.set(clientDeltaId, payload);
      queueDeltaForSend(clientDeltaId);
      pushOptimisticOwnership(payload);
      syncIssueRef.current = syncIssueRef.current?.level === SYNC_STATUSES.FAILED
        ? syncIssueRef.current
        : null;
      updateSyncState();
      scheduleEditorFlush();

      return payload;
    },
    [
      applyLocalChange,
      pushOptimisticOwnership,
      queueDeltaForSend,
      scheduleEditorFlush,
      setFailedSyncIssue,
      updateSyncState,
      userColor
    ]
  );

  useEffect(() => {
    const handleEditorState = (payload = {}) => reconcileEditorState(payload);
    const handleEditorDeltaApplied = (payload = {}) => handleAppliedDelta(payload);
    const handleEditorError = (payload = {}) => {
      const message = payload.message || "Sync failed";

      if (!socket.connected) {
        updateSyncState();
        return;
      }

      if (/join the room before/i.test(message)) {
        setRecoverableSyncIssue("Reconnecting to the editor room.");
        return;
      }

      setFailedSyncIssue(message);
      requestEditorState({ reason: "editor-error" });
    };
    const handleSocketDisconnect = () => {
      updateSyncState();
    };
    const handleSocketConnect = () => {
      syncIssueRef.current = syncIssueRef.current?.level === SYNC_STATUSES.FAILED
        ? syncIssueRef.current
        : null;

      for (const clientDeltaId of pendingDeltasRef.current.keys()) {
        const pendingPayload = pendingDeltasRef.current.get(clientDeltaId);

        if (pendingPayload) {
          pendingPayload.needsRetry = true;
          queueDeltaForSend(clientDeltaId);
        }
      }

      updateSyncState();
    };
    const handleRoomJoined = (payload = {}) => {
      const nextRoom = payload?.room ?? payload;

      if (normalizeRoomCode(nextRoom?.roomCode) !== connectionRef.current.roomCode) {
        return;
      }

      syncIssueRef.current = syncIssueRef.current?.level === SYNC_STATUSES.FAILED
        ? syncIssueRef.current
        : null;
      requestEditorState({ reason: "rejoin" });

      for (const clientDeltaId of pendingDeltasRef.current.keys()) {
        const pendingPayload = pendingDeltasRef.current.get(clientDeltaId);

        if (pendingPayload) {
          pendingPayload.needsRetry = true;
          queueDeltaForSend(clientDeltaId);
        }
      }

      flushQueuedDeltasRef.current?.();
      updateSyncState();
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleSocketConnect);
    socket.on(SOCKET_EVENTS.ROOM_JOINED, handleRoomJoined);
    socket.on(SOCKET_EVENTS.EDITOR_STATE, handleEditorState);
    socket.on(SOCKET_EVENTS.EDITOR_DELTA_APPLIED, handleEditorDeltaApplied);
    socket.on(SOCKET_EVENTS.EDITOR_ERROR, handleEditorError);
    socket.on(SOCKET_EVENTS.DISCONNECT, handleSocketDisconnect);

    requestEditorState({ reason: "initial" });
    updateSyncState();

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleSocketConnect);
      socket.off(SOCKET_EVENTS.ROOM_JOINED, handleRoomJoined);
      socket.off(SOCKET_EVENTS.EDITOR_STATE, handleEditorState);
      socket.off(SOCKET_EVENTS.EDITOR_DELTA_APPLIED, handleEditorDeltaApplied);
      socket.off(SOCKET_EVENTS.EDITOR_ERROR, handleEditorError);
      socket.off(SOCKET_EVENTS.DISCONNECT, handleSocketDisconnect);
    };
  }, [
    handleAppliedDelta,
    queueDeltaForSend,
    reconcileEditorState,
    requestEditorState,
    setFailedSyncIssue,
    setRecoverableSyncIssue,
    updateSyncState
  ]);

  return {
    document,
    version,
    isSynced,
    isSaving,
    syncStatus,
    syncMessage,
    editorError,
    charOwnership,
    lineOwnership,
    requestEditorState,
    handleLocalChange,
    handleRemoteDelta: handleAppliedDelta
  };
};
