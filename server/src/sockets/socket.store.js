export const socketUserMap = new Map();
export const userSocketMap = new Map();
export const roomSocketMap = new Map();

export const addSocketUser = (socketId, userData) => {
  socketUserMap.set(socketId, userData);
  userSocketMap.set(userData.userId, socketId);
};

export const removeSocketUser = (socketId) => {
  const userData = socketUserMap.get(socketId);

  if (userData) {
    userSocketMap.delete(userData.userId);
  }

  socketUserMap.delete(socketId);
  return userData;
};

export const getUserBySocket = (socketId) => socketUserMap.get(socketId);

export const getSocketIdByUser = (userId) => userSocketMap.get(userId);

export const addSocketToRoom = (roomCode, socketId) => {
  if (!roomSocketMap.has(roomCode)) {
    roomSocketMap.set(roomCode, new Set());
  }

  roomSocketMap.get(roomCode).add(socketId);
};

export const removeSocketFromRoom = (roomCode, socketId) => {
  const sockets = roomSocketMap.get(roomCode);

  if (!sockets) {
    return;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    roomSocketMap.delete(roomCode);
  }
};

export const getRoomSockets = (roomCode) => roomSocketMap.get(roomCode) ?? new Set();

export const clearSocketFromAllMaps = (socketId) => {
  const userData = removeSocketUser(socketId);

  if (userData?.roomCode) {
    removeSocketFromRoom(userData.roomCode, socketId);
  }

  return userData;
};
