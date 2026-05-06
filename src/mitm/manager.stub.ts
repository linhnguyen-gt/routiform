// Build-time stub for @/mitm/manager
// Used by Turbopack during next build to avoid native module resolution errors.
// The real module is used at runtime via dynamic import in route handlers.

export const getCachedPassword = () => null;
export const setCachedPassword = (_pwd: string) => {};
export const clearCachedPassword = () => {};
export const isDocker = () => false;
export const checkPort443Free = () => Promise.resolve(true);
export const getPort443Owner = () => null;
export const loadEncryptedPassword = () => Promise.resolve(null);
export const saveEncryptedPassword = (_pwd: string) => Promise.resolve();
export const clearEncryptedPassword = () => Promise.resolve();
export const getMitmStatus = async () => ({
  running: false,
  pid: null,
  certExists: false,
  certTrusted: false,
  dnsStatus: {},
  hasCachedPassword: false,
});
export const startMitm = async (_apiKey: string, _sudoPassword: string) => ({
  running: false,
  pid: null,
});
export const stopMitm = async (_sudoPassword: string) => ({ running: false, pid: null });
export const enableToolDNS = async (_tool: string, _sudoPassword: string) => {};
export const disableToolDNS = async (_tool: string, _sudoPassword: string) => {};
