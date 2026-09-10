export type WorkBuddySite = 'global' | 'cn';

const GLOBAL_HOST_SUFFIXES = ['.workbuddy.ai'];
const GLOBAL_HOSTS = new Set(['workbuddy.ai']);

const normalizeHost = (value: string): string => {
  let host = value.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, '');
  const slash = host.indexOf('/');
  if (slash >= 0) host = host.slice(0, slash);
  return host.replace(/\.$/, '');
};

export const isWorkBuddyGlobalDomain = (domain: string): boolean => {
  const host = normalizeHost(domain);
  if (!host) return false;
  return GLOBAL_HOSTS.has(host) || GLOBAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
};

export const normalizeWorkBuddySite = (value: unknown): WorkBuddySite => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return raw === 'cn' || raw === 'china' ? 'cn' : 'global';
};

export const resolveWorkBuddySite = (file: {
  type?: unknown;
  provider?: unknown;
  domain?: unknown;
  region?: unknown;
}): WorkBuddySite | null => {
  const provider = String(file.type ?? file.provider ?? '')
    .trim()
    .toLowerCase();
  if (provider !== 'workbuddy') return null;

  const region = typeof file.region === 'string' ? file.region.trim().toLowerCase() : '';
  if (region === 'global' || region === 'cn') return region;

  const domain = typeof file.domain === 'string' ? file.domain : '';
  if (isWorkBuddyGlobalDomain(domain)) return 'global';
  return 'cn';
};
