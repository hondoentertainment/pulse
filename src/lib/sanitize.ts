/**
 * Input Sanitization Utilities
 *
 * Provides functions to sanitize user-generated content to prevent XSS attacks
 * and ensure data integrity.
 */

/** HTML tags that are considered safe for basic formatting */
const SAFE_TAGS = new Set([
  'b', 'i', 'u', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
  'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
  'code', 'pre', 'small', 'sub', 'sup', 'mark',
])

/** HTML attributes that are considered safe */
const SAFE_ATTRIBUTES = new Set([
  'href', 'title', 'class', 'id', 'target', 'rel',
])

/** Dangerous tag pattern — matches script, iframe, object, embed, form, etc. */
const DANGEROUS_TAG_RE = /<\/?(?:script|iframe|object|embed|form|input|textarea|select|button|applet|meta|link|base|style)\b[^>]*>/gi

/** Event handler attributes (onclick, onerror, onload, etc.) */
const EVENT_HANDLER_RE = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi

/** javascript: protocol in href or src */
const JS_PROTOCOL_RE = /(?:href|src|action)\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi

/** data: protocol in src (except images) */
const DATA_PROTOCOL_RE = /src\s*=\s*(?:"data:(?!image\/)[^"]*"|'data:(?!image\/)[^']*')/gi

/** Control characters (C0 and C1 controls, excluding common whitespace) */
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g

/** Default max length for general user input */
const DEFAULT_MAX_LENGTH = 5000

/**
 * Sanitize HTML content by removing dangerous tags and attributes while
 * preserving safe formatting tags.
 *
 * This is NOT a full HTML parser — for rendering rich user HTML in production,
 * consider a dedicated library like DOMPurify. This utility handles the most
 * common XSS vectors for a defense-in-depth approach.
 */
export function sanitizeHTML(input: string): string {
  if (!input) return ''

  let sanitized = input

  // Remove dangerous tags entirely
  sanitized = sanitized.replace(DANGEROUS_TAG_RE, '')

  // Remove event handler attributes from remaining tags
  sanitized = sanitized.replace(EVENT_HANDLER_RE, '')

  // Remove javascript: protocol in href/src
  sanitized = sanitized.replace(JS_PROTOCOL_RE, '')

  // Remove data: protocol in src (non-image)
  sanitized = sanitized.replace(DATA_PROTOCOL_RE, '')

  // Remove expression() in style attributes (IE CSS expression attack)
  sanitized = sanitized.replace(/expression\s*\(/gi, '')

  // Remove -moz-binding (Firefox XBL attack)
  sanitized = sanitized.replace(/-moz-binding\s*:/gi, '')

  return sanitized
}

/**
 * Sanitize general text input from users.
 * Trims whitespace, removes control characters, and enforces a max length.
 */
export function sanitizeUserInput(input: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (!input) return ''

  let sanitized = input

  // Trim leading/trailing whitespace
  sanitized = sanitized.trim()

  // Remove control characters (keep tabs, newlines, carriage returns)
  sanitized = sanitized.replace(CONTROL_CHARS_RE, '')

  // Collapse excessive whitespace (more than 3 consecutive newlines)
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n')

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength)
  }

  return sanitized
}

/**
 * Sanitize a hashtag string to only allow alphanumeric characters and underscores.
 * Strips the leading '#' if present, sanitizes, then re-adds it.
 */
export function sanitizeHashtag(input: string): string {
  if (!input) return ''

  let tag = input.trim()

  // Remove leading '#' for processing
  if (tag.startsWith('#')) {
    tag = tag.slice(1)
  }

  // Keep only alphanumeric and underscore characters
  tag = tag.replace(/[^a-zA-Z0-9_]/g, '')

  // Enforce reasonable max length for hashtags
  if (tag.length > 100) {
    tag = tag.slice(0, 100)
  }

  return tag ? `#${tag}` : ''
}
