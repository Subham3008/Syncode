import { Plus } from "lucide-react";
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
      className="rounded-md border border-border bg-surface p-5"
      onSubmit={onSubmit}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Start
          </p>
          <h2 className="mt-1 text-lg font-semibold text-heading">Create room</h2>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded border border-border bg-elevated text-accent">
          <Plus size={18} />
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
        value={username}
      />

      <Button className="mt-5 w-full" disabled={disabled} loading={loading} size="lg" type="submit">
        Generate room code
      </Button>
    </form>
  );
};

export default CreateRoomForm;
