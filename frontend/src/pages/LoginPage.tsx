import { Navigate } from "react-router";
import { API_BASE_URL } from "../lib/api";
import { useCurrentUser } from "../hooks/useCurrentUser";

const GOOGLE_LOGIN_URL = `${API_BASE_URL}/v1/auth/google/login`;

function LoginPage() {
  const currentUser = useCurrentUser();

  if (currentUser.isLoading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center">
        <p className="text-ink-muted text-sm">Checking session...</p>
      </div>
    );
  }

  if (currentUser.data) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div>
          <img src="/favicon.svg" alt="" className="w-16 h-16 mx-auto mb-3" />
          <h1 className="text-3xl font-semibold tracking-tight">MFuse</h1>
          <p className="mt-1 text-ink-muted text-sm">
            Every secret has a fuse.
          </p>
        </div>
        <a
          href={GOOGLE_LOGIN_URL}
          className="w-full rounded-md bg-accent text-accent-contrast px-4 py-2 text-sm font-medium hover:bg-accent-hover text-center transition-all active:scale-95"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}

export default LoginPage;
