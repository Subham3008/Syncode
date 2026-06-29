export const ROUTES = {
  HOME: "/",
  ROOM: "/room/:roomCode"
};

export const buildRoomPath = (roomCode) => `/room/${roomCode}`;
