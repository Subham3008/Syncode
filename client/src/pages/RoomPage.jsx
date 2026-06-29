import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Code2, Loader2 } from "lucide-react";
import { ROUTES } from "../constants/routes.js";
import { rejoinRoom } from "../services/room.service.js";
import { useRoomSession } from "../hooks/useRoomSession.js";

const RoomPage = () => {
  const { roomCode } = useParams();
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

  return (
    <main className="min-h-screen bg-canvas text-body">
      <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2">
          <Code2 className="text-accent" size={20} />
          <span className="text-sm font-semibold text-heading">Syncode</span>
        </div>
        <div className="rounded border border-border bg-canvas px-3 py-1 font-mono text-xs text-accent">
          {roomCode}
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-48px)] place-items-center px-4">
        <div className="w-full max-w-lg rounded-md border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-elevated text-accent">
              {status === "loading" ? <Loader2 className="animate-spin" size={20} /> : <Code2 size={20} />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Room Workspace
              </p>
              <h1 className="text-xl font-semibold text-heading">
                {room?.roomName || "Restoring room session"}
              </h1>
            </div>
          </div>

          <p className="text-sm leading-6 text-muted">
            {error || "Room dashboard, host controls, editor placeholder, and presence panel will be built in the next UI feature."}
          </p>
        </div>
      </section>
    </main>
  );
};

export default RoomPage;
