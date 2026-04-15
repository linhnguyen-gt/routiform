"use client";

interface WeightTotalBarProps {
  models: Array<{ model: string; weight: number }>;
}

export function WeightTotalBar({ models }: WeightTotalBarProps) {
  const total = models.reduce((sum, m) => sum + (m.weight || 0), 0);
  const isValid = total === 100;
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-indigo-500",
  ];

  return (
    <div className="mt-1.5">
      <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex">
        {models.map((m, i) => {
          if (!m.weight) return null;
          return (
            <div
              key={i}
              className={`${colors[i % colors.length]} transition-all duration-300`}
              style={{ width: `${Math.min(m.weight, 100)}%` }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex gap-1">
          {models.map(
            (m, i) =>
              m.weight > 0 && (
                <span key={i} className="flex items-center gap-0.5 text-[9px] text-text-muted">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${colors[i % colors.length]}`}
                  />
                  {m.weight}%
                </span>
              )
          )}
        </div>
        <span
          className={`text-[10px] font-medium ${
            isValid ? "text-emerald-500" : total > 100 ? "text-red-500" : "text-amber-500"
          }`}
        >
          {total}%{!isValid && total > 0 && " ≠ 100%"}
        </span>
      </div>
    </div>
  );
}
