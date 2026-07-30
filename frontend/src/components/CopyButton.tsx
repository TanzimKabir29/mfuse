import { useEffect, useRef, useState } from "react";

const RESET_DELAY_MS = 2000;

interface CopyButtonProps {
  value: string;
  label?: string;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  async function handleClick() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), RESET_DELAY_MS);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95 ${
        copied
          ? "bg-success text-white"
          : "bg-accent text-accent-contrast hover:bg-accent-hover"
      }`}
    >
      {copied ? (
        <>
          <CheckIcon />
          Copied
        </>
      ) : (
        label
      )}
    </button>
  );
}

export default CopyButton;
