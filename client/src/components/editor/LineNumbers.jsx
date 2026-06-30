import { memo } from "react";

const getLineNumbers = (lineCount) =>
  Array.from({ length: Math.max(lineCount, 1) }, (_, index) => index + 1);

const LineNumbers = ({ lineCount = 1, scrollTop = 0 }) => {
  return (
    <div
      aria-hidden="true"
      className="relative w-12 shrink-0 overflow-hidden border-r border-border bg-[#0b1017] font-mono text-[13px] leading-6 text-[#687280]"
    >
      <div
        className="px-3 py-4 text-right"
        style={{ transform: `translateY(-${scrollTop}px)` }}
      >
        {getLineNumbers(lineCount).map((lineNumber) => (
          <div className="h-6 select-none tabular-nums" key={lineNumber}>
            {lineNumber}
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(LineNumbers);
