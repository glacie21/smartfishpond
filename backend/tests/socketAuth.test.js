import { createServer } from 'node:http';

import { io as connectClient } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { closeSocket, initSocket } = await import('../src/realtime/socket.js');
const { signToken } = await import('../src/services/authService.js');

let httpServer;
let url;

beforeAll(async () => {
  httpServer = createServer();
  initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `http://127.0.0.1:${httpServer.address().port}`;
});

afterAll(async () => {
  await closeSocket();
});

/** Resolve 'connected' atau pesan connect_error dari server. */
function tryConnect(auth) {
  return new Promise((resolve) => {
    const client = connectClient(url, { auth, transports: ['websocket'], reconnection: false });
    client.on('connect', () => {
      client.disconnect();
      resolve('connected');
    });
    client.on('connect_error', (err) => {
      client.disconnect();
      resolve(err.message);
    });
  });
}

describe('autentikasi Socket.IO', () => {
  it('menolak koneksi tanpa token', async () => {
    expect(await tryConnect({})).toBe('Silakan login terlebih dahulu');
  });

  it('menolak token tidak valid', async () => {
    expect(await tryConnect({ token: 'bukan.jwt.valid' })).toBe('Token akses tidak valid');
  });

  it('menerima token yang valid', async () => {
    const token = signToken({ id: 1, username: 'admin', role: 'admin' });
    expect(await tryConnect({ token })).toBe('connected');
  });
});
