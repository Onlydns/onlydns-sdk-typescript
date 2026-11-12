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
  DomainTsigKeysResponse,
  ListDomainsOptions,
  OnlyDNSClientOptions,
  AddRecordOptions,
  RemoveRecordOptions,
  APIErrorResponse,
  DNSSECDsKey,
  DNSSECStatus,
  DNSDnssecStatusResponse,
  Scope,
  User,
  CreateUserOptions,
  UpdateUserOptions,
  APIToken,
  CreateTokenOptions,
  AuthLoginOptions,
  AuthResponse,
  AccountPostalAddress,
  BillingPackageFeatures,
  BillingPackage,
  AccountInfo,
  AccountOidcNonCompliantUser,
  AccountOidcConfig,
  SaveAccountOidcOptions,
  AccountOidcDeleteResponse,
  TestAccountOidcOptions,
  AccountOidcTestResponse,
  Money,
  BillingStatusResponse,
  AccountMetricUsage,
  AccountMetricRecords,
  AccountMetricDNSSEC,
  AccountMetricApiRequestsPerMinute,
  AccountMetricsUsage,
  AccountMetricsPackage,
  AccountMetricsResponse,
} from './types.js';
