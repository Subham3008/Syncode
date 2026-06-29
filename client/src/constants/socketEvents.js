export const SOCKET_EVENTS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",

  ROOM_JOIN: "room:join",
  ROOM_REJOIN: "room:rejoin",
  ROOM_LEAVE: "room:leave",
  ROOM_JOINED: "room:joined",
  ROOM_LEFT: "room:left",
  ROOM_ERROR: "room:error",
  ROOM_RENAMED: "room:renamed",
  ROOM_LOCKED: "room:locked",
  ROOM_CLOSED: "room:closed",

  PARTICIPANTS_UPDATED: "participants:updated",
  ACTIVITY_UPDATED: "activity:updated",

  HOST_RENAME_ROOM: "host:rename-room",
  HOST_KICK_USER: "host:kick-user",
  HOST_LOCK_ROOM: "host:lock-room",
  HOST_CLOSE_ROOM: "host:close-room",
  USER_KICKED: "user:kicked"
};
