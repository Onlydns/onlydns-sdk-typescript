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
