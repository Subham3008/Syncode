import { useEffect, useState } from "react";
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

const RoomPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { session, saveSession, clearSession } = useRoomSession();
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [isSocketRoomReady, setIsSocketRoomReady] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const sessionRoomCode = session?.roomCode;
  const sessionUserId = session?.userId;
  const sessionUsername = session?.username;

  const redirectHomeSoon = () => {
    window.setTimeout(() => {
      clearSession();
      navigate(ROUTES.HOME);
    }, 900);
  };

  useEffect(() => {
    const restoreRoom = async () => {
      if (!sessionRoomCode || !sessionUserId || sessionRoomCode !== roomCode) {
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
  }, [clearSession, roomCode, saveSession, sessionRoomCode, sessionUserId]);

  useEffect(() => {
    if (status !== "ready" || !sessionRoomCode || !sessionUserId) {
      return undefined;
    }

    setIsSocketRoomReady(false);

    const rejoinSocketRoom = () => {
      socket.emit(SOCKET_EVENTS.ROOM_REJOIN, {
        roomCode: sessionRoomCode,
        userId: sessionUserId
      });
    };

    const applyRoomPayload = (payload) => {
      const nextRoom = payload?.room ?? payload;

      if (nextRoom?.roomCode === roomCode) {
        setRoom((currentRoom) => ({
          ...currentRoom,
          ...nextRoom
        }));
        setIsSocketRoomReady(true);
      }
    };

    const handleParticipantsUpdated = (participants) => {
      setRoom((currentRoom) => currentRoom ? { ...currentRoom, participants } : currentRoom);
    };

    const handleActivityUpdated = (activityLog) => {
      setRoom((currentRoom) => currentRoom ? { ...currentRoom, activityLog } : currentRoom);
    };

    const handleTypingUpdated = (payload = {}) => {
      if (payload.roomCode !== roomCode || !Array.isArray(payload.users)) {
        return;
      }

      setTypingUsers(payload.users.filter((user) => user.userId !== sessionUserId));
    };

    const handleRoomClosed = (updatedRoom) => {
      applyRoomPayload(updatedRoom);
      setTypingUsers([]);
      setToast({ tone: "error", message: "Room was closed by the host" });
      redirectHomeSoon();
    };

    const handleUserKicked = (payload) => {
      setToast({
        tone: "error",
        message: payload?.message || "You were removed from the room"
      });
      redirectHomeSoon();
    };

    const handleRoomError = (payload) => {
      setToast({
        tone: "error",
        message: payload?.message || "Realtime room connection failed"
      });
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
      socket.off(SOCKET_EVENTS.TYPING_UPDATED, handleTypingUpdated);
      socket.off(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
      socket.off(SOCKET_EVENTS.PRESENCE_ERROR, handlePresenceError);

      if (socket.connected) {
        socket.disconnect();
      }

      setIsSocketRoomReady(false);
      setTypingUsers([]);
    };
  }, [clearSession, navigate, roomCode, sessionRoomCode, sessionUserId, status]);

  if (status === "invalid") {
    return <Navigate replace to={ROUTES.HOME} />;
  }

  const handleLeave = () => {
    if (socket.connected) {
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, {
        roomCode: sessionRoomCode,
        userId: sessionUserId
      });
      socket.disconnect();
    }

    clearSession();
    navigate(ROUTES.HOME);
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
