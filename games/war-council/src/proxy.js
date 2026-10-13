import { spawn } from 'node:child_process';

// Node's built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 is set
// at startup (Node >= 22.21 / 24.5). When a proxy is configured (e.g. in a
// cloud sandbox), re-run this script once with it enabled. Returns true in the
// parent, which should then do nothing else.
export function relaunchWithProxy() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy || process.env.NODE_USE_ENV_PROXY) return false;
  const child = spawn(process.execPath, ['--disable-warning=UNDICI-EHPA', ...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
  child.on('exit', (code, sig) => process.exit(code ?? (sig ? 1 : 0)));
  return true;
}
