const OPTIONS = [0.5, 1, 1.5, 2];

export function ServingSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${
            value === opt
              ? "bg-cyan-accent text-black border-cyan-accent"
              : "border-white/10 text-white/60 hover:border-white/30"
          }`}
        >
          {opt}x
        </button>
      ))}
    </div>
  );
}
