import { Activity, Circle } from "lucide-react";

const PresencePlaceholder = ({ participants = [], activityLog = [] }) => {
  return (
    <aside className="flex w-full flex-col border-border bg-surface md:w-[280px] md:border-l">
      <section className="border-b border-border p-4">
        <div className="mb-4 flex items-center gap-2">
          <Activity size={15} className="text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Presence
          </h2>
        </div>
        <p className="mb-4 text-sm leading-6 text-muted">
          Realtime presence panel will be implemented by Akhil.
        </p>
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
                <span className="truncate text-sm text-heading">{participant.username}</span>
              </div>
              <Circle
                className={participant.isOnline ? "fill-success text-success" : "fill-muted text-muted"}
                size={9}
              />
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
