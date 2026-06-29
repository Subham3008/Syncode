import { apiClient } from "./apiClient.js";

export const getApiStatus = () => apiClient("/");
