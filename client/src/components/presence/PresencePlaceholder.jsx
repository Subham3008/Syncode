import { Activity, Circle, Crown } from "lucide-react";

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

const PresencePlaceholder = ({
  participants = [],
  activityLog = [],
  typingUsers = []
}) => {
  const typingLabel = getTypingLabel(typingUsers);

  return (
    <aside className="flex w-full flex-col border-border bg-surface md:w-[280px] md:border-l">
      <section className="border-b border-border p-4">
        <div className="mb-4 flex items-center gap-2">
          <Activity size={15} className="text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Presence
          </h2>
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
              className="flex items-center justify-between rounded border border-border bg-canvas px-3 py-2"
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
                  {participant.isTyping ? (
                    <span className="block truncate text-[11px] font-medium text-accent">
                      Editing...
                    </span>
                  ) : null}
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

      <section className="min-h-0 flex-1 overflow-y-auto p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          Activity
        </h2>
        <div className="space-y-3">
          {activityLog.slice(-8).reverse().map((activity, index) => (
            <div className="border-l border-border pl-3" key={`${activity.timestamp}-${index}`}>
              <p className="text-sm text-body">{activity.message}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">{activity.type}</p>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
};

export default PresencePlaceholder;
