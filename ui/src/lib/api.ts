import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.sessionStorage.getItem("radonaix_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== "undefined") {
      window.sessionStorage.removeItem("radonaix_token");
    }
    return Promise.reject(err);
  },
);
