const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceImage = 'C:/Users/Aniket Yadav/.gemini/antigravity-ide/brain/45ef8de0-96e9-4775-9fc3-665176dee6f8/.user_uploaded/media_1790319673553.png';

if (!fs.existsSync(sourceImage)) {
  console.error('Source image not found:', sourceImage);
  process.exit(1);
}

const apps = [
  'customer-app',
  'delivery-app',
  'picker-app'
];

const mipmapSizes = [
  { dir: 'mipmap-mdpi', launcher: 48, foreground: 108, fgLogo: 72 },
  { dir: 'mipmap-hdpi', launcher: 72, foreground: 162, fgLogo: 108 },
  { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216, fgLogo: 144 },
  { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324, fgLogo: 216 },
  { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432, fgLogo: 288 }
];

const splashSizes = [
  { folder: 'drawable', w: 480, h: 320, logoSize: 180 },
  { folder: 'drawable-land-mdpi', w: 480, h: 320, logoSize: 180 },
  { folder: 'drawable-land-hdpi', w: 800, h: 480, logoSize: 260 },
  { folder: 'drawable-land-xhdpi', w: 1280, h: 720, logoSize: 380 },
  { folder: 'drawable-land-xxhdpi', w: 1600, h: 960, logoSize: 480 },
  { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280, logoSize: 600 },
  { folder: 'drawable-port-mdpi', w: 320, h: 480, logoSize: 180 },
  { folder: 'drawable-port-hdpi', w: 480, h: 800, logoSize: 260 },
  { folder: 'drawable-port-xhdpi', w: 720, h: 1280, logoSize: 380 },
  { folder: 'drawable-port-xxhdpi', w: 960, h: 1600, logoSize: 480 },
  { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920, logoSize: 600 }
];

async function generateAll() {
  console.log('Generating Android icons and splash screens for customer-app, delivery-app, picker-app...');

  for (const app of apps) {
    const resBase = path.join(__dirname, '..', app, 'android', 'app', 'src', 'main', 'res');
    
    // 1. Generate Mipmap Icons
    for (const m of mipmapSizes) {
      const targetDir = path.join(resBase, m.dir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // ic_launcher.png (direct circular logo resized)
      await sharp(sourceImage)
        .resize(m.launcher, m.launcher, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));

      // ic_launcher_round.png
      await sharp(sourceImage)
        .resize(m.launcher, m.launcher, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_round.png'));

      // ic_launcher_foreground.png (scaled to safe zone centered on 108dp canvas)
      const resizedFgLogo = await sharp(sourceImage)
        .resize(m.fgLogo, m.fgLogo, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toBuffer();

      await sharp({
        create: {
          width: m.foreground,
          height: m.foreground,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        }
      })
      .composite([{ input: resizedFgLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
    }

    // 2. Generate Splash Screens
    for (const s of splashSizes) {
      const targetDir = path.join(resBase, s.folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const resizedLogo = await sharp(sourceImage)
        .resize(s.logoSize, s.logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .toBuffer();

      await sharp({
        create: {
          width: s.w,
          height: s.h,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(targetDir, 'splash.png'));
    }

    // 3. Ensure sub-app public folder has updated web logos as well
    const appPublic = path.join(__dirname, '..', app, 'public');
    if (!fs.existsSync(appPublic)) {
      fs.mkdirSync(appPublic, { recursive: true });
    }
    await sharp(sourceImage).resize(512, 512).png().toFile(path.join(appPublic, 'logo.png'));
    await sharp(sourceImage).resize(192, 192).png().toFile(path.join(appPublic, 'logo-icon.png'));
    await sharp(sourceImage).resize(192, 192).png().toFile(path.join(appPublic, 'logo-square.png'));
    await sharp(sourceImage).resize(512, 512).png().toFile(path.join(appPublic, 'logo-wide.png'));
    await sharp(sourceImage).resize(180, 180).png().toFile(path.join(appPublic, 'apple-touch-icon.png'));
    await sharp(sourceImage).resize(32, 32).png().toFile(path.join(appPublic, 'favicon.png'));
    await sharp(sourceImage).resize(32, 32).png().toFile(path.join(appPublic, 'favicon.ico'));
  }

  // 4. Update Root public folder assets
  const rootPublic = path.join(__dirname, '..', 'public');
  if (fs.existsSync(rootPublic)) {
    await sharp(sourceImage).resize(512, 512).png().toFile(path.join(rootPublic, 'logo.png'));
    await sharp(sourceImage).resize(192, 192).png().toFile(path.join(rootPublic, 'logo-icon.png'));
    await sharp(sourceImage).resize(192, 192).png().toFile(path.join(rootPublic, 'logo-square.png'));
    await sharp(sourceImage).resize(512, 512).png().toFile(path.join(rootPublic, 'logo-wide.png'));
    await sharp(sourceImage).resize(180, 180).png().toFile(path.join(rootPublic, 'apple-touch-icon.png'));
    await sharp(sourceImage).resize(32, 32).png().toFile(path.join(rootPublic, 'favicon.png'));
    await sharp(sourceImage).resize(32, 32).png().toFile(path.join(rootPublic, 'favicon.ico'));

    const rootIcons = path.join(rootPublic, 'icons');
    if (fs.existsSync(rootIcons)) {
      const pwaSizes = [72, 96, 128, 144, 152, 192, 384, 512];
      for (const sz of pwaSizes) {
        await sharp(sourceImage).resize(sz, sz).png().toFile(path.join(rootIcons, `icon-${sz}x${sz}.png`));
      }
      await sharp(sourceImage).resize(72, 72).png().toFile(path.join(rootIcons, 'badge-72x72.png'));
      await sharp(sourceImage).resize(512, 512).png().toFile(path.join(rootIcons, 'icon-maskable-512x512.png'));
    }
  }

  console.log('All icons and splash screens generated successfully!');
}

generateAll().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
