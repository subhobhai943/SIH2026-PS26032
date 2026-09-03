import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://51.20.193.239:5000';
  socket = io(url, { autoConnect: true, auth: { token: getToken() } });
  return socket;
}
