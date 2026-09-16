const fs = require('node:fs');
const path = require('node:path');
const { build, projectRoot } = require('./build');
const { version } = require('../package.json');

function createReleaseNotes() {
  const changelog = fs.readFileSync(path.join(projectRoot, 'CHANGELOG.md'), 'utf8');
  const marker = `## [${version}]`;
  const start = changelog.indexOf(marker);
  if (start < 0) throw new Error(`CHANGELOG.md has no entry for ${version}`);
  const end = changelog.indexOf('\n## [', start + marker.length);
  const notes = `# DependencyHub Desktop v${version}\n\n${changelog.slice(start, end < 0 ? undefined : end).trim()}\n`;
  const directory = path.join(projectRoot, 'release');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `RELEASE_NOTES_v${version}.md`), notes);
}

function release(target = 'current', dependencies = {}) {
  if (!['current', 'all'].includes(target)) throw new Error(`Invalid release target: ${target}`);
  (dependencies.build || build)(target, 'all');
  (dependencies.createReleaseNotes || createReleaseNotes)();
}

if (require.main === module) {
  try {
    release(process.argv[2]);
    console.log('Release build completed. Artifacts are in release/.');
  } catch (error) {
    console.error(`Release failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { release, createReleaseNotes };
