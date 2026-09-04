import { io } from 'socket.io-client';
import { API_BASE } from './api.js';

const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');

let socket = null;

export function connectSocket(token) {
  if (socket) return socket;
  socket = io(SOCKET_URL, { transports: ['websocket'] });
  socket.on('connect', () => socket.emit('auth', token));
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
