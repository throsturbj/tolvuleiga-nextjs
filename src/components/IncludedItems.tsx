"use client";

type IncludedItemsProps = {
  value?: string | null;
  /** Match the surrounding page theme */
  tone?: "light" | "dark";
  className?: string;
};

function parseIncluded(value: string | null | undefined): string[] {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function IncludedItems({
  value,
  tone = "light",
  className = "",
}: IncludedItemsProps) {
  const items = parseIncluded(value);
  if (items.length === 0) return null;

  const isDark = tone === "dark";
  const multiCol = items.length > 3;

  return (
    <div className={`min-w-0 ${className}`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
        Innifalið
      </p>

      <ul
        className={`grid gap-2 ${multiCol ? "sm:grid-cols-2" : "grid-cols-1"}`}
        aria-label="Innifalið"
      >
        {items.map((item, i) => (
          <li
            key={`${item}-${i}`}
            className={`min-w-0 rounded-xl px-3 py-2.5 text-sm font-medium leading-snug break-words opacity-0 animate-[included-in_420ms_cubic-bezier(0.22,1,0.36,1)_forwards] ${
              isDark
                ? "bg-white/[0.04] ring-1 ring-white/10 text-white/80"
                : "bg-gray-50/80 ring-1 ring-gray-200/80 text-gray-800"
            }`}
            style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
