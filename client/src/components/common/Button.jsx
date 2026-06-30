import { Loader2 } from "lucide-react";

const variants = {
  primary: "border-accent bg-accent text-white hover:bg-[#79b8ff]",
  secondary: "border-border bg-transparent text-body hover:bg-elevated hover:text-heading",
  danger: "border-danger/40 bg-danger/10 text-[#ffb4ad] hover:bg-danger/15"
};

const sizes = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm"
};

const Button = ({
  className = "",
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded border font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : null}
      {children}
    </button>
  );
};

export default Button;
