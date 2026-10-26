import type { RecordType } from './types.js';

/**
 * Normalizes a domain name by trimming whitespace, lowercasing, and stripping trailing dots.
 * Example: "  Example.Com.  " -> "example.com"
 */
export function normalizeDomain(domain: string): string {
  return (domain || '').trim().toLowerCase().replace(/\.+$/, '');
}

/**
 * Normalizes a record name into a fully-qualified domain name (FQDN) ending with a trailing dot.
 * Accepts relative names (e.g. "www", "mail", "@", "") or full names (e.g. "www.example.com", "example.com.")
 * and guarantees a consistent FQDN ending with a dot as required by DNS and PowerDNS APIs.
 *
 * Examples with domain="example.com":
 * - "@" or "" -> "example.com."
 * - "example.com" or "example.com." -> "example.com."
 * - "www" or "www." -> "www.example.com."
 * - "www.example.com" or "www.example.com." -> "www.example.com."
 * - "sub.dev" -> "sub.dev.example.com."
 * - "*.example.com" -> "*.example.com."
 */
export function normalizeRecordName(name: string | undefined | null, domainName: string): string {
  const cleanDomain = normalizeDomain(domainName);
  let cleanName = (name ?? '').trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '');

  if (cleanName === '' || cleanName === '@') {
    return `${cleanDomain}.`;
  }

  if (cleanName.startsWith('@.')) {
    cleanName = cleanName.slice(2).replace(/^\.+/, '');
    if (cleanName === '' || cleanName === cleanDomain) {
      return `${cleanDomain}.`;
    }
  }

  if (cleanName === cleanDomain || cleanName.endsWith(`.${cleanDomain}`)) {
    return `${cleanName}.`;
  }

  return `${cleanName}.${cleanDomain}.`;
}

/**
 * Normalizes a DNS record type string to uppercase.
 */
export function normalizeRecordType(type: string | RecordType): RecordType {
  return (type || '').toString().trim().toUpperCase() as RecordType;
}
