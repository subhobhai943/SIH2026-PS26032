import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from '../middleware/auth.js';
import { getQueueState } from './queueService.js';

let io = null;

export const rooms = {
  center: (centerId, date) => `center:${centerId}:${date}`,
  farmer: (farmerId) => `farmer:${farmerId}`,
};

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  // Auth is optional: the public queue board is watchable without logging in,
  // but a token lets us also join the caller's private farmer room.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    try {
      socket.data.auth = verifyToken(token);
    } catch {
      // Ignore a bad token rather than dropping the connection — the socket
      // simply stays anonymous and gets public updates only.
    }
    return next();
  });

  io.on('connection', (socket) => {
    const auth = socket.data.auth;
    if (auth?.kind === 'farmer') socket.join(rooms.farmer(auth.sub));

    socket.on('queue:watch', async ({ centerId, date }, ack) => {
      if (!centerId || !date) return ack?.({ ok: false, error: 'centerId and date are required' });
      socket.join(rooms.center(centerId, date));
      const state = await getQueueState(centerId, date);
      socket.emit('queue:update', state);
      return ack?.({ ok: true });
    });

    socket.on('queue:unwatch', ({ centerId, date }) => {
      socket.leave(rooms.center(centerId, date));
    });
  });

  console.log('[socket] gateway ready');
  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io has not been initialised');
  return io;
}

/** Recomputes and pushes the queue board for a centre/date to every watcher. */
export async function broadcastQueue(centerId, date) {
  if (!io) return null;
  const state = await getQueueState(centerId, date);
  if (state) io.to(rooms.center(centerId, date)).emit('queue:update', state);
  return state;
}

/** Pushes a personal event (turn approaching, status change) to one farmer. */
export function notifyFarmer(farmerId, event, payload) {
  if (!io) return;
  io.to(rooms.farmer(farmerId)).emit(event, payload);
}
