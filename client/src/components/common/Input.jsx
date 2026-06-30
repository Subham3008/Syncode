const Input = ({
  label,
  hint,
  error,
  className = "",
  inputClassName = "",
  ...props
}) => {
  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </span>
      ) : null}
      <input
        className={`h-11 w-full rounded-md border border-border bg-canvas/90 px-3 text-sm text-heading outline-none transition duration-200 placeholder:text-muted hover:border-[#414752] focus:border-accent focus:bg-canvas focus:ring-4 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`}
        {...props}
      />
      {error ? <span className="mt-2 block text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="mt-2 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
};

export default Input;
