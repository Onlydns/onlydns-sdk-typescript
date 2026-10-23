/**
 * OnlyDNS TypeScript/JavaScript SDK.
 *
 * Official SDK for OnlyDNS System API (onlydns.com).
 * Optimized for AI agent tool calling and developer utility.
 */

export { OnlyDNSClient } from './client.js';
export {
  normalizeDomain,
  normalizeRecordName,
  normalizeRecordType,
} from './utils.js';
export {
  OnlyDNSError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  APIError,
} from './errors.js';
export {
  DNSSECKeyAlgorithm,
  DNSSECKeyDigestType,
} from './types.js';
export type {
  RecordType,
  TsigAlgorithm,
  DNSRecord,
  TsigKey,
  DNSTsigKeysResponse,
  CreateTsigKeyOptions,
  DomainTsigPermissions,
  ListDomainsOptions,
  OnlyDNSClientOptions,
  AddRecordOptions,
  RemoveRecordOptions,
  APIErrorResponse,
  DNSSECDsKey,
  DNSSECStatus,
  DNSDnssecStatusResponse,
} from './types.js';
