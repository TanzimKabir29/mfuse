import { useQueryClient } from "@tanstack/react-query";
import { logout } from "../lib/api";

function LogoutButton() {
  const queryClient = useQueryClient();

  async function handleClick() {
    await logout();
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md bg-surface border border-line px-3 py-1.5 text-sm text-ink-muted hover:text-ink transition-all duration-150 active:scale-95"
    >
      Log out
    </button>
  );
}

export default LogoutButton;
