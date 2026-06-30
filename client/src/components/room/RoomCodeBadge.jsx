import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyToClipboard } from "../../utils/copyToClipboard.js";

const RoomCodeBadge = ({ roomCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(roomCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded border border-border bg-canvas px-3 font-mono text-xs font-semibold text-accent transition hover:border-accent/50 hover:bg-elevated"
      onClick={handleCopy}
      title="Copy room code"
      type="button"
    >
      <span>{roomCode}</span>
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  );
};

export default RoomCodeBadge;
