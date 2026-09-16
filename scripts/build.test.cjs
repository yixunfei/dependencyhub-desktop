const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { build, builderArguments } = require('./build');
const { release } = require('./release');

test('current platform resolves native installer and portable formats', () => {
  assert.deepEqual(builderArguments('current', 'all', 'darwin'), ['--mac', 'dmg', 'zip', '--publish', 'never']);
  assert.deepEqual(builderArguments('current', 'portable', 'linux'), ['--linux', 'AppImage', '--publish', 'never']);
  assert.deepEqual(builderArguments('current', 'installer', 'win32'), ['--win', 'nsis', '--publish', 'never']);
});

test('all platforms really includes every requested platform', () => {
  const args = builderArguments('all');
  for (const platform of ['--win', '--mac', '--linux']) assert.ok(args.includes(platform));
});

test('compile failure prevents packaging and release notes', () => {
  let packaged = false;
  let notes = false;
  const brokenBuild = () => build('current', 'all', {
    compile: () => { throw new Error('compile failed'); },
    pack: () => { packaged = true; }
  });
  assert.throws(() => release('current', { build: brokenBuild, createReleaseNotes: () => { notes = true; } }), /compile failed/);
  assert.equal(packaged, false);
  assert.equal(notes, false);
});

test('packaging failures propagate and do not emit successful release notes', () => {
  let notes = false;
  assert.throws(() => release('current', {
    build: () => build('current', 'all', { compile() {}, pack() { throw new Error('pack failed'); } }),
    createReleaseNotes: () => { notes = true; }
  }), /pack failed/);
  assert.equal(notes, false);
});

test('invalid CLI requests return nonzero without invoking a build', () => {
  for (const script of ['build.js', 'release.js']) {
    const result = spawnSync(process.execPath, [require.resolve(`./${script}`), 'invalid']);
    assert.equal(result.status, 1);
  }
});
