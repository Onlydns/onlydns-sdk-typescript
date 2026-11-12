import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlyDNSClient, normalizeDomain, normalizeRecordName, normalizeRecordType } from '../dist/index.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../dist/errors.js';

test('Normalization utilities enforce trailing dots for DNS record names and strip trailing dots for domains', () => {
  assert.equal(normalizeDomain('EXAMPLE.COM.'), 'example.com');
  assert.equal(normalizeDomain('  sub.example.com.  '), 'sub.example.com');

  // Case 1: Without domain (relative)
  assert.equal(normalizeRecordName('@', 'example.com'), 'example.com.');
  assert.equal(normalizeRecordName('', 'example.com'), 'example.com.');
  assert.equal(normalizeRecordName('testing', 'example.com'), 'testing.example.com.');
  assert.equal(normalizeRecordName('www', 'example.com'), 'www.example.com.');
  assert.equal(normalizeRecordName('api.v1', 'example.com'), 'api.v1.example.com.');

  // Case 2: With domain without trailing dot
  assert.equal(normalizeRecordName('testing.example.com', 'example.com'), 'testing.example.com.');
  assert.equal(normalizeRecordName('example.com', 'example.com'), 'example.com.');
  assert.equal(normalizeRecordName('www.example.com', 'example.com'), 'www.example.com.');

  // Case 3: Full canonical FQDN with trailing dot
  assert.equal(normalizeRecordName('testing.example.com.', 'example.com'), 'testing.example.com.');
  assert.equal(normalizeRecordName('example.com.', 'example.com'), 'example.com.');
  assert.equal(normalizeRecordName('www.example.com.', 'example.com'), 'www.example.com.');

  assert.equal(normalizeRecordType('a'), 'A');
  assert.equal(normalizeRecordType('cname'), 'CNAME');
});

test('OnlyDNSClient constructor throws without token', () => {
  const origEnv = process.env.ONLYDNS_API_TOKEN;
  delete process.env.ONLYDNS_API_TOKEN;

  assert.throws(() => new OnlyDNSClient(), AuthenticationError);

  if (origEnv !== undefined) process.env.ONLYDNS_API_TOKEN = origEnv;
});

test('listDomains parses response correctly', async () => {
  const mockFetch = async (url, opts) => {
    assert.match(url, /\/dns\?offset=0&limit=100/);
    assert.equal(opts.headers.Authorization, 'Bearer test_token');
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify(['example.com', 'example.net']),
    };
  };

  const client = new OnlyDNSClient({ apiToken: 'test_token', fetch: mockFetch });
  const domains = await client.listDomains({ offset: 0, limit: 100 });
  assert.deepEqual(domains, ['example.com', 'example.net']);
});

test('addRecord helper merges existing values, normalizes names to FQDN with trailing dot, and updates TTL', async () => {
  let putPayload = null;

  const mockFetch = async (url, opts) => {
    if (opts.method === 'GET') {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify([
            { name: 'mail.example.com.', type: 'A', ttl: 300, records: ['192.0.2.10'] },
          ]),
      };
    }
    if (opts.method === 'PUT') {
      putPayload = JSON.parse(opts.body);
      return {
        status: 204,
        ok: true,
        text: async () => '',
      };
    }
    throw new Error('Unexpected call: ' + opts.method);
  };

  const client = new OnlyDNSClient({ apiToken: 'test_token', fetch: mockFetch });
  const updated = await client.addRecord('example.com', 'mail', 'A', '192.0.2.11', 600);

  assert.equal(updated.length, 1);
  assert.equal(updated[0].name, 'mail.example.com.');
  assert.deepEqual(updated[0].records, ['192.0.2.10', '192.0.2.11']);
  assert.equal(updated[0].ttl, 600);
  assert.deepEqual(putPayload, updated);
});

test('removeRecord helper removes specified value with normalized FQDN', async () => {
  let putPayload = null;

  const mockFetch = async (url, opts) => {
    if (opts.method === 'GET') {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify([
            { name: 'api.example.com.', type: 'A', ttl: 300, records: ['1.1.1.1', '2.2.2.2'] },
            { name: 'web.example.com.', type: 'A', ttl: 300, records: ['3.3.3.3'] },
          ]),
      };
    }
    if (opts.method === 'PUT') {
      putPayload = JSON.parse(opts.body);
      return {
        status: 204,
        ok: true,
        text: async () => '',
      };
    }
    throw new Error('Unexpected call');
  };

  const client = new OnlyDNSClient({ apiToken: 'test_token', fetch: mockFetch });
  const updated = await client.removeRecord('example.com', 'api', 'A', '1.1.1.1');

  assert.equal(updated.length, 2);
  assert.equal(updated[0].name, 'api.example.com.');
  assert.deepEqual(updated[0].records, ['2.2.2.2']);
  assert.equal(updated[1].name, 'web.example.com.');
  assert.deepEqual(putPayload, updated);
});

test('findRecords filters by name, type, and value with substring matching', async () => {
  const mockFetch = async () => ({
    status: 200,
    ok: true,
    text: async () =>
      JSON.stringify([
        { name: 'api.example.com.', type: 'A', ttl: 300, records: ['192.0.2.1'] },
        { name: 'mail.example.com.', type: 'A', ttl: 300, records: ['192.0.2.25'] },
        { name: 'www.example.com.', type: 'CNAME', ttl: 600, records: ['example.com.'] },
      ]),
  });

  const client = new OnlyDNSClient({ apiToken: 'test_token', fetch: mockFetch });

  const byName = await client.findRecords('example.com', 'api');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].name, 'api.example.com.');

  const byNameSub = await client.findRecords('example.com', 'example.com');
  assert.equal(byNameSub.length, 3);

  const byType = await client.findRecords('example.com', undefined, 'A');
  assert.equal(byType.length, 2);

  const byValue = await client.findRecords('example.com', undefined, undefined, '192.0.2.25');
  assert.equal(byValue.length, 1);
  assert.equal(byValue[0].name, 'mail.example.com.');

  const byValueSub = await client.findRecords('example.com', undefined, undefined, 'example');
  assert.equal(byValueSub.length, 1);
  assert.equal(byValueSub[0].name, 'www.example.com.');
});

test('TSIG operations work as expected', async () => {
  let patchCalls = [];
  let deleteCalls = [];

  const mockFetch = async (url, opts) => {
    if (opts.method === 'POST' && url.endsWith('/dns/tsig')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            name: 'key-123',
            algorithm: 'hmac-sha256',
            key: 'secret==',
          }),
      };
    }
    if (opts.method === 'GET' && url.endsWith('/dns/example.com/tsig')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            'key-123': {
              allowAxfr: false,
              allowDnsUpdate: true,
              subdomains: ['_acme_challenge'],
            },
          }),
      };
    }
    if (opts.method === 'PATCH' && url.includes('/dns/example.com/tsig/')) {
      patchCalls.push({ url, body: JSON.parse(opts.body) });
      return {
        status: 204,
        ok: true,
        text: async () => '',
      };
    }
    if (opts.method === 'DELETE' && url.endsWith('/dns/example.com/tsig')) {
      deleteCalls.push(url);
      return {
        status: 204,
        ok: true,
        text: async () => '',
      };
    }
    throw new Error('Unexpected call: ' + opts.method + ' ' + url);
  };

  const client = new OnlyDNSClient({ apiToken: 'test_token', fetch: mockFetch });
  const key = await client.createTsigKey({ algorithm: 'hmac-sha256' });
  assert.equal(key.name, 'key-123');
  assert.equal(key.algorithm, 'hmac-sha256');

  // Configure full-zone TSIG
  await client.updateDomainTsig('example.com', 'key-123', true, true);
  assert.equal(patchCalls.length, 1);
  assert.deepEqual(patchCalls[0].body, { allowAxfr: true, allowDnsUpdate: true });

  // Configure subdomain-restricted TSIG
  await client.updateDomainTsig('example.com', 'key-123', false, true, ['_acme_challenge', 'dynamic']);
  assert.equal(patchCalls.length, 2);
  assert.deepEqual(patchCalls[1].body, {
    allowAxfr: false,
    allowDnsUpdate: true,
    subdomains: ['_acme_challenge', 'dynamic'],
  });

  // Get domain TSIG
  const domainTsig = await client.getDomainTsig('example.com');
  assert.deepEqual(domainTsig['key-123'], {
    allowAxfr: false,
    allowDnsUpdate: true,
    subdomains: ['_acme_challenge'],
  });

  // Delete domain TSIG
  await client.deleteDomainTsig('example.com');
  assert.equal(deleteCalls.length, 1);
});

test('createDomain sends correct payload', async () => {
  let postPayload = null;
  const mockFetch = async (url, opts) => {
    assert.match(url, /\/dns$/);
    assert.equal(opts.method, 'POST');
    postPayload = JSON.parse(opts.body);
    return {
      status: 201,
      ok: true,
      text: async () => '',
    };
  };

  const client = new OnlyDNSClient({ apiToken: 'test_token', fetch: mockFetch });
  await client.createDomain('newexample.com');
  assert.deepEqual(postPayload, { domain: 'newexample.com' });
});

test('DNSSEC operations work as expected', async () => {
  const mockFetch = async (url, opts) => {
    if (opts.method === 'GET' && url.endsWith('/dnssec')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            enabled: true,
            nsec3param: '1 0 10 12345678',
            keys: [
              {
                keyTag: 2371,
                algorithm: 13,
                digestType: 2,
                digest: 'abc123def456',
              },
            ],
          }),
      };
    }
    if (opts.method === 'POST' && url.endsWith('/dnssec')) {
      return {
        status: 201,
        ok: true,
        text: async () => '',
      };
    }
    if (opts.method === 'DELETE' && url.endsWith('/dnssec')) {
      return {
        status: 204,
        ok: true,
        text: async () => '',
      };
    }
    throw new Error('Unexpected call: ' + opts.method + ' ' + url);
  };

  const client = new OnlyDNSClient({ apiToken: 'test_token', fetch: mockFetch });
  const status = await client.getDnssecStatus('example.com');
  assert.equal(status.enabled, true);
  assert.equal(status.nsec3param, '1 0 10 12345678');
  assert.equal(status.keys?.length, 1);
  assert.equal(status.keys?.[0].keyTag, 2371);

  await client.enableDnssec('example.com');
  await client.disableDnssec('example.com');
});

test('Account and custom OIDC SSO operations work as expected', async () => {
  const requests = [];
  const mockFetch = async (url, opts) => {
    requests.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });

    if (opts.method === 'GET' && url.endsWith('/account')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            accountId: '018f1234-5678-7000-8000-000000000001',
            activeAt: '2024-01-01T00:00:00+00:00',
            companyName: 'Acme Corporation',
            firstName: 'Jane',
            lastName: 'Doe',
            address: {
              street1: '123 Innovation Way',
              city: 'Austin',
              state: 'TX',
              countryId: 'US',
              postalCode: '78701',
            },
            package: {
              id: '018f1234-5678-7000-8000-000000000002',
              description: 'Enterprise Tier',
              amount: 49.99,
              features: {
                domains: 50,
                records: 5000,
                queries: 1000000,
                dnssec: true,
                tsig: true,
                proxy: true,
                customSSO: true,
              },
            },
          }),
      };
    }

    if (opts.method === 'GET' && url.endsWith('/account/billing')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            accountId: '018f1234-5678-7000-8000-000000000001',
            currency: 'USD',
            amountDue: { value: '49.00', currency: 'USD' },
            pastDueAmount: { value: '0.00', currency: 'USD' },
            pastDue: false,
            suspended: false,
            suspendedForNonPayment: false,
            paymentRequired: true,
            payable: true,
          }),
      };
    }

    if (opts.method === 'GET' && url.endsWith('/account/metrics')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            accountId: '018f1234-5678-7000-8000-000000000001',
            package: { id: 'pro', description: 'Professional DNS' },
            usage: {
              domains: { current: 5, limit: 25 },
              records: { current: 42, limit: 500 },
              queries: { current: 1500, limit: 100000 },
              dnssec: { current: 2, enabled: true },
              tsigKeys: { current: 1, limit: 10 },
              changesLast24Hours: { current: 3, limit: 100 },
              apiRequestsPerMinute: { current: 8, limit: 60 },
              apiTokens: { current: 2, limit: 5 },
            },
          }),
      };
    }

    if (opts.method === 'GET' && url.endsWith('/account/oidc')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            configured: true,
            accountId: '018f1234-5678-7000-8000-000000000001',
            discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
            clientId: 'client-123',
            clientSecretMasked: 'secr*****',
            enforceSso: false,
            breakGlassAdminsCount: 1,
            canEnforceSso: true,
            nonCompliantUsers: [],
          }),
      };
    }

    if (opts.method === 'POST' && url.endsWith('/account/oidc')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            configured: true,
            accountId: '018f1234-5678-7000-8000-000000000001',
            discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
            clientId: 'client-123',
            clientSecretMasked: 'secr*****',
            enforceSso: true,
          }),
      };
    }

    if (opts.method === 'DELETE' && url.endsWith('/account/oidc')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            message: 'OIDC configuration removed successfully',
          }),
      };
    }

    if (opts.method === 'POST' && url.endsWith('/account/oidc/test')) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            issuer: 'https://idp.example.com',
            authorizationEndpoint: 'https://idp.example.com/oauth2/v1/authorize',
            tokenEndpoint: 'https://idp.example.com/oauth2/v1/token',
            jwksUri: 'https://idp.example.com/oauth2/v1/keys',
            userinfoEndpoint: 'https://idp.example.com/oauth2/v1/userinfo',
          }),
      };
    }

    throw new Error('Unexpected call: ' + opts.method + ' ' + url);
  };

  const client = new OnlyDNSClient({ apiToken: 'test_token', fetch: mockFetch });

  // 1. getAccount
  const acc = await client.getAccount();
  assert.equal(acc.accountId, '018f1234-5678-7000-8000-000000000001');
  assert.equal(acc.companyName, 'Acme Corporation');
  assert.equal(acc.package?.features.customSSO, true);

  // 1b. getAccountBilling
  const bill = await client.getAccountBilling();
  assert.equal(bill.accountId, '018f1234-5678-7000-8000-000000000001');
  assert.equal(bill.amountDue.value, '49.00');
  assert.equal(bill.paymentRequired, true);

  // 1c. getAccountMetrics
  const met = await client.getAccountMetrics();
  assert.equal(met.accountId, '018f1234-5678-7000-8000-000000000001');
  assert.equal(met.package?.id, 'pro');
  assert.equal(met.usage.domains.current, 5);
  assert.equal(met.usage.records.current, 42);
  assert.equal(met.usage.dnssec.enabled, true);
  assert.equal(met.usage.tsigKeys.current, 1);

  // 2. getAccountOidc
  const oidc = await client.getAccountOidc();
  assert.equal(oidc.configured, true);
  assert.equal(oidc.clientId, 'client-123');

  // 3. saveAccountOidc
  const saved = await client.saveAccountOidc({
    discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
    clientId: 'client-123',
    clientSecret: 'secret123',
    enforceSso: true,
  });
  assert.equal(saved.enforceSso, true);

  // 4. testAccountOidc
  const testRes = await client.testAccountOidc('https://idp.example.com/.well-known/openid-configuration');
  assert.equal(testRes.success, true);
  assert.equal(testRes.issuer, 'https://idp.example.com');

  // 5. deleteAccountOidc
  const delRes = await client.deleteAccountOidc();
  assert.equal(delRes.success, true);
});
