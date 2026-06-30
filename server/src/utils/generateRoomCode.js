import { customAlphabet } from "nanoid";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../constants/roomConstants.js";

const createRoomCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

export const generateRoomCode = () => createRoomCode();
