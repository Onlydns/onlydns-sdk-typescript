# OnlyDNS TypeScript / JavaScript SDK

Official TypeScript & JavaScript SDK for the [OnlyDNS System API](https://api-docs.onlydns.com/).

Built for high-utility DNS management across Node.js, Bun, Deno, Cloudflare Workers, and autonomous AI Agent environments (Model Context Protocol, Vercel AI SDK, LangChain.js, OpenAI tool calling).

## Features

- **Universal Runtime Support**: Built on standard `fetch` — works in Node.js 18+, Bun, Deno, and Edge environments.
- **First-Class TypeScript Support**: Full type definitions for all DNS records, TSIG keys, and API operations.
- **High-Level Atomic Helpers**: Convenient methods (`addRecord`, `removeRecord`, `updateRecord`, `findRecords`) that eliminate repetitive read-modify-write boilerplate.
- **Zero Heavy Runtime Dependencies**: Minimal footprint and instant installation.
- **AI Agent & MCP Ready**: Designed for direct use in tool definitions and agent function calls.

## Installation

```bash
npm install @onlydns/sdk
```

Or using Yarn / pnpm / Bun:

```bash
pnpm add @onlydns/sdk
bun add @onlydns/sdk
```

## Quick Start

```typescript
import { OnlyDNSClient } from '@onlydns/sdk';

// Initialize client (falls back to process.env.ONLYDNS_API_KEY)
const client = new OnlyDNSClient({
  apiToken: 'your_api_token_here',
});

// 1. List Domains
const domains = await client.listDomains();
console.log('Domains:', domains);

// 2. Fetch DNS Records
const records = await client.getRecords('example.com');
console.log('Records:', records);

// 3. High-Level Helper: Add an A record
await client.addRecord('example.com', 'api', 'A', ['192.0.2.1'], 300);

// 4. High-Level Helper: Update / Upsert CNAME record
await client.updateRecord('example.com', 'www', 'CNAME', ['example.com'], 600);

// 5. High-Level Helper: Remove a specific record value
await client.removeRecord('example.com', 'api', 'A', '192.0.2.1');
```

## TSIG Key Management

```typescript
// List TSIG keys
const tsigKeys = await client.getTsigKeys();

// Create new TSIG key
const newKey = await client.createTsigKey({ algorithm: 'hmac-sha256' });
console.log('Created TSIG key:', newKey.name);

// Update Domain TSIG permissions (full zone access)
await client.updateDomainTsig('example.com', newKey.name, true, true);

// Or restrict dynamic DNS updates to specific subdomains (e.g. ACME challenge)
await client.updateDomainTsig('example.com', newKey.name, false, true, ['_acme_challenge']);

// Fetch domain TSIG permissions
const domainTsig = await client.getDomainTsig('example.com');
console.log('Domain TSIG Permissions:', domainTsig);

// Delete all TSIG keys on a domain
await client.deleteDomainTsig('example.com');
```

## DNSSEC & Domain Creation

```typescript
// Create a new domain
await client.createDomain('my-new-domain.com');

// Get DNSSEC status & DS keys
const dnssec = await client.getDnssecStatus('my-new-domain.com');
console.log('DNSSEC Enabled:', dnssec.enabled);
for (const key of dnssec.keys || []) {
  console.log(`KeyTag: ${key.keyTag}, Digest: ${key.digest}`);
}

// Enable DNSSEC
await client.enableDnssec('my-new-domain.com');

// Disable DNSSEC
await client.disableDnssec('my-new-domain.com');
```

## AI Agent / Tool Calling Integration

```typescript
// Example Vercel AI SDK / Model Context Protocol (MCP) tool definition
import { z } from 'zod';
import { OnlyDNSClient } from '@onlydns/sdk';

const onlydns = new OnlyDNSClient();

export const setDnsRecordTool = {
  description: 'Create or update a DNS record for a domain',
  parameters: z.object({
    domain: z.string().describe('Domain name e.g. example.com'),
    name: z.string().describe('Hostname / subdomain e.g. "www" or "@"'),
    type: z.enum(['A', 'AAAA', 'CNAME', 'TXT', 'MX']).describe('Record type'),
    value: z.string().describe('Target value or IP address'),
    ttl: z.number().default(300),
  }),
  execute: async ({ domain, name, type, value, ttl }) => {
    await onlydns.addRecord(domain, name, type, [value], ttl);
    return { success: true, message: `Configured ${name}.${domain} (${type}) -> ${value}` };
  },
};
```

## License

MIT License.
