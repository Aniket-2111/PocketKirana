const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const logoIconPath = path.join(__dirname, '../public/logo-icon.png');
const logoFullPath = path.join(__dirname, '../public/logo-full.png');
const iconsDir = path.join(__dirname, '../public/icons');
const publicDir = path.join(__dirname, '../public');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateSquareIcon(size, paddingPercent = 0.1) {
  const iconBuffer = fs.readFileSync(logoIconPath);
  const targetSize = Math.round(size * (1 - paddingPercent * 2));
  
  const resizedIcon = await sharp(iconBuffer)
    .resize(targetSize, targetSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  const pad = Math.round((size - targetSize) / 2);

  return sharp(resizedIcon)
    .extend({
      top: pad,
      bottom: size - targetSize - pad,
      left: pad,
      right: size - targetSize - pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

async function generate() {
  console.log('Generating PWA icons from new logo...');

  for (const size of sizes) {
    const outPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    const iconBuf = await generateSquareIcon(size, 0.08);
    await sharp(iconBuf).toFile(outPath);
    console.log(`✓ Generated ${outPath}`);
  }

  // Generate maskable icon with safe-zone padding and solid background
  const maskablePath = path.join(iconsDir, 'icon-maskable-512x512.png');
  const maskableIconBuf = await generateSquareIcon(512, 0.2); // 20% safe zone for maskable
  await sharp(maskableIconBuf)
    .flatten({ background: { r: 5, g: 150, b: 105 } }) // emerald-600 background for maskable
    .toFile(maskablePath);
  console.log(`✓ Generated maskable icon ${maskablePath}`);

  // Badge icon (72x72 monochrome/transparent badge for notifications)
  const badgePath = path.join(iconsDir, 'badge-72x72.png');
  const badgeBuf = await generateSquareIcon(72, 0.05);
  await sharp(badgeBuf).toFile(badgePath);
  console.log(`✓ Generated badge icon ${badgePath}`);

  // Apple touch icon in root public (180x180)
  const appleTouchPath = path.join(publicDir, 'apple-touch-icon.png');
  const appleTouchBuf = await generateSquareIcon(180, 0.1);
  await sharp(appleTouchBuf)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toFile(appleTouchPath);
  console.log(`✓ Generated apple-touch-icon ${appleTouchPath}`);

  // Favicon 32x32 & 16x16 PNGs
  const favicon32Path = path.join(publicDir, 'favicon.png');
  const favicon32Buf = await generateSquareIcon(32, 0.05);
  await sharp(favicon32Buf).toFile(favicon32Path);
  console.log(`✓ Generated favicon ${favicon32Path}`);

  console.log('All PWA icons successfully generated from new project logo!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
