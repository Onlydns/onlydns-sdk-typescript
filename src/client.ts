import {
  APIError,
  AuthenticationError,
  NotFoundError,
  OnlyDNSError,
  ValidationError,
} from './errors.js';
import {
  normalizeDomain,
  normalizeRecordName,
  normalizeRecordType,
} from './utils.js';
import type {
  AddRecordOptions,
  APIErrorResponse,
  CreateTsigKeyOptions,
  DNSRecord,
  DNSSECStatus,
  DNSTsigKeysResponse,
  DomainTsigPermissions,
  ListDomainsOptions,
  OnlyDNSClientOptions,
  RecordType,
  RemoveRecordOptions,
  TsigAlgorithm,
  TsigKey,
} from './types.js';

/**
 * Main client for interacting with the OnlyDNS API.
 */
export class OnlyDNSClient {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;

  public static readonly DEFAULT_BASE_URL = 'https://api.onlydns.com/v1';

  constructor(options: OnlyDNSClientOptions = {}) {
    const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
    const token =
      options.apiToken ||
      globalProcess?.env?.ONLYDNS_API_KEY ||
      globalProcess?.env?.ONLYDNS_API_TOKEN;

    if (!token) {
      throw new AuthenticationError(
        'API token is required. Pass apiToken or set the ONLYDNS_API_KEY environment variable.'
      );
    }

    this.apiToken = token;
    this.baseUrl = (options.baseUrl || OnlyDNSClient.DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = options.timeout ?? 30000;
    this.fetchFn = options.fetch || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch);
  }

  private async request<T>(
    method: string,
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    body?: unknown
  ): Promise<T> {
    let url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    if (params) {
      const query = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          query.set(key, String(val));
        }
      }
      const qs = query.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      Accept: 'application/json',
      'User-Agent': 'OnlyDNS-TypeScript-SDK/1.0.3',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        method: method.toUpperCase(),
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      if (!response.ok) {
        let errorTitle = '';
        let errorDetails: string[] = [];
        try {
          const errData = (await response.json()) as APIErrorResponse;
          if (errData && typeof errData === 'object') {
            errorTitle = errData.title || '';
            if (Array.isArray(errData.description)) {
              errorDetails = errData.description;
            } else if (typeof errData.description === 'string') {
              errorDetails = [errData.description];
            }
          }
        } catch {
          // If non-JSON error body
        }

        const msg = errorTitle || `HTTP ${response.status} ${response.statusText}`;
        if (response.status === 400) {
          throw new ValidationError(msg, response.status, errorDetails);
        } else if (response.status === 401) {
          throw new AuthenticationError(
            msg || 'Access token is missing or invalid',
            response.status,
            errorDetails
          );
        } else if (response.status === 404) {
          throw new NotFoundError(msg || 'Resource not found', response.status, errorDetails);
        } else {
          throw new APIError(msg, response.status, errorDetails);
        }
      }

      const text = await response.text();
      if (!text) {
        return undefined as unknown as T;
      }
      return JSON.parse(text) as T;
    } catch (err: unknown) {
      if (err instanceof OnlyDNSError) {
        throw err;
      }
      if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
        throw new OnlyDNSError(`Request timed out after ${this.timeout}ms`);
      }
      throw new OnlyDNSError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ---------------------------------------------------------------------------
  // Domains & DNS Records API
  // ---------------------------------------------------------------------------

  /**
   * Create a new DNS domain.
   */
  async createDomain(domain: string): Promise<void> {
    const cleanDomain = normalizeDomain(domain);
    await this.request<void>('POST', '/dns', undefined, { domain: cleanDomain });
  }

  /**
   * List domain names configured in the OnlyDNS account.
   */
  async listDomains(options: ListDomainsOptions = {}): Promise<string[]> {
    const res = await this.request<string[]>('GET', '/dns', {
      offset: options.offset,
      limit: options.limit,
    });
    return Array.isArray(res) ? res.map(normalizeDomain) : [];
  }

  /**
   * Get all DNS records for a specific domain name.
   */
  async getRecords(domainName: string): Promise<DNSRecord[]> {
    const cleanDomain = normalizeDomain(domainName);
    const encoded = encodeURIComponent(cleanDomain);
    const res = await this.request<DNSRecord[]>('GET', `/dns/${encoded}/records`);
    if (!Array.isArray(res)) return [];
    return res.map((r) => ({
      ...r,
      name: normalizeRecordName(r.name, cleanDomain),
      type: normalizeRecordType(r.type),
    }));
  }

  /**
   * Replace all DNS records on a domain (atomic bulk replace).
   * Ensures all record names end with a trailing dot as required by the API.
   */
  async replaceRecords(domainName: string, records: DNSRecord[]): Promise<void> {
    const cleanDomain = normalizeDomain(domainName);
    const encoded = encodeURIComponent(cleanDomain);
    const normalizedRecords = records.map((r) => ({
      ...r,
      name: normalizeRecordName(r.name, cleanDomain),
      type: normalizeRecordType(r.type),
    }));
    await this.request<void>('PUT', `/dns/${encoded}/records`, undefined, normalizedRecords);
  }

  // ---------------------------------------------------------------------------
  // High-Level Atomic DNS Record Helpers
  // ---------------------------------------------------------------------------

  /**
   * Add or merge DNS record(s) on a domain.
   * If a record for the specified name and type exists, new values are merged without duplicate entries.
   * Otherwise, a new record is created.
   */
  async addRecord(
    domainNameOrOptions: string | AddRecordOptions,
    name?: string,
    type?: RecordType | string,
    records?: string | string[],
    ttl: number = 300
  ): Promise<DNSRecord[]> {
    let domain: string;
    let rawName: string;
    let recType: RecordType;
    let recValues: string[];
    let recTtl: number;

    if (typeof domainNameOrOptions === 'object') {
      domain = domainNameOrOptions.domainName;
      rawName = domainNameOrOptions.name;
      recType = normalizeRecordType(domainNameOrOptions.type);
      recValues = Array.isArray(domainNameOrOptions.records)
        ? domainNameOrOptions.records
        : [domainNameOrOptions.records];
      recTtl = domainNameOrOptions.ttl ?? 300;
    } else {
      domain = domainNameOrOptions;
      rawName = name || '';
      recType = normalizeRecordType(type || 'A');
      recValues = Array.isArray(records) ? records : [records || ''];
      recTtl = ttl;
    }

    const cleanDomain = normalizeDomain(domain);
    const targetFqdn = normalizeRecordName(rawName, cleanDomain);
    const currentRecords = await this.getRecords(cleanDomain);
    let found = false;

    for (const r of currentRecords) {
      const rFqdn = normalizeRecordName(r.name, cleanDomain);
      if (rFqdn === targetFqdn && normalizeRecordType(r.type) === recType) {
        for (const v of recValues) {
          if (!r.records.includes(v)) {
            r.records.push(v);
          }
        }
        r.ttl = recTtl;
        r.name = targetFqdn;
        found = true;
        break;
      }
    }

    if (!found) {
      currentRecords.push({
        name: targetFqdn,
        type: recType,
        ttl: recTtl,
        records: recValues,
      });
    }

    await this.replaceRecords(cleanDomain, currentRecords);
    return currentRecords;
  }

  /**
   * Remove a DNS record or a specific record value from a domain.
   */
  async removeRecord(
    domainNameOrOptions: string | RemoveRecordOptions,
    name?: string,
    type?: RecordType | string,
    value?: string
  ): Promise<DNSRecord[]> {
    let domain: string;
    let rawName: string;
    let recType: RecordType | undefined;
    let recValue: string | undefined;

    if (typeof domainNameOrOptions === 'object') {
      domain = domainNameOrOptions.domainName;
      rawName = domainNameOrOptions.name;
      recType = domainNameOrOptions.type ? normalizeRecordType(domainNameOrOptions.type) : undefined;
      recValue = domainNameOrOptions.value;
    } else {
      domain = domainNameOrOptions;
      rawName = name || '';
      recType = type ? normalizeRecordType(type) : undefined;
      recValue = value;
    }

    const cleanDomain = normalizeDomain(domain);
    const targetFqdn = normalizeRecordName(rawName, cleanDomain);
    const currentRecords = await this.getRecords(cleanDomain);
    const updatedRecords: DNSRecord[] = [];

    for (const r of currentRecords) {
      const rFqdn = normalizeRecordName(r.name, cleanDomain);
      const nameMatch = rFqdn === targetFqdn;
      const typeMatch = !recType || normalizeRecordType(r.type) === recType;

      if (nameMatch && typeMatch) {
        if (recValue !== undefined) {
          r.records = r.records.filter((v) => v !== recValue);
          if (r.records.length > 0) {
            r.name = rFqdn;
            updatedRecords.push(r);
          }
        }
        // If recValue is not provided, record is omitted entirely (deleted)
      } else {
        r.name = rFqdn;
        updatedRecords.push(r);
      }
    }

    await this.replaceRecords(cleanDomain, updatedRecords);
    return updatedRecords;
  }

  /**
   * Update/overwrite values and TTL for a specific hostname and type combination.
   */
  async updateRecord(
    domainName: string,
    name: string,
    type: RecordType | string,
    records: string | string[],
    ttl?: number
  ): Promise<DNSRecord[]> {
    const cleanDomain = normalizeDomain(domainName);
    const targetFqdn = normalizeRecordName(name, cleanDomain);
    const recType = normalizeRecordType(type);
    const recValues = Array.isArray(records) ? records : [records];
    const currentRecords = await this.getRecords(cleanDomain);
    let found = false;

    for (const r of currentRecords) {
      const rFqdn = normalizeRecordName(r.name, cleanDomain);
      if (rFqdn === targetFqdn && normalizeRecordType(r.type) === recType) {
        r.records = recValues;
        r.name = targetFqdn;
        if (ttl !== undefined) {
          r.ttl = ttl;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      currentRecords.push({
        name: targetFqdn,
        type: recType,
        ttl: ttl ?? 300,
        records: recValues,
      });
    }

    await this.replaceRecords(cleanDomain, currentRecords);
    return currentRecords;
  }

  /**
   * Search and filter DNS records without modifying zone records.
   */
  async findRecords(
    domainName: string,
    name?: string,
    type?: RecordType | string,
    value?: string
  ): Promise<DNSRecord[]> {
    const cleanDomain = normalizeDomain(domainName);
    const records = await this.getRecords(cleanDomain);
    const rType = type ? normalizeRecordType(type) : undefined;
    const rName = name ? name.trim().toLowerCase().replace(/\.+$/, '') : undefined;
    const rVal = value ? value.trim().toLowerCase() : undefined;

    return records.filter((r) => {
      if (rName !== undefined) {
        const cleanRName = r.name.toLowerCase().replace(/\.+$/, '');
        const targetFqdn = normalizeRecordName(rName, cleanDomain).replace(/\.+$/, '');
        if (cleanRName !== targetFqdn && !cleanRName.includes(rName)) {
          return false;
        }
      }
      if (rType !== undefined && normalizeRecordType(r.type) !== rType) {
        return false;
      }
      if (rVal !== undefined) {
        const hasMatch = r.records.some((v) => v.toLowerCase().includes(rVal));
        if (!hasMatch) return false;
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // TSIG Key Management API
  // ---------------------------------------------------------------------------

  /**
   * List all TSIG keys configured in the account.
   */
  async getTsigKeys(): Promise<TsigKey[]> {
    const res = await this.request<DNSTsigKeysResponse>('GET', '/dns/tsig');
    return res && Array.isArray(res.tsigKeys) ? res.tsigKeys : [];
  }

  /**
   * Create a new TSIG key for the account.
   */
  async createTsigKey(options?: CreateTsigKeyOptions | TsigAlgorithm | string): Promise<TsigKey> {
    let body: CreateTsigKeyOptions | undefined;
    if (typeof options === 'string') {
      body = { algorithm: options };
    } else if (options && typeof options === 'object') {
      body = options;
    }
    return this.request<TsigKey>('POST', '/dns/tsig', undefined, body);
  }

  /**
   * Get details for a specific TSIG key.
   */
  async getTsigKey(keyName: string): Promise<TsigKey> {
    const encoded = encodeURIComponent(keyName);
    return this.request<TsigKey>('GET', `/dns/tsig/${encoded}`);
  }

  /**
   * Get TSIG keys and permissions configured on a domain.
   */
  async getDomainTsig(domainName: string): Promise<Record<string, DomainTsigPermissions>> {
    const cleanDomain = normalizeDomain(domainName);
    const encoded = encodeURIComponent(cleanDomain);
    const res = await this.request<Record<string, DomainTsigPermissions>>('GET', `/dns/${encoded}/tsig`);
    return res || {};
  }

  /**
   * Delete all TSIG keys associated with a domain.
   */
  async deleteDomainTsig(domainName: string): Promise<void> {
    const cleanDomain = normalizeDomain(domainName);
    const encoded = encodeURIComponent(cleanDomain);
    await this.request<void>('DELETE', `/dns/${encoded}/tsig`);
  }

  /**
   * Update TSIG key permissions (AXFR, DNS updates, and optional subdomain restrictions) on a domain.
   */
  async updateDomainTsig(
    domainName: string,
    keyName: string,
    allowAxfr: boolean,
    allowDnsUpdate: boolean,
    subdomains?: string[]
  ): Promise<void> {
    const cleanDomain = normalizeDomain(domainName);
    const encodedDomain = encodeURIComponent(cleanDomain);
    const encodedKey = encodeURIComponent(keyName);
    const body: Record<string, unknown> = {
      allowAxfr: Boolean(allowAxfr),
      allowDnsUpdate: Boolean(allowDnsUpdate),
    };
    if (subdomains !== undefined && subdomains !== null) {
      body.subdomains = subdomains;
    }
    await this.request<void>('PATCH', `/dns/${encodedDomain}/tsig/${encodedKey}`, undefined, body);
  }

  // ---------------------------------------------------------------------------
  // DNSSEC Management API
  // ---------------------------------------------------------------------------

  /**
   * Get DNSSEC status and DS keys for a domain.
   */
  async getDnssecStatus(domainName: string): Promise<DNSSECStatus> {
    const cleanDomain = normalizeDomain(domainName);
    const encoded = encodeURIComponent(cleanDomain);
    const res = await this.request<DNSSECStatus>('GET', `/dns/${encoded}/dnssec`);
    return res || { enabled: false, keys: [] };
  }

  /**
   * Enable DNSSEC for a domain.
   */
  async enableDnssec(domainName: string): Promise<void> {
    const cleanDomain = normalizeDomain(domainName);
    const encoded = encodeURIComponent(cleanDomain);
    await this.request<void>('POST', `/dns/${encoded}/dnssec`);
  }

  /**
   * Disable DNSSEC for a domain.
   */
  async disableDnssec(domainName: string): Promise<void> {
    const cleanDomain = normalizeDomain(domainName);
    const encoded = encodeURIComponent(cleanDomain);
    await this.request<void>('DELETE', `/dns/${encoded}/dnssec`);
  }
}
