import { Lock, Pencil, ShieldCheck, UserMinus, XCircle } from "lucide-react";
import Button from "../common/Button.jsx";
import Badge from "../common/Badge.jsx";

const HostControls = ({ room, session }) => {
  if (!session.isHost) {
    return null;
  }

  const participants = room.participants?.filter((participant) => !participant.isHost) ?? [];

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
        <Button size="sm" variant="secondary">
          <Pencil size={14} />
          Rename
        </Button>
        <Button size="sm" variant="secondary">
          <Lock size={14} />
          {room.isLocked ? "Unlock" : "Lock"}
        </Button>
        <Button size="sm" variant="danger">
          <XCircle size={14} />
          Close
        </Button>
        <Button disabled={participants.length === 0} size="sm" variant="secondary">
          <UserMinus size={14} />
          Kick
        </Button>
      </div>
    </section>
  );
};

export default HostControls;
