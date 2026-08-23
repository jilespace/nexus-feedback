import { promises as dnsPromises } from 'node:dns';
import { env } from '../config/index.js';
import { ValidationError } from './errors.js';

type ResolvedAddress = { address: string; family: number };

const FORBIDDEN_HOSTNAMES = new Set(['localhost', 'ip6-localhost', 'ip6-loopback']);

function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return NaN;
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToLong(ip);
  if (Number.isNaN(n)) return true; // unparseable → treat as unsafe

  const inCidr = (cidr: string): boolean => {
    const [base, bitsStr] = cidr.split('/');
    const bits = Number(bitsStr);
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((ipv4ToLong(base!) & mask) >>> 0);
  };

  return (
    inCidr('0.0.0.0/8') ||
    inCidr('10.0.0.0/8') ||
    inCidr('100.64.0.0/10') ||
    inCidr('127.0.0.0/8') ||
    inCidr('169.254.0.0/16') ||
    inCidr('172.16.0.0/12') ||
    inCidr('192.168.0.0/16')
  );
}

function expandIpv6(addr: string): number[] | null {
  let rest = addr;
  const v4Tail = rest.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Tail) {
    const n = ipv4ToLong(v4Tail[2]!);
    if (Number.isNaN(n)) return null;
    rest = `${v4Tail[1]}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }

  const halves = rest.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':').filter(Boolean) : [];

  const groups =
    halves.length === 2
      ? [...head, ...Array<string>(Math.max(8 - head.length - tail.length, 0)).fill('0'), ...tail]
      : head;
  if (groups.length !== 8) return null;

  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some((n) => Number.isNaN(n)) ? null : nums;
}

function isPrivateIpv6(ip: string): boolean {
  const g = expandIpv6(ip.toLowerCase());
  if (!g) return true; // malformed → unsafe

  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1

  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    // ::ffff:0:0/96 — IPv4-mapped
    const v4 = [
      (g[6]! >> 8) & 0xff,
      g[6]! & 0xff,
      (g[7]! >> 8) & 0xff,
      g[7]! & 0xff,
    ].join('.');
    return isPrivateIpv4(v4);
  }

  if ((g[0]! & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  return false;
}

function isPrivateAddress(address: string): boolean {
  return address.includes(':') ? isPrivateIpv6(address) : isPrivateIpv4(address);
}

async function resolveAndCheck(hostname: string): Promise<void> {
  let addresses: ResolvedAddress[];
  try {
    addresses = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ValidationError('不允许的 Webhook 地址');
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new ValidationError('不允许的 Webhook 地址');
    }
  }
}

export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationError('不允许的 Webhook 地址');
  }

  const schemeAllowed =
    url.protocol === 'https:' || (env.NODE_ENV === 'development' && url.protocol === 'http:');
  if (!schemeAllowed) {
    throw new ValidationError('不允许的 Webhook 地址');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    FORBIDDEN_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new ValidationError('不允许的 Webhook 地址');
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
    // literal IP address — range-checked directly, no DNS involved
    if (!isPrivateAddress(hostname)) return;
    throw new ValidationError('不允许的 Webhook 地址');
  }

  await resolveAndCheck(hostname);
}
