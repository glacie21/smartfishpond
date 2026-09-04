import { badRequest } from '../utils/errors.js';

/**
 * Memvalidasi bagian request dengan skema zod dan mengganti isinya
 * dengan hasil parse (sudah bertipe & ter-default).
 *
 * @param schema skema zod
 * @param source 'body' | 'query' | 'params'
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(badRequest(`Data ${source} tidak valid`, result.error.flatten()));
  }
  // req.query bersifat getter-only di Express 5; simpan di properti terpisah.
  req.validated = { ...(req.validated ?? {}), [source]: result.data };
  return next();
};
