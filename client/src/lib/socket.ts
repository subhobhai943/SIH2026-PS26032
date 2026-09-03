import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const url = '';
  socket = io(url, { autoConnect: true, auth: { token: getToken() }, transports: ['polling'] });
  return socket;
}
