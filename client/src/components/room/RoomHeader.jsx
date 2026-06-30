import { Code2, LogOut, UsersRound } from "lucide-react";
import Badge from "../common/Badge.jsx";
import Button from "../common/Button.jsx";
import RoomCodeBadge from "./RoomCodeBadge.jsx";

const RoomHeader = ({ room, session, onLeave }) => {
  const onlineCount = room.participants?.filter((participant) => participant.isOnline).length ?? 0;

  return (
    <header className="flex min-h-14 flex-col gap-3 border-b border-border bg-[#111820] px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-border bg-[#0b1017] text-accent">
          <Code2 size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold text-heading">{room.roomName}</h1>
            {session.isHost ? <Badge tone="warning">Host</Badge> : null}
            {room.isLocked ? <Badge tone="danger">Locked</Badge> : <Badge tone="success">Open</Badge>}
          </div>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
            <UsersRound size={13} />
            {onlineCount} collaborator{onlineCount === 1 ? "" : "s"} online
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RoomCodeBadge roomCode={room.roomCode} />
        <Button onClick={onLeave} size="sm" variant="secondary">
          <LogOut size={14} />
          Leave
        </Button>
      </div>
    </header>
  );
};

export default RoomHeader;
