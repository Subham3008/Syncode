import { API_BASE_URL } from "../config/api.config.js";

export const apiClient = async (path, options = {}) => {
  const body = options.body && typeof options.body !== "string"
    ? JSON.stringify(options.body)
    : options.body;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options,
    body
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || response.statusText || "Request failed");
  }

  return payload;
};
