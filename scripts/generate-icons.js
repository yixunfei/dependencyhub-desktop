const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const iconDir = path.join(__dirname, '..', 'build', 'icons');

function createIconDirectories() {
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }
  
  const pngDir = path.join(iconDir, 'png');
  if (!fs.existsSync(pngDir)) {
    fs.mkdirSync(pngDir, { recursive: true });
  }
}

function generatePngIcons(sourceIcon) {
  console.log('Generating PNG icons...');
  let failed = false;
  
  sizes.forEach(size => {
    const outputPath = path.join(iconDir, 'png', `${size}x${size}.png`);
    try {
      runMagick([sourceIcon, '-resize', `${size}x${size}`, outputPath]);
      console.log(`✓ Generated ${size}x${size}.png`);
    } catch (error) {
      failed = true;
      console.error(`✗ Failed to generate ${size}x${size}.png:`, error.message);
    }
  });
  if (failed) throw new Error('One or more PNG icons failed to generate');
}

function generateIco(sourceIcon) {
  console.log('Generating ICO file...');
  
  const outputPath = path.join(iconDir, 'icon.ico');
  const pngFiles = sizes
    .filter(size => size <= 256)
    .map(size => path.join(iconDir, 'png', `${size}x${size}.png`))
    .filter(file => fs.existsSync(file))
    .join(' ');
  
  try {
    runMagick([...pngFiles, outputPath]);
    console.log('✓ Generated icon.ico');
  } catch (error) {
    throw new Error(`Failed to generate ICO: ${error.message}`);
  }
}

function generateIcns(sourceIcon) {
  console.log('Generating ICNS file...');
  
  const outputPath = path.join(iconDir, 'icon.icns');
  try {
    runMagick([sourceIcon, outputPath]);
    console.log('✓ Generated icon.icns');
  } catch (error) {
    throw new Error(`Failed to generate ICNS: ${error.message}`);
  }
}

function runMagick(args) {
  const result = spawnSync('magick', args, { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`magick exited with status ${result.status}`);
}

function main() {
  const sourceIcon = process.argv[2] || path.join(__dirname, '..', 'icon.jpg');
  
  if (!fs.existsSync(sourceIcon)) {
    console.error(`Source icon not found: ${sourceIcon}`);
    console.log('\nUsage: node generate-icons.js <source-icon>');
    console.log('Example: node generate-icons.js icon.jpg');
    process.exit(1);
  }
  
  console.log('Starting icon generation...');
  console.log(`Source: ${sourceIcon}\n`);
  
  createIconDirectories();
  generatePngIcons(sourceIcon);
  generateIco(sourceIcon);
  generateIcns(sourceIcon);
  
  console.log('\n✓ Icon generation complete!');
  console.log(`Icons saved to: ${iconDir}`);
}

main();
