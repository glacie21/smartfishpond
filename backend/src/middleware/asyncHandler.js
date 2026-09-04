/**
 * Membungkus handler async agar rejected promise diteruskan ke
 * error handler Express (Express 4 tidak menangkapnya otomatis).
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
