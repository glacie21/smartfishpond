import { z } from 'zod';

import * as authService from '../services/authService.js';

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function login(req, res) {
  const { username, password } = req.validated.body;
  res.json({ data: await authService.login(username, password) });
}

export async function me(req, res) {
  const { id, username, role } = req.user;
  res.json({ data: { id, username, role } });
}
