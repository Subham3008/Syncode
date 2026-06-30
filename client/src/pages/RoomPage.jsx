import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import CodeEditor from "../components/editor/CodeEditor.jsx";
import PresencePlaceholder from "../components/presence/PresencePlaceholder.jsx";
import Toast from "../components/common/Toast.jsx";
import StatePanel from "../components/common/StatePanel.jsx";
import HostControls from "../components/room/HostControls.jsx";
import RoomHeader from "../components/room/RoomHeader.jsx";
import { ROUTES } from "../constants/routes.js";
import { SOCKET_EVENTS } from "../constants/socketEvents.js";
import { rejoinRoom } from "../services/room.service.js";
import { socket } from "../socket/socket.js";
import { useRoomSession } from "../hooks/useRoomSession.js";

const normalizeRoomCode = (code) =>
  typeof code === "string" ? code.trim().toUpperCase() : "";

const RoomPage = () => {
  const { roomCode } = useParams();
  const normalizedRouteRoomCode = normalizeRoomCode(roomCode);
  const navigate = useNavigate();
  const { session, saveSession, clearSession } = useRoomSession();
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [isSocketRoomReady, setIsSocketRoomReady] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const shouldDisconnectOnUnmountRef = useRef(true);
  const sessionRoomCode = session?.roomCode;
  const sessionUserId = session?.userId;
  const sessionUsername = session?.username;

  const redirectHomeSoon = () => {
    window.setTimeout(() => {
      shouldDisconnectOnUnmountRef.current = true;
      clearSession();
      navigate(ROUTES.HOME);
    }, 900);
  };

  useEffect(() => () => {
    if (shouldDisconnectOnUnmountRef.current && socket.connected) {
      socket.disconnect();
    }
  }, []);

  useEffect(() => {
    const restoreRoom = async () => {
      if (!sessionRoomCode || !sessionUserId || sessionRoomCode !== normalizedRouteRoomCode) {
        clearSession();
        setStatus("invalid");
        return;
      }

      try {
        const response = await rejoinRoom({
          roomCode: sessionRoomCode,
          userId: sessionUserId
        });

        setRoom(response.data);
        saveSession(response.data);
        setStatus("ready");
      } catch (requestError) {
        if (import.meta.env.DEV) {
          console.error("Room rejoin failed:", requestError);
        }

        setError(requestError.message);
        clearSession();
        setStatus("invalid");
      }
    };

    restoreRoom();
  }, [clearSession, normalizedRouteRoomCode, saveSession, sessionRoomCode, sessionUserId]);

  useEffect(() => {
    if (status !== "ready" || !sessionRoomCode || !sessionUserId) {
      return undefined;
    }

    setIsSocketRoomReady(false);

    const rejoinSocketRoom = () => {
      if (import.meta.env.DEV) {
        console.debug("[room-socket] rejoin", {
          roomCode: sessionRoomCode,
          userId: sessionUserId
        });
      }

      socket.emit(SOCKET_EVENTS.ROOM_REJOIN, {
        roomCode: sessionRoomCode,
        userId: sessionUserId
      });
    };

    const applyRoomPayload = (payload) => {
      const nextRoom = payload?.room ?? payload;

      if (nextRoom?.roomCode === normalizedRouteRoomCode) {
        setRoom((currentRoom) => ({
          ...currentRoom,
          ...nextRoom
        }));
        setIsSocketRoomReady(true);

        if (nextRoom.isActive === false) {
          setTypingUsers([]);
          setToast({ tone: "error", message: "Room was closed by the host" });
          redirectHomeSoon();
        }
      }
    };

    const handleParticipantsUpdated = (participants) => {
      setRoom((currentRoom) => currentRoom ? { ...currentRoom, participants } : currentRoom);

      if (
        Array.isArray(participants)
        && sessionUserId
        && !participants.some((participant) => participant.userId === sessionUserId)
      ) {
        setToast({ tone: "error", message: "You were removed from the room" });
        redirectHomeSoon();
      }
    };

    const handleActivityUpdated = (activityLog) => {
      setRoom((currentRoom) => currentRoom ? { ...currentRoom, activityLog } : currentRoom);
    };

    const applyPresenceParticipants = (participants = []) => {
      setRoom((currentRoom) => currentRoom ? { ...currentRoom, participants } : currentRoom);

      setTypingUsers(
        participants.filter(
          (participant) => participant.isTyping && participant.userId !== sessionUserId
        )
      );
    };

    const upsertPresenceParticipant = (participant = {}) => {
      if (!participant.userId) {
        return;
      }

      setRoom((currentRoom) => {
        if (!currentRoom) {
          return currentRoom;
        }

        const participants = Array.isArray(currentRoom.participants)
          ? currentRoom.participants
          : [];
        const hasParticipant = participants.some((item) => item.userId === participant.userId);
        const nextParticipants = hasParticipant
          ? participants.map((item) =>
            item.userId === participant.userId ? { ...item, ...participant } : item
          )
          : [...participants, participant];

        return {
          ...currentRoom,
          participants: nextParticipants
        };
      });

      setTypingUsers((currentTypingUsers) => {
        const isCurrentUser = participant.userId === sessionUserId;
        const withoutParticipant = currentTypingUsers.filter(
          (item) => item.userId !== participant.userId
        );

        if (isCurrentUser || !participant.isTyping) {
          return withoutParticipant;
        }

        return [...withoutParticipant, participant];
      });
    };

    const removePresenceParticipant = (participantId) => {
      if (!participantId) {
        return;
      }

      setRoom((currentRoom) => {
        if (!currentRoom || !Array.isArray(currentRoom.participants)) {
          return currentRoom;
        }

        return {
          ...currentRoom,
          participants: currentRoom.participants.filter(
            (participant) => participant.userId !== participantId
          )
        };
      });
      setTypingUsers((currentTypingUsers) =>
        currentTypingUsers.filter((participant) => participant.userId !== participantId)
      );
    };

    const handlePresenceList = (payload = {}) => {
      if (
        normalizeRoomCode(payload.roomCode) !== normalizedRouteRoomCode
        || !Array.isArray(payload.participants)
      ) {
        return;
      }

      applyPresenceParticipants(payload.participants);
    };

    const handlePresenceParticipant = (payload = {}) => {
      if (normalizeRoomCode(payload.roomCode) !== normalizedRouteRoomCode) {
        return;
      }

      upsertPresenceParticipant(payload.participant);
    };

    const handlePresenceLeave = (payload = {}) => {
      if (normalizeRoomCode(payload.roomCode) !== normalizedRouteRoomCode) {
        return;
      }

      removePresenceParticipant(payload.userId || payload.participantId);
    };

    const handleTypingUpdated = (payload = {}) => {
      if (
        normalizeRoomCode(payload.roomCode) !== normalizedRouteRoomCode
        || !Array.isArray(payload.users)
      ) {
        return;
      }

      setTypingUsers(payload.users.filter((user) => user.userId !== sessionUserId));
    };

    const handleRoomClosed = (updatedRoom) => {
      applyRoomPayload(updatedRoom);
    };

    const handleUserKicked = (payload) => {
      if (payload?.targetUserId && payload.targetUserId !== sessionUserId) {
        return;
      }

      setToast({
        tone: "error",
        message: payload?.message || "You were removed from the room"
      });
      redirectHomeSoon();
    };

    const handleRoomError = (payload) => {
      const message = payload?.message || "Realtime room connection failed";

      setToast({
        tone: "error",
        message
      });

      if (/participant not found|room not found|room is closed/i.test(message)) {
        clearSession();
        setIsSocketRoomReady(false);
        navigate(ROUTES.HOME);
      }
    };

    const handlePresenceError = (payload) => {
      if (import.meta.env.DEV) {
        console.warn("Presence update failed:", payload?.message);
      }
    };

    socket.on(SOCKET_EVENTS.CONNECT, rejoinSocketRoom);
    socket.on(SOCKET_EVENTS.ROOM_JOINED, applyRoomPayload);
    socket.on(SOCKET_EVENTS.ROOM_RENAMED, applyRoomPayload);
    socket.on(SOCKET_EVENTS.ROOM_LOCKED, applyRoomPayload);
    socket.on(SOCKET_EVENTS.ROOM_CLOSED, handleRoomClosed);
    socket.on(SOCKET_EVENTS.USER_KICKED, handleUserKicked);
    socket.on(SOCKET_EVENTS.PARTICIPANTS_UPDATED, handleParticipantsUpdated);
    socket.on(SOCKET_EVENTS.ACTIVITY_UPDATED, handleActivityUpdated);
    socket.on(SOCKET_EVENTS.PRESENCE_JOIN, handlePresenceParticipant);
    socket.on(SOCKET_EVENTS.PRESENCE_LIST, handlePresenceList);
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresenceParticipant);
    socket.on(SOCKET_EVENTS.PRESENCE_LEAVE, handlePresenceLeave);
    socket.on(SOCKET_EVENTS.PRESENCE_TYPING, handlePresenceParticipant);
    socket.on(SOCKET_EVENTS.PRESENCE_STOP_TYPING, handlePresenceParticipant);
    socket.on(SOCKET_EVENTS.TYPING_UPDATED, handleTypingUpdated);
    socket.on(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
    socket.on(SOCKET_EVENTS.PRESENCE_ERROR, handlePresenceError);

    if (!socket.connected) {
      socket.connect();
    } else {
      rejoinSocketRoom();
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, rejoinSocketRoom);
      socket.off(SOCKET_EVENTS.ROOM_JOINED, applyRoomPayload);
      socket.off(SOCKET_EVENTS.ROOM_RENAMED, applyRoomPayload);
      socket.off(SOCKET_EVENTS.ROOM_LOCKED, applyRoomPayload);
      socket.off(SOCKET_EVENTS.ROOM_CLOSED, handleRoomClosed);
      socket.off(SOCKET_EVENTS.USER_KICKED, handleUserKicked);
      socket.off(SOCKET_EVENTS.PARTICIPANTS_UPDATED, handleParticipantsUpdated);
      socket.off(SOCKET_EVENTS.ACTIVITY_UPDATED, handleActivityUpdated);
      socket.off(SOCKET_EVENTS.PRESENCE_JOIN, handlePresenceParticipant);
      socket.off(SOCKET_EVENTS.PRESENCE_LIST, handlePresenceList);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresenceParticipant);
      socket.off(SOCKET_EVENTS.PRESENCE_LEAVE, handlePresenceLeave);
      socket.off(SOCKET_EVENTS.PRESENCE_TYPING, handlePresenceParticipant);
      socket.off(SOCKET_EVENTS.PRESENCE_STOP_TYPING, handlePresenceParticipant);
      socket.off(SOCKET_EVENTS.TYPING_UPDATED, handleTypingUpdated);
      socket.off(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
      socket.off(SOCKET_EVENTS.PRESENCE_ERROR, handlePresenceError);
    };
  }, [clearSession, navigate, normalizedRouteRoomCode, sessionRoomCode, sessionUserId, status]);

  if (status === "invalid") {
    return <Navigate replace to={ROUTES.HOME} />;
  }

  const handleLeave = () => {
    const finishLeave = () => {
      shouldDisconnectOnUnmountRef.current = true;

      if (socket.connected) {
        socket.disconnect();
      }

      clearSession();
      navigate(ROUTES.HOME);
    };

    if (socket.connected) {
      let timeoutId;
      let hasFinished = false;
      const finishOnce = () => {
        if (hasFinished) {
          return;
        }

        hasFinished = true;
        window.clearTimeout(timeoutId);
        finishLeave();
      };

      timeoutId = window.setTimeout(finishOnce, 500);
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, {
        roomCode: sessionRoomCode,
        userId: sessionUserId
      }, finishOnce);
      return;
    }

    finishLeave();
  };

  const handleRoomClosed = () => {
    redirectHomeSoon();
  };

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-4 text-body">
        <StatePanel
          description={error || "Checking your saved room identity and reconnecting the room workspace."}
          eyebrow="Room session"
          icon={<Loader2 className="animate-spin" size={22} />}
          title="Restoring room session"
        />
      </main>
    );
  }

  if (!room || !session) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-4 text-body">
        <StatePanel
          description="Room data is not available for this session."
          eyebrow="Room session"
          icon={<Loader2 className="animate-spin" size={22} />}
          title="Preparing workspace"
        />
      </main>
    );
  }

  const isEditorReady = Boolean(
    isSocketRoomReady
    && room.roomCode
    && sessionUserId
  );
  const activeSession = {
    ...session,
    isHost: session.isHost || room.hostId === session.userId
  };
  const activeParticipant = room.participants?.find(
    (participant) => participant.userId === sessionUserId
  );
  const sessionColor = session.color || activeParticipant?.color || "";

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-body">
      <Toast
        message={toast?.message}
        onClose={() => setToast(null)}
        tone={toast?.tone}
      />

      <RoomHeader onLeave={handleLeave} room={room} session={activeSession} />

      <section className="flex min-h-0 flex-1 flex-col md:flex-row">
        {isEditorReady ? (
          <CodeEditor
            initialDocument={room.document}
            initialVersion={room.documentVersion}
            roomCode={room.roomCode}
            userColor={sessionColor}
            userId={sessionUserId}
            username={sessionUsername}
          />
        ) : (
          <section className="grid min-h-[420px] flex-1 place-items-center bg-canvas p-6">
            <StatePanel
              description="Joining the realtime editor channel."
              eyebrow="Editor"
              icon={<Loader2 className="animate-spin" size={22} />}
              title="Opening document"
            />
          </section>
        )}
        <PresencePlaceholder
          activityLog={room.activityLog}
          participants={room.participants}
          typingUsers={typingUsers}
        />
      </section>

      <HostControls
        onNotify={setToast}
        onRoomClosed={handleRoomClosed}
        onRoomUpdate={setRoom}
        room={room}
        session={activeSession}
      />
    </main>
  );
};

export default RoomPage;
