import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import EditorPlaceholder from "../components/editor/EditorPlaceholder.jsx";
import PresencePlaceholder from "../components/presence/PresencePlaceholder.jsx";
import HostControls from "../components/room/HostControls.jsx";
import RoomHeader from "../components/room/RoomHeader.jsx";
import { ROUTES } from "../constants/routes.js";
import { rejoinRoom } from "../services/room.service.js";
import { useRoomSession } from "../hooks/useRoomSession.js";

const RoomPage = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { session, saveSession, clearSession } = useRoomSession();
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const sessionRoomCode = session?.roomCode;
  const sessionUserId = session?.userId;

  useEffect(() => {
    const restoreRoom = async () => {
      if (sessionRoomCode !== roomCode || !sessionUserId) {
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
        setError(requestError.message);
        clearSession();
        setStatus("invalid");
      }
    };

    restoreRoom();
  }, [clearSession, roomCode, saveSession, sessionRoomCode, sessionUserId]);

  if (status === "invalid") {
    return <Navigate replace to={ROUTES.HOME} />;
  }

  const handleLeave = () => {
    clearSession();
    navigate(ROUTES.HOME);
  };

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-4 text-body">
        <div className="w-full max-w-md rounded-md border border-border bg-surface p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded border border-border bg-elevated text-accent">
            <Loader2 className="animate-spin" size={22} />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-heading">Restoring room session</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {error || "Checking your saved room identity."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-body">
      <RoomHeader onLeave={handleLeave} room={room} session={session} />

      <section className="flex min-h-0 flex-1 flex-col md:flex-row">
        <EditorPlaceholder document={room.document} />
        <PresencePlaceholder
          activityLog={room.activityLog}
          participants={room.participants}
        />
      </section>

      <HostControls room={room} session={session} />
    </main>
  );
};

export default RoomPage;
