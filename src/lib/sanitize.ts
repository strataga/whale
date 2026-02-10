/**
 * #15 Input sanitization for XSS prevention.
 * Strips HTML tags from user-provided text fields.
 */

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;

/**
 * Strip HTML tags from a string to prevent XSS.
 * Preserves text content between tags.
 */
export function sanitizeHtml(input: string): string {
  return input.replace(HTML_TAG_RE, "").trim();
}
