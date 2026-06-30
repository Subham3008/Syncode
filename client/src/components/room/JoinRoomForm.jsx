import Button from "../common/Button.jsx";
import Input from "../common/Input.jsx";

const JoinRoomForm = ({
  username,
  roomCode,
  onUsernameChange,
  onRoomCodeChange,
  onSubmit,
  loading,
  disabled,
  error
}) => {
  return (
    <form
      className="group relative overflow-hidden rounded-md border border-border bg-canvas/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-success/35 hover:bg-canvas/90"
      onSubmit={onSubmit}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-success/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Join
          </p>
          <h2 className="mt-1 text-lg font-semibold text-heading">Use room code</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Enter a teammate's code and pick up live.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Input
          autoComplete="name"
          disabled={loading}
          label="Display name"
          maxLength={24}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder="Rohit"
          required
          value={username}
        />
        <Input
          autoComplete="off"
          disabled={loading}
          error={error}
          inputClassName="font-mono uppercase tracking-[0.18em]"
          label="Room code"
          maxLength={6}
          onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="AB12CD"
          required
          value={roomCode}
        />
      </div>

      <Button className="mt-5 w-full" disabled={disabled} loading={loading} size="lg" type="submit">
        Join workspace
      </Button>
    </form>
  );
};

export default JoinRoomForm;
