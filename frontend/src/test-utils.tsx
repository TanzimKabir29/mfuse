import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { render } from "@testing-library/react";

interface RenderWithProvidersOptions {
  path?: string;
  initialEntries?: string[];
  routes?: Record<string, ReactNode>;
}

// Every page needs a QueryClientProvider (useCurrentUser, and often its own
// query/mutation) and a router (useParams, <Navigate>, <Link>). This wraps
// both so individual page test files don't have to repeat the setup.
export function renderWithProviders(
  ui: ReactElement,
  {
    path = "/",
    initialEntries = [path],
    routes = {},
  }: RenderWithProvidersOptions = {},
) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path={path} element={ui} />
          {Object.entries(routes).map(([routePath, element]) => (
            <Route key={routePath} path={routePath} element={element} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
