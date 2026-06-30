import { Code2 } from "lucide-react";

const AppShell = ({ children }) => (
  <div className="home-shell min-h-screen overflow-hidden text-body">
    <header className="relative z-20 mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
      <a aria-label="Syncode home" className="inline-flex items-center gap-2.5 text-heading" href="/">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-accent shadow-lg shadow-black/20">
          <Code2 size={17} strokeWidth={2.2} />
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.02em]">Syncode</span>
      </a>
      <p className="hidden text-xs text-muted sm:block">No account required</p>
    </header>
    {children}
  </div>
);

export default AppShell;
