import { Activity, Circle, Crown, Users } from "lucide-react";

const formatActivityTime = (timestamp) => {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
};

const activityToneClasses = {
  room_created: "border-accent/35 bg-accent/10 text-[#a2c9ff]",
  user_joined: "border-success/35 bg-success/10 text-[#7ee787]",
  user_rejoined: "border-success/35 bg-success/10 text-[#7ee787]",
  user_left: "border-danger/35 bg-danger/10 text-[#ffb4ad]",
  user_kicked: "border-danger/45 bg-danger/15 text-[#ffb4ad]",
  room_closed: "border-danger/45 bg-danger/15 text-[#ffb4ad]",
  room_locked: "border-warning/35 bg-warning/10 text-[#e3b341]",
  room_unlocked: "border-success/35 bg-success/10 text-[#7ee787]",
  room_renamed: "border-accent/35 bg-accent/10 text-[#a2c9ff]"
};

const getActivityToneClass = (type) =>
  activityToneClasses[type] ?? "border-border bg-canvas/80 text-body";

const PresencePlaceholder = ({ participants = [], activityLog = [] }) => {
  const onlineCount = participants.filter((participant) => participant.isOnline).length;
  const recentActivity = activityLog.slice(-30).reverse();

  return (
    <aside className="hidden min-h-0 w-[320px] shrink-0 flex-col border-l border-border bg-surface md:flex">
      <section className="shrink-0 border-b border-border p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Participants
            </h2>
          </div>
          <span className="font-mono text-xs text-muted">{onlineCount}/{participants.length}</span>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {participants.map((participant) => (
            <div
              className="flex items-center justify-between rounded border border-border bg-canvas px-3 py-2 shadow-sm shadow-black/10"
              key={participant.userId}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-xs font-semibold text-white"
                  style={{ backgroundColor: participant.color }}
                >
                  {participant.username?.charAt(0)?.toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-sm text-heading">
                    {participant.username}
                    {participant.isHost ? <Crown className="shrink-0 text-warning" size={12} /> : null}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {participant.isOnline ? "Online" : "Offline"}
                  </span>
                </span>
              </div>
              <Circle
                className={participant.isOnline ? "fill-success text-success" : "fill-muted text-muted"}
                size={9}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Activity
            </h2>
          </div>
          <span className="font-mono text-[11px] text-muted">{activityLog.length}</span>
        </div>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {recentActivity.map((activity, index) => {
            const toneClass = getActivityToneClass(activity.type);

            return (
              <div
                className={`rounded border px-3 py-2 transition hover:brightness-110 ${toneClass}`}
                key={`${activity.timestamp}-${index}`}
              >
                <p className="truncate text-xs font-semibold" title={activity.message}>
                  {activity.message}
                </p>
                <p className="mt-1 font-mono text-[10px] text-current opacity-70">
                  {formatActivityTime(activity.timestamp)}
                </p>
              </div>
            );
          })}
          {activityLog.length === 0 ? (
            <p className="rounded border border-border bg-canvas px-3 py-2 text-sm text-muted">
              Activity will appear as the room changes.
            </p>
          ) : null}
        </div>
      </section>
    </aside>
  );
};

export default PresencePlaceholder;
