import { verifyToken } from '../services/authService.js';
import { forbidden, unauthorized } from '../utils/errors.js';

/** Mewajibkan header `Authorization: Bearer <token>`; mengisi `req.user`. */
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized());
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Membatasi route untuk peran tertentu. Pasang setelah requireAuth. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  return next();
};
