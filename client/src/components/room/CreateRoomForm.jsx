import Button from "../common/Button.jsx";
import Input from "../common/Input.jsx";

const CreateRoomForm = ({
  username,
  onUsernameChange,
  onSubmit,
  loading,
  disabled,
  error
}) => {
  return (
    <form
      className="group relative overflow-hidden rounded-md border border-border bg-canvas/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-accent/35 hover:bg-canvas/90"
      onSubmit={onSubmit}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Start
          </p>
          <h2 className="mt-1 text-lg font-semibold text-heading">Create room</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Open a fresh workspace and become the host.
          </p>
        </div>
      </div>

      <Input
        autoComplete="name"
        disabled={loading}
        error={error}
        label="Display name"
        maxLength={24}
        onChange={(event) => onUsernameChange(event.target.value)}
        placeholder="Subham"
        required
        value={username}
      />

      <Button className="mt-5 w-full" disabled={disabled} loading={loading} size="lg" type="submit">
        Generate room code
      </Button>
    </form>
  );
};

export default CreateRoomForm;
