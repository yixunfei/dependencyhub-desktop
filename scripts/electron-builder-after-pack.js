const fs = require('fs');
const path = require('path');

const retainedLocales = new Set(['en-US.pak', 'zh-CN.pak']);
const retainedLocaleBundles = new Set(['en.lproj', 'zh_CN.lproj', 'Base.lproj']);
const removableRuntimeFiles = [
  'dxcompiler.dll',
  'dxil.dll',
  'vulkan-1.dll',
  'vk_swiftshader.dll',
  'vk_swiftshader_icd.json'
];

exports.default = async function afterPack(context) {
  const localesDir = path.join(context.appOutDir, 'locales');
  const macResources = findMacResources(context.appOutDir);

  const removedLocales =
    (fs.existsSync(localesDir) ? pruneLocales(localesDir) : 0) +
    (macResources ? pruneMacLocales(macResources) : 0);
  pruneRuntimeFiles(context.appOutDir);

  if (!fs.existsSync(localesDir) && !macResources) {
    // Log instead of silently skipping: a layout change would otherwise make
    // the size optimization silently stop working.
    console.log('No Electron locale directory matched the expected layout; nothing pruned');
  } else if (removedLocales === 0) {
    console.log('Electron locales already match the retained set; nothing pruned');
  }
};

function pruneLocales(localesDir) {
  let removed = 0;
  for (const entry of fs.readdirSync(localesDir, { withFileTypes: true })) {
    if (!entry.isFile() || retainedLocales.has(entry.name)) continue;
    fs.rmSync(path.join(localesDir, entry.name), { force: true });
    removed += 1;
  }

  if (removed > 0) {
    console.log(`Pruned ${removed} unused Electron locale files`);
  }
  return removed;
}

// macOS does not use a sibling `locales` directory: locale bundles are
// `*.lproj` folders inside `<Product>.app/Contents/Resources`. Without this
// branch the pruning was a silent no-op on every mac build.
function findMacResources(appOutDir) {
  let appBundleName;
  try {
    appBundleName = fs
      .readdirSync(appOutDir, { withFileTypes: true })
      .find((entry) => entry.isDirectory() && entry.name.endsWith('.app'))?.name;
  } catch {
    return null;
  }
  if (!appBundleName) return null;

  const resources = path.join(appOutDir, appBundleName, 'Contents', 'Resources');
  return fs.existsSync(resources) ? resources : null;
}

function pruneMacLocales(resourcesDir) {
  let removed = 0;
  for (const entry of fs.readdirSync(resourcesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith('.lproj') || retainedLocaleBundles.has(entry.name)) continue;
    fs.rmSync(path.join(resourcesDir, entry.name), { recursive: true, force: true });
    removed += 1;
  }

  if (removed > 0) {
    console.log(`Pruned ${removed} unused macOS locale bundles`);
  }
  return removed;
}

function pruneRuntimeFiles(appOutDir) {
  let removed = 0;
  for (const fileName of removableRuntimeFiles) {
    const filePath = path.join(appOutDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    fs.rmSync(filePath, { force: true });
    removed += 1;
  }

  if (removed > 0) {
    console.log(`Pruned ${removed} optional Electron GPU runtime files`);
  }
}
