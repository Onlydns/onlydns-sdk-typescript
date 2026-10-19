import {
  APIError,
  AuthenticationError,
  NotFoundError,
  OnlyDNSError,
  ValidationError,
} from './errors.js';
import type {
  AddRecordOptions,
  APIErrorResponse,
  CreateTsigKeyOptions,
  DNSRecord,
  DNSSECStatus,
  DNSTsigKeysResponse,
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
      'User-Agent': 'OnlyDNS-TypeScript-SDK/1.0.0',
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
    await this.request<void>('POST', '/dns', undefined, { domain });
  }

  /**
   * List domain names configured in the OnlyDNS account.
   */
  async listDomains(options: ListDomainsOptions = {}): Promise<string[]> {
    const res = await this.request<string[]>('GET', '/dns', {
      offset: options.offset,
      limit: options.limit,
    });
    return Array.isArray(res) ? res : [];
  }

  /**
   * Get all DNS records for a specific domain name.
   */
  async getRecords(domainName: string): Promise<DNSRecord[]> {
    const encoded = encodeURIComponent(domainName);
    const res = await this.request<DNSRecord[]>('GET', `/dns/${encoded}/records`);
    return Array.isArray(res) ? res : [];
  }

  /**
   * Replace all DNS records on a domain (atomic bulk replace).
   */
  async replaceRecords(domainName: string, records: DNSRecord[]): Promise<void> {
    const encoded = encodeURIComponent(domainName);
    await this.request<void>('PUT', `/dns/${encoded}/records`, undefined, records);
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
    let recName: string;
    let recType: string;
    let recValues: string[];
    let recTtl: number;

    if (typeof domainNameOrOptions === 'object') {
      domain = domainNameOrOptions.domainName;
      recName = domainNameOrOptions.name;
      recType = String(domainNameOrOptions.type).toUpperCase();
      recValues = Array.isArray(domainNameOrOptions.records)
        ? domainNameOrOptions.records
        : [domainNameOrOptions.records];
      recTtl = domainNameOrOptions.ttl ?? 300;
    } else {
      domain = domainNameOrOptions;
      recName = name || '';
      recType = String(type).toUpperCase();
      recValues = Array.isArray(records) ? records : [records || ''];
      recTtl = ttl;
    }

    const currentRecords = await this.getRecords(domain);
    let found = false;

    for (const r of currentRecords) {
      if (r.name.toLowerCase() === recName.toLowerCase() && String(r.type).toUpperCase() === recType) {
        for (const v of recValues) {
          if (!r.records.includes(v)) {
            r.records.push(v);
          }
        }
        r.ttl = recTtl;
        found = true;
        break;
      }
    }

    if (!found) {
      currentRecords.push({
        name: recName,
        type: recType,
        ttl: recTtl,
        records: recValues,
      });
    }

    await this.replaceRecords(domain, currentRecords);
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
    let recName: string;
    let recType: string | undefined;
    let recValue: string | undefined;

    if (typeof domainNameOrOptions === 'object') {
      domain = domainNameOrOptions.domainName;
      recName = domainNameOrOptions.name;
      recType = domainNameOrOptions.type ? String(domainNameOrOptions.type).toUpperCase() : undefined;
      recValue = domainNameOrOptions.value;
    } else {
      domain = domainNameOrOptions;
      recName = name || '';
      recType = type ? String(type).toUpperCase() : undefined;
      recValue = value;
    }

    const currentRecords = await this.getRecords(domain);
    const updatedRecords: DNSRecord[] = [];

    for (const r of currentRecords) {
      const nameMatch = r.name.toLowerCase() === recName.toLowerCase();
      const typeMatch = !recType || String(r.type).toUpperCase() === recType;

      if (nameMatch && typeMatch) {
        if (recValue !== undefined) {
          r.records = r.records.filter((v) => v !== recValue);
          if (r.records.length > 0) {
            updatedRecords.push(r);
          }
        }
        // If recValue is not provided, record is omitted entirely
      } else {
        updatedRecords.push(r);
      }
    }

    await this.replaceRecords(domain, updatedRecords);
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
    const recType = String(type).toUpperCase();
    const recValues = Array.isArray(records) ? records : [records];
    const currentRecords = await this.getRecords(domainName);
    let found = false;

    for (const r of currentRecords) {
      if (r.name.toLowerCase() === name.toLowerCase() && String(r.type).toUpperCase() === recType) {
        r.records = recValues;
        if (ttl !== undefined) {
          r.ttl = ttl;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      currentRecords.push({
        name,
        type: recType,
        ttl: ttl ?? 300,
        records: recValues,
      });
    }

    await this.replaceRecords(domainName, currentRecords);
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
    const records = await this.getRecords(domainName);
    const rType = type ? String(type).toUpperCase() : undefined;
    const rName = name ? name.trim().toLowerCase() : undefined;
    const rVal = value ? value.trim().toLowerCase() : undefined;

    return records.filter((r) => {
      if (rName !== undefined && !r.name.toLowerCase().includes(rName)) {
        return false;
      }
      if (rType !== undefined && String(r.type).toUpperCase() !== rType) {
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
   * Delete all TSIG keys associated with a domain.
   */
  async deleteDomainTsig(domainName: string): Promise<void> {
    const encoded = encodeURIComponent(domainName);
    await this.request<void>('DELETE', `/dns/${encoded}/tsig`);
  }

  /**
   * Update TSIG key permissions (AXFR and DNS updates) on a domain.
   */
  async updateDomainTsig(
    domainName: string,
    keyName: string,
    allowAxfr: boolean,
    allowDnsUpdate: boolean
  ): Promise<void> {
    const encodedDomain = encodeURIComponent(domainName);
    const encodedKey = encodeURIComponent(keyName);
    await this.request<void>('PATCH', `/dns/${encodedDomain}/tsig/${encodedKey}`, undefined, {
      allowAxfr: Boolean(allowAxfr),
      allowDnsUpdate: Boolean(allowDnsUpdate),
    });
  }

  // ---------------------------------------------------------------------------
  // DNSSEC Management API
  // ---------------------------------------------------------------------------

  /**
   * Get DNSSEC status and DS keys for a domain.
   */
  async getDnssecStatus(domainName: string): Promise<DNSSECStatus> {
    const encoded = encodeURIComponent(domainName);
    const res = await this.request<DNSSECStatus>('GET', `/dns/${encoded}/dnssec`);
    return res || { enabled: false, keys: [] };
  }

  /**
   * Enable DNSSEC for a domain.
   */
  async enableDnssec(domainName: string): Promise<void> {
    const encoded = encodeURIComponent(domainName);
    await this.request<void>('POST', `/dns/${encoded}/dnssec`);
  }

  /**
   * Disable DNSSEC for a domain.
   */
  async disableDnssec(domainName: string): Promise<void> {
    const encoded = encodeURIComponent(domainName);
    await this.request<void>('DELETE', `/dns/${encoded}/dnssec`);
  }
}
