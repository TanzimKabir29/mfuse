import { Outlet } from "react-router";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";
import { useCurrentUser } from "../hooks/useCurrentUser";

function Layout() {
  const currentUser = useCurrentUser();

  return (
    <>
      <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
        {currentUser.data && <LogoutButton />}
        <ThemeToggle />
      </div>
      <Outlet />
    </>
  );
}

export default Layout;
