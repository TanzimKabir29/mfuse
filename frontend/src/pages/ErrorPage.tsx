import { Link } from "react-router";

function ErrorPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-ink-muted hover:text-ink">
        Back home
      </Link>
    </div>
  );
}

export default ErrorPage;
