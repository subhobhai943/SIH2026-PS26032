/**
 * Security & Input Sanitization Utilities
 */

/**
 * Escapes characters with special meaning in regular expressions
 * to prevent ReDoS and RegExp SyntaxError crashes.
 */
export function escapeRegex(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recursively removes any object keys starting with '$' or containing '.'
 * to prevent NoSQL injection attacks.
 */
export function sanitizeNoSql(target) {
  if (!target || typeof target !== 'object') return target;

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      sanitizeNoSql(target[i]);
    }
    return target;
  }

  for (const key of Object.keys(target)) {
    if (
      key.startsWith('$') ||
      key.includes('.') ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    ) {
      delete target[key];
    } else if (target[key] && typeof target[key] === 'object') {
      sanitizeNoSql(target[key]);
    }
  }

  return target;
}

/**
 * Express middleware to automatically strip NoSQL injection operators
 * from req.body, req.query, and req.params.
 */
export function mongoSanitizeMiddleware(req, _res, next) {
  if (req.body) sanitizeNoSql(req.body);
  if (req.query) sanitizeNoSql(req.query);
  if (req.params) sanitizeNoSql(req.params);
  next();
}
