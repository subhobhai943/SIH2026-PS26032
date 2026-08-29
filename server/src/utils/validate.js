import { ApiError } from './ApiError.js';

/** Parses `source` with a zod schema, converting failures into a 400 with field details. */
export function parse(schema, source) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    throw ApiError.badRequest('Validation failed', details);
  }
  return result.data;
}
