/**
 * Supported DNS Record Types.
 */
export type RecordType =
  | 'A'
  | 'AAAA'
  | 'MX'
  | 'CNAME'
  | 'TXT'
  | 'SRV'
  | 'CAA'
  | 'CERT'
  | 'HTTPS'
  | 'LOC'
  | 'NAPTR'
  | 'NS'
  | 'SMIMEA'
  | 'SSHFP'
  | 'SVCB'
  | 'TLSA'
  | 'URL'
  | 'PROXY';

/**
 * Supported TSIG Algorithms.
 */
export type TsigAlgorithm =
  | 'mac-md5'
  | 'hmac-sha1'
  | 'hmac-sha224'
  | 'hmac-sha256'
  | 'hmac-sha384'
  | 'hmac-sha512';

/**
 * DNSSEC Key Algorithm numbers.
 */
export enum DNSSECKeyAlgorithm {
  RSA_MD5 = 1,
  DIFFIE_HELLMAN = 2,
  DSA_SHA1 = 3,
  RSA_SHA1 = 5,
  DSA_NSEC3_SHA1 = 6,
  RSASHA1_NSEC3_SHA1 = 7,
  RSA_SHA256 = 8,
  RSA_SHA512 = 10,
  GOST_R_34_10_2001 = 12,
  ECDSA_P256_SHA256 = 13,
  ECDSA_P384_SHA384 = 14,
  ED25519 = 15,
  ED448 = 16,
  SM2SM3 = 17,
  ECC_GOST12 = 23,
}

/**
 * DNSSEC Key Digest Types.
 */
export enum DNSSECKeyDigestType {
  SHA1 = 1,
  SHA256 = 2,
  GOST_R_34_11_94 = 3,
  SHA384 = 4,
}

/**
 * DNSSEC DS Key details.
 */
export interface DNSSECDsKey {
  keyTag: number;
  algorithm: DNSSECKeyAlgorithm | number;
  digestType: DNSSECKeyDigestType | number;
  digest: string;
}

/**
 * DNSSEC status response.
 */
export interface DNSSECStatus {
  enabled: boolean;
  nsec3param?: string;
  keys?: DNSSECDsKey[];
}

export type DNSDnssecStatusResponse = DNSSECStatus;

/**
 * DNS Record representation.
 */
export interface DNSRecord {
  name: string;
  type: RecordType | string;
  ttl: number;
  records: string[];
}

/**
 * TSIG Key representation.
 */
export interface TsigKey {
  name: string;
  algorithm: TsigAlgorithm | string;
  key: string;
}

/**
 * Response for TSIG keys list.
 */
export interface DNSTsigKeysResponse {
  tsigKeys?: TsigKey[];
}

/**
 * Request options for TSIG Key creation.
 */
export interface CreateTsigKeyOptions {
  algorithm?: TsigAlgorithm | string;
}

/**
 * TSIG domain permissions update payload and response.
 */
export interface DomainTsigPermissions {
  allowAxfr: boolean;
  allowDnsUpdate: boolean;
  subdomains?: string[];
}

/**
 * Response for domain TSIG permissions mapping key names to permissions.
 */
export type DomainTsigKeysResponse = Record<string, DomainTsigPermissions>;

/**
 * Pagination options for listing domains.
 */
export interface ListDomainsOptions {
  offset?: number;
  limit?: number;
}

/**
 * Options for OnlyDNSClient initialization.
 */
export interface OnlyDNSClientOptions {
  /**
   * OnlyDNS API Bearer token.
   * If omitted, falls back to ONLYDNS_API_TOKEN environment variable.
   */
  apiToken?: string;

  /**
   * Base API URL (defaults to https://api.onlydns.com/v1).
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds (defaults to 30000ms / 30s).
   */
  timeout?: number;

  /**
   * Optional custom fetch implementation (useful for testing or specialized runtime environments).
   */
  fetch?: typeof fetch;
}

/**
 * Permission scopes supported across OnlyDNS API and Portal.
 */
export type Scope =
  | 'read'
  | 'records:write'
  | 'zones:write'
  | 'dnssec:manage'
  | 'tsig:manage'
  | 'billing:manage'
  | 'registration:manage'
  | 'users:manage'
  | 'tokens:manage'
  | 'admin';

/**
 * Portal User representation.
 */
export interface User {
  userId: string;
  accountId: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  scopes: (Scope | string)[];
  allowedZones?: string[] | null;
  activeAt?: string | null;
  deactivatedAt?: string | null;
  locked?: boolean;
  permitPasswordLogin?: boolean;
  ssoProvider?: string | null;
  ssoId?: string | null;
}

/**
 * Options for inviting/creating a portal user.
 */
export interface CreateUserOptions {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  scopes?: (Scope | string)[];
  allowed_zones?: string[] | null;
  permitPasswordLogin?: boolean;
}

/**
 * Options for updating a portal user.
 */
export interface UpdateUserOptions {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  scopes?: (Scope | string)[];
  allowed_zones?: string[] | null;
  permitPasswordLogin?: boolean;
  locked?: boolean;
}

/**
 * API Token representation.
 */
export interface APIToken {
  tokenId: string;
  apiUserId?: string;
  authToken?: string;
  token?: string;
  authorization?: string;
  maskedToken?: string;
  allowedNetwork?: string[];
  scopes: (Scope | string)[];
  allowedZones?: string[] | null;
  expiresAt?: string | null;
  createdAt: string;
  deactivatedAt?: string | null;
}

/**
 * Options for creating an API token.
 */
export interface CreateTokenOptions {
  scopes?: (Scope | string)[];
  allowed_zones?: string[] | null;
  allowed_network?: string[];
  expires_at?: string | number | null;
}

/**
 * Options for API login.
 */
export interface AuthLoginOptions {
  username: string;
  password: string;
}

/**
 * API authentication response payload.
 */
export interface AuthResponse {
  token: string;
  token_type: string;
  expires_in: number;
  user: {
    userId: string;
    accountId: string;
    userName: string;
    scopes: (Scope | string)[];
    allowedZones?: string[] | null;
  };
}

/**
 * Options for adding or updating records via high-level helper.
 */
export interface AddRecordOptions {
  domainName: string;
  name: string;
  type: RecordType | string;
  records: string | string[];
  ttl?: number;
}

/**
 * Options for removing records via high-level helper.
 */
export interface RemoveRecordOptions {
  domainName: string;
  name: string;
  type?: RecordType | string;
  value?: string;
}

/**
 * Error response body from OnlyDNS API.
 */
export interface APIErrorResponse {
  lang?: string;
  errorCode?: number;
  title?: string;
  description?: string[];
}

/**
 * Account contact postal address.
 */
export interface AccountPostalAddress {
  street1?: string;
  street2?: string;
  street3?: string;
  city?: string;
  state?: string;
  countryId?: string;
  postalCode?: string;
}

/**
 * Feature capabilities included in the billing package.
 */
export interface BillingPackageFeatures {
  domains: number;
  records: number;
  queries: number;
  dnssec: boolean;
  tsig: boolean;
  proxy: boolean;
  customSSO: boolean;
}

/**
 * Account billing package details and feature entitlements.
 */
export interface BillingPackage {
  id: string;
  description: string;
  amount: number;
  features: BillingPackageFeatures;
}

/**
 * Account information and feature entitlements response payload.
 */
export interface AccountInfo {
  accountId: string;
  activeAt?: string | null;
  suspendedAt?: string | null;
  suspended?: boolean;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  address?: AccountPostalAddress | null;
  package?: BillingPackage | null;
}

/**
 * Monetary amount with decimal string value and currency code.
 */
export interface Money {
  value: string;
  currency: string;
}

/**
 * Account billing state and balance summary.
 */
export interface BillingStatusResponse {
  accountId: string;
  currency: string;
  amountDue: Money;
  pastDueAmount: Money;
  billingAssessedTo?: string | null;
  suspendedAt?: string | null;
  pastDue: boolean;
  suspended: boolean;
  suspendedForNonPayment: boolean;
  paymentRequired: boolean;
  payable: boolean;
}

/**
 * Account metric item with observed usage and package limit.
 */
export interface AccountMetricUsage {
  current: number;
  limit: number;
}

/**
 * Account DNS records metric with portfolio total, peak single-zone record count, peak zone name, and per-zone plan limit.
 */
export interface AccountMetricRecords {
  totalRecords: number;
  maxZoneRecords: number;
  maxZoneName?: string | null;
  limitPerZone: number;
  current?: number;
  limit?: number;
}

/**
 * Account API request rate metric with current rate, 24h average rate, and limit.
 */
export interface AccountMetricApiRequestsPerMinute {
  current: number;
  averageLast24Hours: number;
  limit: number;
}

/**
 * Account DNSSEC metric with count and package entitlement status.
 */
export interface AccountMetricDNSSEC {
  current: number;
  enabled: boolean;
}

/**
 * Aggregated usage metrics for an account.
 */
export interface AccountMetricsUsage {
  domains: AccountMetricUsage;
  records: AccountMetricRecords;
  queries: AccountMetricUsage;
  dnssec: AccountMetricDNSSEC;
  tsigKeys: AccountMetricUsage;
  changesLast24Hours: AccountMetricUsage;
  apiRequestsPerMinute: AccountMetricApiRequestsPerMinute;
  apiTokens: AccountMetricUsage;
}

/**
 * Summary of the account's active billing package in metrics response.
 */
export interface AccountMetricsPackage {
  id: string;
  description: string;
}

/**
 * Response returned by the account metrics endpoint.
 */
export interface AccountMetricsResponse {
  accountId: string;
  package?: AccountMetricsPackage | null;
  usage: AccountMetricsUsage;
}

/**
 * User who cannot use custom SSO until migration or credential reset.
 */
export interface AccountOidcNonCompliantUser {
  userId: string;
  userName: string;
  ssoProvider?: string | null;
  reason: string;
}

/**
 * Account custom OIDC Single Sign-On configuration.
 */
export interface AccountOidcConfig {
  configured: boolean;
  accountId?: string | null;
  discoveryUrl?: string | null;
  clientId?: string | null;
  clientSecretMasked?: string | null;
  enforceSso?: boolean;
  breakGlassAdminsCount?: number;
  canEnforceSso?: boolean;
  nonCompliantUsers?: AccountOidcNonCompliantUser[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Options for creating or updating account custom OIDC SSO settings.
 */
export interface SaveAccountOidcOptions {
  discoveryUrl?: string;
  discovery_url?: string;
  clientId?: string;
  client_id?: string;
  clientSecret?: string;
  client_secret?: string;
  enforceSso?: boolean;
  enforce_sso?: boolean;
}

/**
 * Response for deleting custom OIDC SSO configuration.
 */
export interface AccountOidcDeleteResponse {
  success: boolean;
  message: string;
}

/**
 * Options for testing OIDC SSO discovery reachability and credentials.
 */
export interface TestAccountOidcOptions {
  discoveryUrl?: string;
  discovery_url?: string;
  clientId?: string;
  client_id?: string;
  clientSecret?: string;
  client_secret?: string;
}

/**
 * Response for testing OIDC discovery endpoint and client credentials.
 */
export interface AccountOidcTestResponse {
  success: boolean;
  valid?: boolean;
  clientCredentialsTested?: boolean | null;
  clientCredentialsValid?: boolean | null;
  issuer?: string | null;
  authorizationEndpoint?: string | null;
  tokenEndpoint?: string | null;
  jwksUri?: string | null;
  userinfoEndpoint?: string | null;
  scopesSupported?: string[];
}
