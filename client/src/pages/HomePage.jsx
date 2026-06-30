import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Code2,
  Loader2,
  LockKeyhole,
  Play,
  Terminal
} from "lucide-react";
import Toast from "../components/common/Toast.jsx";
import CreateRoomForm from "../components/room/CreateRoomForm.jsx";
import JoinRoomForm from "../components/room/JoinRoomForm.jsx";
import { buildRoomPath } from "../constants/routes.js";
import { createRoom, joinRoom } from "../services/room.service.js";
import { useRoomSession } from "../hooks/useRoomSession.js";

const initialDemoCode = `const room = {
  code: "SYNC24",
  file: "main.js",
  users: ["Rohit", "Subham", "Aman"]
};

console.log("Room:", room.code);
console.log("Editing:", room.file);
console.log("Online:", room.users.join(", "));`;

const RUNNING_STATE_MIN_MS = 600;

const createRunnerWorkerSource = () => `
const formatValue = (value) => {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

self.onmessage = async (event) => {
  const logs = [];
  const consoleProxy = {
    log: (...values) => logs.push(values.map(formatValue).join(" ")),
    info: (...values) => logs.push(values.map(formatValue).join(" ")),
    warn: (...values) => logs.push("Warning: " + values.map(formatValue).join(" ")),
    error: (...values) => logs.push("Error: " + values.map(formatValue).join(" "))
  };

  try {
    const run = new Function("console", '"use strict";\\n' + event.data.code);
    const result = run(consoleProxy);
    const resolved = result && typeof result.then === "function" ? await result : result;

    if (resolved !== undefined) {
      logs.push("Returned: " + formatValue(resolved));
    }

    self.postMessage({ ok: true, logs });
  } catch (error) {
    self.postMessage({
      ok: false,
      logs,
      error: error && error.message ? error.message : String(error)
    });
  }
};
`;

const HomePage = () => {
  const navigate = useNavigate();
  const { saveSession } = useRoomSession();
  const [createUsername, setCreateUsername] = useState("");
  const [joinUsername, setJoinUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [demoCode, setDemoCode] = useState(initialDemoCode);
  const [demoOutput, setDemoOutput] = useState([
    "Click Run to execute this JavaScript preview."
  ]);
  const [isRunningDemo, setIsRunningDemo] = useState(false);

  const createDisabled = useMemo(() => createUsername.trim().length < 2, [createUsername]);
  const joinDisabled = useMemo(
    () => joinUsername.trim().length < 2 || roomCode.trim().length !== 6,
    [joinUsername, roomCode]
  );
  const demoLineNumbers = useMemo(
    () => demoCode.split("\n").map((_, index) => index + 1),
    [demoCode]
  );

  const runDemoCode = () => {
    const startedAt = Date.now();

    setIsRunningDemo(true);
    setDemoOutput(["Running JavaScript..."]);

    const finishRun = (nextOutput) => {
      const remainingMs = Math.max(0, RUNNING_STATE_MIN_MS - (Date.now() - startedAt));

      window.setTimeout(() => {
        setIsRunningDemo(false);
        setDemoOutput(nextOutput);
      }, remainingMs);
    };

    const workerUrl = URL.createObjectURL(
      new Blob([createRunnerWorkerSource()], { type: "text/javascript" })
    );
    const worker = new Worker(workerUrl);
    const timeoutId = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      setIsRunningDemo(false);
      setDemoOutput(["Execution stopped: script took too long."]);
    }, 2500);

    worker.onmessage = (event) => {
      window.clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      setIsRunningDemo(false);

      const logs = Array.isArray(event.data.logs) ? event.data.logs : [];

      if (!event.data.ok) {
        finishRun([...logs, `Error: ${event.data.error || "JavaScript execution failed"}`]);
        return;
      }

      finishRun(logs.length ? logs : ["Done. No output was written."]);
    };

    worker.onerror = (error) => {
      window.clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      finishRun([`Error: ${error.message || "JavaScript execution failed"}`]);
    };

    worker.postMessage({ code: demoCode });
  };

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
    <main className="min-h-screen bg-[#0d1117] font-sans text-body">
      <Toast
        message={toast?.message}
        onClose={() => setToast(null)}
        tone={toast?.tone}
      />

      <header className="flex h-12 items-center justify-between border-b border-[#2b313a] bg-[#181f2a] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2 text-heading">
            <Code2 size={17} className="text-accent" />
            <span className="truncate text-sm font-semibold">Syncode</span>
          </div>
        </div>
        <p className="hidden truncate font-mono text-xs text-muted md:block">
          shared-workspace / main.js
        </p>
      </header>

      <section className="grid min-h-[calc(100vh-48px)] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-h-0 flex-col">
          <div className="flex h-10 items-center border-b border-[#2b313a] bg-[#111820]">
            <div className="flex h-full items-center gap-2 border-r border-[#2b313a] bg-[#0d1117] px-4 text-xs text-heading">
              <Code2 size={14} className="text-accent" />
              main.js
            </div>
          </div>

          <div className="grid flex-1 content-center gap-8 px-5 py-8 sm:px-8 lg:px-10">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded border border-[#2b313a] bg-[#111820] px-3 py-1.5 font-mono text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-success" />
                single-file collaborative editor
              </p>
              <h1 className="max-w-3xl text-[clamp(2.15rem,4.4vw,4.65rem)] font-bold leading-[1.02] text-heading">
                Open a shared coding room in seconds.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#b8c2cc] sm:text-lg">
                Create a workspace, share the six-character code, and let everyone edit the same file together with clear room ownership.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted">
                <span className="inline-flex items-center gap-2">
                  <ChevronRight size={15} className="text-accent" />
                  Keep one source of truth for the room file
                </span>
                <span className="inline-flex items-center gap-2">
                  <ChevronRight size={15} className="text-accent" />
                  Rejoin from the same browser tab after refresh
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded border border-[#2b313a] bg-[#0d1117] shadow-2xl shadow-black/35">
              <div className="flex h-9 items-center justify-between border-b border-[#2b313a] bg-[#111820] px-3">
                <div className="flex items-center gap-2 font-mono text-xs text-muted">
                  <Terminal size={14} className="text-accent" />
                  editor preview
                </div>
                <button
                  aria-label="Run JavaScript preview"
                  className="inline-flex h-7 items-center gap-1.5 rounded border border-border px-2 font-mono text-[11px] text-muted transition hover:border-accent hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isRunningDemo}
                  onClick={runDemoCode}
                  type="button"
                >
                  {isRunningDemo ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : (
                    <Play size={13} />
                  )}
                  {isRunningDemo ? "Running" : "Run"}
                </button>
              </div>
              <div className="grid min-h-[310px] grid-rows-[minmax(190px,1fr)_auto]">
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)]">
                  <div className="select-none border-r border-[#1f2937] bg-[#0b1017] px-2 py-4 text-right font-mono text-sm leading-6 text-[#5b6470]">
                    {demoLineNumbers.map((lineNumber) => (
                      <div key={lineNumber}>{lineNumber}</div>
                    ))}
                  </div>
                  <textarea
                    aria-label="JavaScript preview editor"
                    className="min-h-[190px] resize-none overflow-auto border-0 bg-[#0d1117] px-4 py-4 font-mono text-sm leading-6 text-[#c9d1d9] caret-accent outline-none selection:bg-accent/30"
                    onChange={(event) => setDemoCode(event.target.value)}
                    spellCheck={false}
                    value={demoCode}
                    wrap="off"
                  />
                </div>
                <div className="border-t border-[#2b313a] bg-[#070b10]">
                  <div className="flex h-8 items-center gap-2 border-b border-[#1f2937] px-3 font-mono text-xs text-muted">
                    <Terminal size={13} className="text-accent" />
                    output
                  </div>
                  <pre className="min-h-[74px] whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-5 text-[#b8c2cc]">
                    {demoOutput.join("\n")}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="border-l border-[#2b313a] bg-[#111820] p-4 lg:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase text-muted">Room access</p>
              <h2 className="mt-1 text-xl font-semibold text-heading">Start working together</h2>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded border border-border bg-[#0d1117] text-accent">
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
        </aside>
      </section>
    </main>
  );
};

export default HomePage;
