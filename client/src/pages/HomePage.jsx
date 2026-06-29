import { Code2, Radio, ShieldCheck, Sparkles } from "lucide-react";
import Button from "../components/common/Button.jsx";

const features = [
  { label: "Live Rooms", icon: Radio },
  { label: "Delta Sync Ready", icon: Sparkles },
  { label: "Host Controls", icon: ShieldCheck }
];

const HomePage = () => {
  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
            <Code2 size={16} />
            Real-time collaborative coding
          </div>

          <h1 className="text-5xl font-semibold tracking-normal text-white md:text-7xl">
            Syncode
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-300">
            Build together. Ship faster.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <span
                  key={feature.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-slate-200"
                >
                  <Icon size={15} />
                  {feature.label}
                </span>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button disabled>Room flows coming on Domain A branch</Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
