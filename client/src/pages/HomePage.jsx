import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Code2,
  Database,
  GitBranch,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Terminal
} from "lucide-react";
import Badge from "../components/common/Badge.jsx";
import Toast from "../components/common/Toast.jsx";
import CreateRoomForm from "../components/room/CreateRoomForm.jsx";
import JoinRoomForm from "../components/room/JoinRoomForm.jsx";
import { buildRoomPath } from "../constants/routes.js";
import { createRoom, joinRoom } from "../services/room.service.js";
import { useRoomSession } from "../hooks/useRoomSession.js";

const featureChips = [
  { label: "Live Rooms", icon: Radio, tone: "success" },
  { label: "Delta Sync", icon: GitBranch, tone: "accent" },
  { label: "Host Controls", icon: ShieldCheck, tone: "warning" },
  { label: "MongoDB Persistence", icon: Database, tone: "default" }
];

const stats = [
  { label: "Session identity", value: "room-based" },
  { label: "Transport", value: "Socket.io" },
  { label: "Stack", value: "MERN" }
];

const HomePage = () => {
  const navigate = useNavigate();
  const { saveSession } = useRoomSession();
  const [createUsername, setCreateUsername] = useState("");
  const [joinUsername, setJoinUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  const createDisabled = useMemo(() => createUsername.trim().length < 2, [createUsername]);
  const joinDisabled = useMemo(
    () => joinUsername.trim().length < 2 || roomCode.trim().length !== 6,
    [joinUsername, roomCode]
  );

  const handleRoomSuccess = (sessionPayload, message) => {
    const session = saveSession(sessionPayload);
    setToast({ tone: "success", message });
    navigate(buildRoomPath(session.roomCode));
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    setErrors({});
    setLoadingAction("create");

    try {
      const response = await createRoom({ username: createUsername });
      handleRoomSuccess(response.data, "Room created");
    } catch (error) {
      setErrors({ create: error.message });
      setToast({ tone: "error", message: error.message });
    } finally {
      setLoadingAction("");
    }
  };

  const handleJoinRoom = async (event) => {
    event.preventDefault();
    setErrors({});
    setLoadingAction("join");

    try {
      const response = await joinRoom({
        username: joinUsername,
        roomCode
      });
      handleRoomSuccess(response.data, "Room joined");
    } catch (error) {
      setErrors({ join: error.message });
      setToast({ tone: "error", message: error.message });
    } finally {
      setLoadingAction("");
    }
  };

  return (
    <main className="min-h-screen text-body">
      <Toast
        message={toast?.message}
        onClose={() => setToast(null)}
        tone={toast?.tone}
      />

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded border border-border bg-elevated text-accent">
            <Code2 size={18} />
          </div>
          <span className="text-sm font-semibold text-heading">Syncode</span>
        </div>
        <Badge tone="success">
          <span className="h-2 w-2 rounded-sm bg-success shadow-[0_0_12px_rgba(63,185,80,0.4)]" />
          Live-ready architecture
        </Badge>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-56px)] w-full max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:px-8">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-xs font-medium text-muted shadow-xl shadow-black/20">
            <Activity size={15} className="text-accent" />
            Collaborative room management
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold tracking-normal text-heading md:text-7xl">
            Syncode rooms for serious hackathon collaboration.
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-body">
            Build together. Ship faster.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
            Create a room, share the six-character code, and keep host authority tied to the room session without passwords or OAuth.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {featureChips.map((feature) => {
              const Icon = feature.icon;

              return (
                <Badge key={feature.label} tone={feature.tone}>
                  <Icon size={14} />
                  {feature.label}
                </Badge>
              );
            })}
          </div>

          <div className="mt-10 overflow-hidden rounded-md border border-border bg-surface shadow-2xl shadow-black/30">
            <div className="flex h-10 items-center justify-between border-b border-border bg-elevated px-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Terminal size={14} className="text-accent" />
                room-session.js
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm bg-danger" />
                <span className="h-2 w-2 rounded-sm bg-warning" />
                <span className="h-2 w-2 rounded-sm bg-success" />
              </div>
            </div>
            <div className="grid gap-0 md:grid-cols-[1fr_220px]">
              <div className="p-5 font-mono text-sm leading-7 text-muted">
                <p><span className="text-accent">const</span> <span className="text-heading">identity</span> = <span className="text-[#7ee787]">"displayName + generatedUserId"</span>;</p>
                <p><span className="text-accent">await</span> room.create({"{"} host: <span className="text-[#7ee787]">"Subham"</span> {"}"});</p>
                <p>socket.emit(<span className="text-[#7ee787]">"room:rejoin"</span>, session);</p>
              </div>
              <div className="border-t border-border p-4 md:border-l md:border-t-0">
                {stats.map((item) => (
                  <div className="flex items-center justify-between border-b border-border py-3 last:border-b-0" key={item.label}>
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</span>
                    <span className="font-mono text-xs text-heading">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-md border border-border bg-surface p-2 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-border px-3 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Room access</p>
                <h2 className="mt-1 text-base font-semibold text-heading">Create or join instantly</h2>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded border border-border bg-canvas text-accent">
                <LockKeyhole size={17} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <CreateRoomForm
                disabled={createDisabled}
                error={errors.create}
                loading={loadingAction === "create"}
                onSubmit={handleCreateRoom}
                onUsernameChange={setCreateUsername}
                username={createUsername}
              />
              <JoinRoomForm
                disabled={joinDisabled}
                error={errors.join}
                loading={loadingAction === "join"}
                onRoomCodeChange={setRoomCode}
                onSubmit={handleJoinRoom}
                onUsernameChange={setJoinUsername}
                roomCode={roomCode}
                username={joinUsername}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
