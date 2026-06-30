import { useState } from "react";
import { Lock, Pencil, ShieldCheck, UserMinus, XCircle } from "lucide-react";
import Button from "../common/Button.jsx";
import Badge from "../common/Badge.jsx";
import Input from "../common/Input.jsx";
import Modal from "../common/Modal.jsx";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import { socket } from "../../socket/socket.js";

const HOST_ACTION_TIMEOUT_MS = 8000;

const emitHostAction = (eventName, payload) =>
  new Promise((resolve, reject) => {
    socket.timeout(HOST_ACTION_TIMEOUT_MS).emit(eventName, payload, (error, response = {}) => {
      if (error) {
        reject(new Error("Realtime host action timed out"));
        return;
      }

      if (!response.success) {
        reject(new Error(response.message || "Host action failed"));
        return;
      }

      resolve({ data: response.data });
    });
  });

const HostControls = ({ room, session, onRoomUpdate, onRoomClosed, onNotify }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [roomName, setRoomName] = useState(room.roomName);
  const [targetUserId, setTargetUserId] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");

  if (!session.isHost) {
    return null;
  }

  const participants = room.participants?.filter((participant) => !participant.isHost) ?? [];

  const closeModal = () => {
    setActiveModal(null);
    setTargetUserId("");
    setError("");
    setRoomName(room.roomName);
  };

  const runHostAction = async (actionName, action, successMessage) => {
    setLoadingAction(actionName);
    setError("");

    try {
      const response = await action();
      onRoomUpdate?.(response.data);
      onNotify?.({ tone: "success", message: successMessage });
      closeModal();
      return response.data;
    } catch (requestError) {
      setError(requestError.message);
      onNotify?.({ tone: "error", message: requestError.message });
      return null;
    } finally {
      setLoadingAction("");
    }
  };

  const handleRename = () =>
    runHostAction(
      "rename",
      () =>
        emitHostAction(SOCKET_EVENTS.HOST_RENAME_ROOM, {
          roomCode: room.roomCode,
          userId: session.userId,
          roomName
        }),
      "Room renamed"
    );

  const handleLockToggle = () =>
    runHostAction(
      "lock",
      () =>
        emitHostAction(SOCKET_EVENTS.HOST_LOCK_ROOM, {
          roomCode: room.roomCode,
          userId: session.userId,
          isLocked: !room.isLocked
        }),
      room.isLocked ? "Room unlocked" : "Room locked"
    );

  const handleKick = () =>
    runHostAction(
      "kick",
      () =>
        emitHostAction(SOCKET_EVENTS.HOST_KICK_USER, {
          roomCode: room.roomCode,
          hostId: session.userId,
          targetUserId
        }),
      "Participant removed"
    );

  const handleCloseRoom = async () => {
    const updatedRoom = await runHostAction(
      "close",
      () =>
        emitHostAction(SOCKET_EVENTS.HOST_CLOSE_ROOM, {
          roomCode: room.roomCode,
          userId: session.userId
        }),
      "Room closed"
    );

    if (updatedRoom) {
      onRoomClosed?.(updatedRoom);
    }
  };

  return (
    <section className="border-t border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Host controls</p>
          <h2 className="mt-1 text-sm font-semibold text-heading">Room authority</h2>
        </div>
        <Badge tone="warning">
          <ShieldCheck size={13} />
          Host only
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button onClick={() => setActiveModal("rename")} size="sm" variant="secondary">
          <Pencil size={14} />
          Rename
        </Button>
        <Button loading={loadingAction === "lock"} onClick={handleLockToggle} size="sm" variant="secondary">
          <Lock size={14} />
          {room.isLocked ? "Unlock" : "Lock"}
        </Button>
        <Button onClick={() => setActiveModal("close")} size="sm" variant="danger">
          <XCircle size={14} />
          Close
        </Button>
        <Button
          disabled={participants.length === 0}
          onClick={() => setActiveModal("kick")}
          size="sm"
          variant="secondary"
        >
          <UserMinus size={14} />
          Kick
        </Button>
      </div>

      <Modal
        description="Hosts can rename the workspace for everyone in the room."
        footer={(
          <>
            <Button onClick={closeModal} size="sm" variant="secondary">Cancel</Button>
            <Button
              disabled={roomName.trim().length < 3}
              loading={loadingAction === "rename"}
              onClick={handleRename}
              size="sm"
            >
              Save name
            </Button>
          </>
        )}
        onClose={closeModal}
        open={activeModal === "rename"}
        title="Rename room"
      >
        <Input
          error={error}
          label="Room name"
          maxLength={40}
          onChange={(event) => setRoomName(event.target.value)}
          placeholder="Team Alpha"
          value={roomName}
        />
      </Modal>

      <Modal
        description="Choose a participant to remove from this room. The host cannot remove themselves."
        footer={(
          <>
            <Button onClick={closeModal} size="sm" variant="secondary">Cancel</Button>
            <Button
              disabled={!targetUserId}
              loading={loadingAction === "kick"}
              onClick={handleKick}
              size="sm"
              variant="danger"
            >
              Remove participant
            </Button>
          </>
        )}
        onClose={closeModal}
        open={activeModal === "kick"}
        title="Kick participant"
      >
        <div className="space-y-2">
          {participants.map((participant) => (
            <label
              className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 transition ${targetUserId === participant.userId ? "border-accent bg-accent/10" : "border-border bg-canvas hover:bg-elevated"}`}
              key={participant.userId}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded text-xs font-semibold text-white"
                  style={{ backgroundColor: participant.color }}
                >
                  {participant.username?.charAt(0)?.toUpperCase()}
                </span>
                <span className="truncate text-sm text-heading">{participant.username}</span>
              </span>
              <input
                checked={targetUserId === participant.userId}
                className="h-4 w-4 accent-[#58a6ff]"
                onChange={() => setTargetUserId(participant.userId)}
                type="radio"
              />
            </label>
          ))}
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        description="Closing a room marks it inactive. New joins and rejoins will be blocked."
        footer={(
          <>
            <Button onClick={closeModal} size="sm" variant="secondary">Cancel</Button>
            <Button
              loading={loadingAction === "close"}
              onClick={handleCloseRoom}
              size="sm"
              variant="danger"
            >
              Close room
            </Button>
          </>
        )}
        onClose={closeModal}
        open={activeModal === "close"}
        title="Close room?"
      >
        <div className="rounded border border-danger/30 bg-danger/10 p-3 text-sm leading-6 text-[#ffb4ad]">
          This will end the room for everyone. Use this only when the collaboration session is finished.
        </div>
        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
      </Modal>
    </section>
  );
};

export default HostControls;
