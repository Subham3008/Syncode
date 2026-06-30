import { Loader2 } from "lucide-react";

const variants = {
  primary: "border-accent/50 bg-accent text-white shadow-[0_10px_28px_rgba(88,166,255,0.24)] hover:border-[#8cc8ff] hover:bg-[#79b8ff] hover:shadow-[0_14px_34px_rgba(88,166,255,0.32)]",
  secondary: "border-border bg-transparent text-body hover:border-accent/40 hover:bg-elevated hover:text-heading",
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
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none ${variants[variant]} ${sizes[size]} ${className}`}
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
