import { LogIn } from "lucide-react";
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
      className="rounded-md border border-border bg-surface p-5"
      onSubmit={onSubmit}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Join
          </p>
          <h2 className="mt-1 text-lg font-semibold text-heading">Use room code</h2>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded border border-border bg-elevated text-accent">
          <LogIn size={18} />
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
