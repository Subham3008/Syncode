import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import {
  Activity,
  Play,
  Terminal
} from "lucide-react";
import Badge from "../components/common/Badge.jsx";
import Toast from "../components/common/Toast.jsx";
import CreateRoomForm from "../components/room/CreateRoomForm.jsx";
import JoinRoomForm from "../components/room/JoinRoomForm.jsx";
import { buildRoomPath } from "../constants/routes.js";
import { createRoom, joinRoom } from "../services/room.service.js";
import { useRoomSession } from "../hooks/useRoomSession.js";

const proofPoints = [
  { label: "Invite", value: "Share one room code" },
  { label: "Presence", value: "See who is online" },
  { label: "Control", value: "Host-managed rooms" },
  { label: "Continuity", value: "Reconnect cleanly" }
];

const HomePage = () => {
  const heroRef = useRef(null);
  const terminalOutputRef = useRef(null);
  const navigate = useNavigate();
  const { saveSession } = useRoomSession();
  const [createUsername, setCreateUsername] = useState("");
  const [joinUsername, setJoinUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [terminalState, setTerminalState] = useState("idle");

  const createDisabled = useMemo(() => createUsername.trim().length < 2, [createUsername]);
  const joinDisabled = useMemo(
    () => joinUsername.trim().length < 2 || roomCode.trim().length !== 6,
    [joinUsername, roomCode]
  );

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      return undefined;
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          duration: 0.72,
          ease: "power3.out"
        }
      });

      timeline
        .from("[data-hero-animate]", {
          autoAlpha: 0,
          y: 28,
          stagger: 0.08
        })
        .from("[data-access-panel]", {
          autoAlpha: 0,
          scale: 0.98,
          y: 20
        }, "-=0.42");

      gsap.to("[data-code-card]", {
        y: -8,
        duration: 3.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true
      });
    }, heroRef);

    return () => context.revert();
  }, []);

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

  const handleRunTerminal = () => {
    if (terminalState === "running") {
      return;
    }

    setTerminalState("running");

    window.setTimeout(() => {
      setTerminalState("done");
      window.requestAnimationFrame(() => {
        if (!terminalOutputRef.current) {
          return;
        }

        gsap.fromTo(
          terminalOutputRef.current.querySelectorAll("[data-output-line]"),
          { autoAlpha: 0, y: 10 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.42,
            ease: "power2.out",
            stagger: 0.08
          }
        );
      });
    }, 700);
  };

  return (
    <main className="min-h-screen text-body">
      <Toast
        message={toast?.message}
        onClose={() => setToast(null)}
        tone={toast?.tone}
      />

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur">
        <span className="text-base font-semibold tracking-normal text-heading">Syncode</span>
        <Badge tone="success" className="px-3 py-1.5">
          Live workspace ready
        </Badge>
      </header>

      <section
        className="mx-auto grid min-h-[calc(100vh-56px)] w-full max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:px-8"
        ref={heroRef}
      >
        <div className="max-w-3xl">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-xs font-medium text-muted shadow-xl shadow-black/20"
            data-hero-animate
          >
            <Activity size={15} className="text-accent" />
            Real-time coding workspace
          </div>

          <h1
            className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-normal text-heading md:text-6xl"
            data-hero-animate
          >
            Code together in a shared room, instantly.
          </h1>
          <p
            className="mt-5 max-w-2xl text-lg leading-8 text-body md:text-xl"
            data-hero-animate
          >
            Create a private coding room, invite teammates with a short code, and collaborate on the same document in real time.
          </p>
          <p
            className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-base"
            data-hero-animate
          >
            No accounts or setup flow. Each room keeps lightweight identity, host permissions, participant presence, and saved workspace state.
          </p>

          <div
            className="mt-8 grid max-w-2xl gap-2 sm:grid-cols-2"
            data-hero-animate
          >
            {proofPoints.map((item) => (
              <div
                className="group border-l border-border bg-surface/45 px-4 py-3 transition hover:border-accent hover:bg-surface"
                key={item.label}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted group-hover:text-accent">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-medium text-heading">{item.value}</p>
              </div>
            ))}
          </div>

          <div
            className="mt-10 overflow-hidden rounded-md border border-border bg-surface shadow-2xl shadow-black/30"
            data-code-card
            data-hero-animate
          >
            <div className="flex h-10 items-center justify-between border-b border-border bg-elevated px-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Terminal size={14} className="text-accent" />
                hackathonWinner.js
              </div>
              <button
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-accent/40 bg-accent px-3 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_8px_22px_rgba(88,166,255,0.28)] transition hover:border-[#8cc8ff] hover:bg-[#79b8ff] hover:shadow-[0_10px_28px_rgba(88,166,255,0.36)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-75"
                disabled={terminalState === "running"}
                onClick={handleRunTerminal}
                type="button"
              >
                <Play size={12} fill="currentColor" />
                {terminalState === "running" ? "Running" : "Run"}
              </button>
            </div>
            <div className="p-5 font-mono text-sm leading-7 text-muted md:p-6">
              <p><span className="text-muted">{"// live from Syncode"}</span></p>
              <p><span className="text-accent">const</span> <span className="text-heading">me</span> = <span className="text-[#7ee787]">"I am the winner of this hackathon lol!"</span>;</p>
              <p><span className="text-accent">await</span> room.join(<span className="text-[#7ee787]">"TRP8ZO"</span>);</p>
              <p>console.log(<span className="text-heading">me</span>);</p>

              {terminalState !== "idle" ? (
                <div
                  className="mt-5 border-t border-border pt-4"
                  ref={terminalOutputRef}
                >
                  <p className="text-xs text-muted" data-output-line>
                    <span className="text-accent">syncode</span>
                    <span className="text-muted"> run ./hackathonWinner.js</span>
                    {terminalState === "running" ? <span className="ml-1 animate-pulse text-heading">_</span> : null}
                  </p>
                  {terminalState === "done" ? (
                    <>
                      <p className="mt-2 text-[#7ee787]" data-output-line>
                        Room TRP8ZO joined successfully.
                      </p>
                      <p className="text-heading" data-output-line>
                        I am the winner of this hackathon lol!
                      </p>
                      <p className="text-xs text-muted" data-output-line>
                        Process finished in 0.7s
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4" data-access-panel>
          <div className="relative overflow-hidden rounded-md border border-border bg-surface/85 p-2 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            <div className="flex items-center justify-between border-b border-border px-3 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Room access</p>
                <h2 className="mt-1 text-base font-semibold text-heading">Start collaborating</h2>
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
