const tones = {
  default: "border-border bg-elevated text-body",
  accent: "border-accent/40 bg-accent/10 text-[#a2c9ff]",
  success: "border-success/40 bg-success/10 text-[#7ee787]",
  warning: "border-warning/40 bg-warning/10 text-[#e3b341]",
  danger: "border-danger/40 bg-danger/10 text-[#ffb4ad]"
};

const Badge = ({ children, tone = "default", className = "" }) => {
  return (
    <span className={`inline-flex items-center gap-2 rounded border px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
