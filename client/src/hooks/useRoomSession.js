import { useCallback, useState } from "react";

export const ROOM_SESSION_KEY = "syncode.roomSession";
const LEGACY_ROOM_SESSION_KEY = "syncode-session";

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
  const currentSession = window.localStorage.getItem(ROOM_SESSION_KEY);

  if (currentSession) {
    return currentSession;
  }

  return window.localStorage.getItem(LEGACY_ROOM_SESSION_KEY);
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
    window.localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(nextSession));
    window.localStorage.removeItem(LEGACY_ROOM_SESSION_KEY);
  }

  return nextSession;
};

export const clearStoredRoomSession = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ROOM_SESSION_KEY);
    window.localStorage.removeItem(LEGACY_ROOM_SESSION_KEY);
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
