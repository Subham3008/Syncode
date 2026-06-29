import { apiClient } from "./apiClient.js";

export const getApiStatus = () => apiClient("/");

export const createRoom = (payload) =>
  apiClient("/rooms/create", {
    method: "POST",
    body: payload
  });

export const joinRoom = (payload) =>
  apiClient("/rooms/join", {
    method: "POST",
    body: payload
  });

export const rejoinRoom = (payload) =>
  apiClient("/rooms/rejoin", {
    method: "POST",
    body: payload
  });

export const getRoom = (roomCode) => apiClient(`/rooms/${roomCode}`);

export const renameRoom = (roomCode, payload) =>
  apiClient(`/rooms/${roomCode}/rename`, {
    method: "PATCH",
    body: payload
  });

export const kickUser = (roomCode, payload) =>
  apiClient(`/rooms/${roomCode}/kick`, {
    method: "POST",
    body: payload
  });

export const lockRoom = (roomCode, payload) =>
  apiClient(`/rooms/${roomCode}/lock`, {
    method: "PATCH",
    body: payload
  });

export const closeRoom = (roomCode, payload) =>
  apiClient(`/rooms/${roomCode}/close`, {
    method: "PATCH",
    body: payload
  });
