const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const iconDir = path.join(__dirname, '..', 'build', 'icons');
const pngDir = path.join(iconDir, 'png');

function createDirectories() {
  [iconDir, pngDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function checkImageMagick() {
  try {
    execSync('magick --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function generatePngIcons(sourceIcon) {
  console.log('Generating PNG icons...');

  let failures = 0;
  sizes.forEach(size => {
    const outputPath = path.join(pngDir, `${size}x${size}.png`);
    try {
      execSync(`magick "${sourceIcon}" -resize ${size}x${size} "${outputPath}"`, { stdio: 'inherit' });
      console.log(`✓ Generated ${size}x${size}.png`);
    } catch (error) {
      failures += 1;
      console.error(`✗ Failed to generate ${size}x${size}.png`);
    }
  });
  return failures;
}

function generateIco() {
  console.log('\nGenerating ICO file...');

  const outputPath = path.join(iconDir, 'icon.ico');
  const pngFiles = sizes
    .filter(size => size <= 256)
    .map(size => path.join(pngDir, `${size}x${size}.png`))
    .filter(file => fs.existsSync(file))
    .map(file => `"${file}"`)
    .join(' ');

  if (!pngFiles) {
    console.error('✗ No PNG files found for ICO generation');
    return false;
  }

  try {
    execSync(`magick ${pngFiles} "${outputPath}"`, { stdio: 'inherit' });
    console.log('✓ Generated icon.ico');
    return true;
  } catch (error) {
    console.error('✗ Failed to generate ICO');
    return false;
  }
}

function generateIcns(sourceIcon) {
  console.log('\nGenerating ICNS file...');
  
  const outputPath = path.join(iconDir, 'icon.icns');
  try {
    execSync(`magick "${sourceIcon}" "${outputPath}"`, { stdio: 'inherit' });
    console.log('✓ Generated icon.icns');
    return true;
  } catch (error) {
    console.error('✗ Failed to generate ICNS');
    return false;
  }
}

function main() {
  const sourceIcon = process.argv[2] || path.join(__dirname, '..', 'icon.jpg');
  
  if (!fs.existsSync(sourceIcon)) {
    console.error(`✗ Source icon not found: ${sourceIcon}`);
    console.log('\nPlease provide a source icon file (JPG, PNG, or SVG)');
    console.log('Usage: npm run build:icons [source-icon]');
    process.exit(1);
  }
  
  console.log('='.repeat(50));
  console.log('Icon Generation Script');
  console.log('='.repeat(50));
  console.log(`Source: ${sourceIcon}\n`);
  
  if (!checkImageMagick()) {
    console.error('✗ ImageMagick is not installed or not in PATH');
    console.log('\nTo install ImageMagick:');
    console.log('  Windows: choco install imagemagick');
    console.log('  macOS: brew install imagemagick');
    console.log('  Linux: sudo apt-get install imagemagick');
    console.log('\nAlternatively, use online tools to convert your icon:');
    console.log('  - https://convertio.co/png-ico/');
    console.log('  - https://iconifier.net/');
    process.exit(1);
  }
  
  console.log('✓ ImageMagick found\n');
  
  createDirectories();
  const pngFailures = generatePngIcons(sourceIcon);
  const icoOk = generateIco();
  const icnsOk = generateIcns(sourceIcon);

  // A partial failure must not exit 0: a truncated icon set would otherwise
  // silently flow into the packaged installers.
  if (pngFailures > 0 || !icoOk || !icnsOk) {
    console.error(`\n✗ Icon generation finished with errors (${pngFailures} PNG size(s) failed)`);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✓ Icon generation complete!');
  console.log(`Icons saved to: ${iconDir}`);
  console.log('='.repeat(50));
}

main();