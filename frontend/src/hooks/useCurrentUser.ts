import { useQuery } from "@tanstack/react-query";
import { getMe, type ApiError, type CurrentUser } from "../lib/api";

export function useCurrentUser() {
  return useQuery<CurrentUser, ApiError>({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
  });
}
