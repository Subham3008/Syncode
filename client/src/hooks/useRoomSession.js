import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage.js";

export const ROOM_SESSION_KEY = "syncode.roomSession";

export const getStoredRoomSession = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(ROOM_SESSION_KEY);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch {
    return null;
  }
};

export const persistRoomSession = (session) => {
  const nextSession = {
    userId: session.userId,
    username: session.username,
    roomCode: session.roomCode,
    isHost: Boolean(session.isHost)
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(nextSession));
  }

  return nextSession;
};

export const clearStoredRoomSession = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ROOM_SESSION_KEY);
  }
};

export const useRoomSession = () => {
  const [session, setSession, removeSession] = useLocalStorage(ROOM_SESSION_KEY, null);

  const saveSession = useCallback(
    (nextSession) => {
      const cleanSession = persistRoomSession(nextSession);
      setSession(cleanSession);
      return cleanSession;
    },
    [setSession]
  );

  const clearSession = useCallback(() => {
    clearStoredRoomSession();
    removeSession();
  }, [removeSession]);

  return {
    session,
    saveSession,
    clearSession
  };
};
