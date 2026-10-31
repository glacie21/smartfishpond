/** Error dengan status HTTP, dipakai service/controller agar handler seragam. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const notFound = (message = 'Data tidak ditemukan') => new HttpError(404, message);
export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Silakan login terlebih dahulu') => new HttpError(401, message);
export const forbidden = (message = 'Anda tidak memiliki akses untuk aksi ini') =>
  new HttpError(403, message);
