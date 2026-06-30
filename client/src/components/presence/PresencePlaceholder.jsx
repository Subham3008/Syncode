import {
  Activity,
  Circle,
  Crown,
  UsersRound
} from "lucide-react";

const getTypingLabel = (typingUsers = []) => {
  if (typingUsers.length === 0) {
    return "";
  }

  if (typingUsers.length === 1) {
    return `${typingUsers[0].username} is typing`;
  }

  if (typingUsers.length === 2) {
    return `${typingUsers[0].username} and ${typingUsers[1].username} are typing`;
  }

  return `${typingUsers[0].username} and ${typingUsers.length - 1} others are typing`;
};

const activityStyles = {
  room_created: {
    accent: "#58a6ff",
    label: "Created",
    surface: "rgba(88, 166, 255, 0.08)"
  },
  user_joined: {
    accent: "#34d399",
    label: "Joined",
    surface: "rgba(52, 211, 153, 0.08)"
  },
  user_rejoined: {
    accent: "#22d3ee",
    label: "Rejoined",
    surface: "rgba(34, 211, 238, 0.08)"
  },
  user_left: {
    accent: "#f59e0b",
    label: "Left",
    surface: "rgba(245, 158, 11, 0.08)"
  },
  room_renamed: {
    accent: "#a78bfa",
    label: "Renamed",
    surface: "rgba(167, 139, 250, 0.08)"
  },
  user_kicked: {
    accent: "#fb7185",
    label: "Removed",
    surface: "rgba(251, 113, 133, 0.08)"
  },
  room_locked: {
    accent: "#f97316",
    label: "Locked",
    surface: "rgba(249, 115, 22, 0.08)"
  },
  room_unlocked: {
    accent: "#84cc16",
    label: "Unlocked",
    surface: "rgba(132, 204, 22, 0.08)"
  },
  room_closed: {
    accent: "#f87171",
    label: "Closed",
    surface: "rgba(248, 113, 113, 0.08)"
  }
};

const fallbackActivityStyle = {
  accent: "#58a6ff",
  label: "Update",
  surface: "rgba(88, 166, 255, 0.08)"
};

const formatActivityTime = (timestamp) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const PresencePlaceholder = ({
  participants = [],
  activityLog = [],
  typingUsers = []
}) => {
  const typingLabel = getTypingLabel(typingUsers);
  const orderedActivity = [...activityLog].reverse();

  return (
    <aside className="flex min-h-0 w-full flex-col border-border bg-[#111820] md:w-[300px] md:border-l">
      <section className="border-b border-border p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UsersRound size={15} className="text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Collaborators
            </h2>
          </div>
          <span className="rounded border border-border bg-[#0b1017] px-2 py-1 font-mono text-[11px] text-muted">
            {participants.filter((participant) => participant.isOnline).length} online
          </span>
        </div>
        {typingLabel ? (
          <div className="mb-4 rounded border border-accent/30 bg-accent/10 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-heading">
              <span className="flex h-4 items-center gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
              </span>
              <span className="truncate">{typingLabel}</span>
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              className="flex items-center justify-between rounded border border-border bg-[#0b1017] px-3 py-2.5 transition hover:border-[#3b4654]"
              key={participant.userId}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-xs font-semibold text-white"
                  style={{ backgroundColor: participant.color }}
                >
                  {participant.username?.charAt(0)?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-sm text-heading">{participant.username}</span>
                  <span className={`block truncate text-[11px] font-medium ${
                    participant.isTyping ? "text-accent" : "text-muted"
                  }`}>
                    {participant.isTyping ? "Editing now" : participant.isOnline ? "Connected" : "Offline"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Circle
                  className={participant.isOnline ? "fill-success text-success" : "fill-muted text-muted"}
                  size={9}
                />
                {participant.isHost ? (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-warning/40 bg-warning/10 text-warning"
                    title="Host"
                  >
                    <Crown size={12} />
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div className="mb-4 flex items-center gap-2">
          <Activity size={15} className="text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Activity
          </h2>
          {activityLog.length ? (
            <span className="ml-auto rounded border border-border bg-[#0b1017] px-2 py-1 font-mono text-[11px] text-muted">
              {activityLog.length}
            </span>
          ) : null}
        </div>
        <div
          className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
          style={{ scrollbarGutter: "stable" }}
        >
          {orderedActivity.map((activity, index) => {
            const meta = activityStyles[activity.type] ?? fallbackActivityStyle;
            const time = formatActivityTime(activity.timestamp);

            return (
              <article
                className="group relative overflow-hidden rounded border border-[#27313d] bg-[#0b1017] p-3 transition hover:border-[#3d4b5c]"
                key={`${activity.timestamp}-${activity.type}-${index}`}
                style={{
                  background: `linear-gradient(135deg, ${meta.surface}, rgba(11, 16, 23, 0.96) 46%)`
                }}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: meta.accent }}
                />
                <div className="min-w-0 pl-2">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{
                        backgroundColor: meta.surface,
                        color: meta.accent
                      }}
                    >
                      {meta.label}
                    </span>
                    {time ? (
                      <time className="font-mono text-[11px] text-muted" dateTime={activity.timestamp}>
                        {time}
                      </time>
                    ) : null}
                  </div>
                  <p className="break-words text-sm leading-5 text-body">
                    {activity.message}
                  </p>
                </div>
              </article>
            );
          })}
          {activityLog.length === 0 ? (
            <p className="rounded border border-border bg-[#0b1017] px-3 py-3 text-sm text-muted">
              No room activity yet.
            </p>
          ) : null}
        </div>
      </section>
    </aside>
  );
};

export default PresencePlaceholder;
