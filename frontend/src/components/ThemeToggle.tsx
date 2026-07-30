import { useTheme, type Theme } from "../hooks/useTheme";

const THEMES: Theme[] = ["light", "dark", "system"];

function SunIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 101.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 14.596a.75.75 0 001.06 1.06l1.061-1.06a.75.75 0 10-1.06-1.06l-1.061 1.06zM5.404 5.404a.75.75 0 001.06 1.06l1.06-1.06a.75.75 0 10-1.06-1.06l-1.06 1.06z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "light") return <SunIcon />;
  if (theme === "dark") return <MoonIcon />;
  return <SystemIcon />;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md bg-surface border border-line p-0.5">
      {THEMES.map((option) => {
        const isActive = theme === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            title={option}
            aria-label={option}
            aria-pressed={isActive}
            className={`rounded p-1.5 transition-all duration-150 active:scale-90 ${
              isActive
                ? "bg-accent text-accent-contrast"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <ThemeIcon theme={option} />
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
