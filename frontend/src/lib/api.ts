export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_V1_PREFIX = "/v1";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Request to ${path} failed with status: ${response.status}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type SecretExpiry = "ten_minutes" | "one_hour" | "twenty_four_hours";

export interface CreateSecretRequest {
  ciphertext: string;
  nonce: string;
  description?: string;
  expiry: SecretExpiry;
  passphrase_salt?: string;
}

export interface CreateSecretResponse {
  id: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  display_name: string;
}

export function createSecret(
  payload: CreateSecretRequest,
): Promise<CreateSecretResponse> {
  return request<CreateSecretResponse>(`${API_V1_PREFIX}/secret`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface GetSecretResponse {
  ciphertext: string;
  nonce: string;
  passphrase_salt?: string;
}

export function getSecret(id: string): Promise<GetSecretResponse> {
  return request<GetSecretResponse>(`${API_V1_PREFIX}/secret/${id}`);
}

export function getMe(): Promise<CurrentUser> {
  return request<CurrentUser>(`${API_V1_PREFIX}/me`);
}

export function logout(): Promise<void> {
  return request<void>(`${API_V1_PREFIX}/auth/logout`, { method: "POST" });
}
