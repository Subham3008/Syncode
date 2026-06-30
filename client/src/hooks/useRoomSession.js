import { useCallback, useState } from "react";

export const ROOM_SESSION_KEY = "syncode.roomSession";
const LEGACY_ROOM_SESSION_KEY = "syncode-session";
const readStorageItem = (storage, key) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const writeStorageItem = (storage, key, value) => {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in private windows; keep the in-memory state.
  }
};

const removeStorageItem = (storage, key) => {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
};

const sanitizeRoomSession = (session) => {
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    return null;
  }

  const roomCode = typeof session.roomCode === "string"
    ? session.roomCode.trim().toUpperCase()
    : "";
  const userId = typeof session.userId === "string" ? session.userId.trim() : "";
  const username = typeof session.username === "string" ? session.username.trim() : "";

  if (!roomCode || !userId) {
    return null;
  }

  return {
    userId,
    username,
    roomCode,
    isHost: Boolean(session.isHost)
  };
};

const readRawSession = () => {
  const tabSession = readStorageItem(window.sessionStorage, ROOM_SESSION_KEY);

  if (tabSession) {
    return tabSession;
  }

  return readStorageItem(window.localStorage, ROOM_SESSION_KEY)
    ?? readStorageItem(window.localStorage, LEGACY_ROOM_SESSION_KEY);
};

export const getStoredRoomSession = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawSession = readRawSession();
    const parsedSession = rawSession ? JSON.parse(rawSession) : null;
    const cleanSession = sanitizeRoomSession(parsedSession);

    if (rawSession && !cleanSession) {
      clearStoredRoomSession();
    }

    return cleanSession;
  } catch {
    clearStoredRoomSession();
    return null;
  }
};

export const persistRoomSession = (session) => {
  const nextSession = sanitizeRoomSession(session);

  if (!nextSession) {
    clearStoredRoomSession();
    return null;
  }

  if (typeof window !== "undefined") {
    writeStorageItem(window.sessionStorage, ROOM_SESSION_KEY, JSON.stringify(nextSession));
    removeStorageItem(window.localStorage, ROOM_SESSION_KEY);
    removeStorageItem(window.localStorage, LEGACY_ROOM_SESSION_KEY);
  }

  return nextSession;
};

export const clearStoredRoomSession = () => {
  if (typeof window !== "undefined") {
    removeStorageItem(window.sessionStorage, ROOM_SESSION_KEY);
    removeStorageItem(window.localStorage, ROOM_SESSION_KEY);
    removeStorageItem(window.localStorage, LEGACY_ROOM_SESSION_KEY);
  }
};

export const useRoomSession = () => {
  const [session, setSession] = useState(() => getStoredRoomSession());

  const saveSession = useCallback(
    (nextSession) => {
      const cleanSession = persistRoomSession(nextSession);
      setSession(cleanSession);
      return cleanSession;
    },
    []
  );

  const clearSession = useCallback(() => {
    clearStoredRoomSession();
    setSession(null);
  }, []);

  return {
    session,
    saveSession,
    clearSession
  };
};
