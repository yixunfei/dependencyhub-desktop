const { execSync, execFileSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const nativePlatforms = { win32: 'win', darwin: 'mac', linux: 'linux' };
const targets = {
  win: { installer: ['nsis'], portable: ['portable'] },
  mac: { installer: ['dmg'], portable: ['zip'] },
  linux: { installer: ['deb', 'rpm'], portable: ['AppImage'] }
};

function builderArguments(platform = 'current', type = 'all', host = process.platform) {
  if (!['current', 'all', ...Object.keys(targets)].includes(platform)) {
    throw new Error(`Invalid platform: ${platform}`);
  }
  if (!['all', 'installer', 'portable'].includes(type)) throw new Error(`Invalid type: ${type}`);
  const resolved = platform === 'current' ? nativePlatforms[host] : platform;
  if (!resolved) throw new Error(`Unsupported platform: ${host}`);
  // dmg/zip mac artifacts can only be produced on macOS; requesting them on
  // other hosts makes electron-builder fail after a full compile cycle.
  const platforms = resolved === 'all'
    ? Object.keys(targets).filter((name) => name !== 'mac' || host === 'darwin')
    : [resolved];
  return platforms.flatMap((name) => [
    `--${name}`,
    ...(type === 'all' ? [...targets[name].installer, ...targets[name].portable] : targets[name][type])
  ]).concat('--publish', 'never');
}

function build(platform = 'current', type = 'all', dependencies = {}) {
  const args = builderArguments(platform, type, dependencies.host);
  const compile = dependencies.compile || (() => execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' }));
  const pack = dependencies.pack || ((builderArgs) => execFileSync(
    process.execPath, [require.resolve('electron-builder/cli.js'), ...builderArgs],
    { cwd: projectRoot, stdio: 'inherit' }
  ));
  compile();
  pack(args);
}

if (require.main === module) {
  try {
    build(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { build, builderArguments, projectRoot };
