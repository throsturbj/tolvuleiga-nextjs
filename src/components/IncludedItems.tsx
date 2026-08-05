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
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
            isDark
              ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30"
              : "bg-[var(--color-accent)]/10 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20"
          }`}
          aria-hidden
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.42l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <div>
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
              isDark ? "text-white/40" : "text-gray-400"
            }`}
          >
            Innifalið
          </p>
          <p className={`text-xs ${isDark ? "text-white/55" : "text-gray-500"}`}>
            Með í leigunni
          </p>
        </div>
      </div>

      <ul
        className={`grid gap-2 ${multiCol ? "sm:grid-cols-2" : "grid-cols-1"}`}
        aria-label="Innifalið í leigu"
      >
        {items.map((item, i) => (
          <li
            key={`${item}-${i}`}
            className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 opacity-0 animate-[included-in_420ms_cubic-bezier(0.22,1,0.36,1)_forwards] transition-colors duration-300 ${
              isDark
                ? "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07] hover:ring-white/20"
                : "bg-gray-50/80 ring-1 ring-gray-200/80 hover:bg-white hover:ring-gray-300"
            }`}
            style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
          >
            <span
              className={`relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 ${
                isDark
                  ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/35"
                  : "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/25"
              }`}
              aria-hidden
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.42l2.793 2.793 6.793-6.793a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <span
              className={`min-w-0 text-sm font-medium leading-snug break-words ${
                isDark ? "text-white/80" : "text-gray-800"
              }`}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
