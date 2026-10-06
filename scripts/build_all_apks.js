const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const apps = [
  { name: 'customer-app', apkName: 'PocketKirana-Customer.apk' },
  { name: 'delivery-app', apkName: 'PocketKirana-Delivery.apk' },
  { name: 'picker-app', apkName: 'PocketKirana-Picker.apk' }
];

const capCli = path.join(rootDir, 'customer-app', 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');

for (const app of apps) {
  const appDir = path.join(rootDir, app.name);
  const androidDir = path.join(appDir, 'android');

  console.log(`\n========================================`);
  console.log(` Building: ${app.name}`);
  console.log(`========================================`);

  console.log(`[1/3] Compiling Next.js static export...`);
  execSync('npm run build', { cwd: appDir, stdio: 'inherit' });

  console.log(`[2/3] Syncing web assets to Android...`);
  try {
    execSync(`node "${capCli}" copy android`, { cwd: appDir, stdio: 'inherit' });
  } catch (err) {
    console.log('Capacitor copy note:', err.message);
  }

  // Ensure plugin gradle variables exist for clean Gradle build
  const pluginDir = path.join(androidDir, 'capacitor-cordova-android-plugins');
  const cordVar = path.join(pluginDir, 'cordova.variables.gradle');
  if (!fs.existsSync(cordVar)) {
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.copyFileSync(path.join(rootDir, 'customer-app', 'android', 'capacitor-cordova-android-plugins', 'cordova.variables.gradle'), cordVar);
  }
  const pluginBuild = path.join(pluginDir, 'build.gradle');
  if (!fs.existsSync(pluginBuild)) {
    fs.copyFileSync(path.join(rootDir, 'customer-app', 'android', 'capacitor-cordova-android-plugins', 'build.gradle'), pluginBuild);
  }

  console.log(`[3/3] Compiling Android Gradle APK...`);
  execSync('cmd.exe /c gradlew.bat assembleDebug', { cwd: androidDir, stdio: 'inherit' });

  const builtApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const targetSubApp = path.join(appDir, app.apkName);
  const targetRoot = path.join(rootDir, app.apkName);

  if (fs.existsSync(builtApk)) {
    fs.copyFileSync(builtApk, targetSubApp);
    fs.copyFileSync(builtApk, targetRoot);
    const stat = fs.statSync(targetRoot);
    console.log(`✔ SUCCESS: ${app.apkName} generated (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  } else {
    console.error(`❌ ERROR: Could not find output APK at ${builtApk}`);
    process.exit(1);
  }
}

console.log(`\n========================================`);
console.log(` ALL 3 APKS BUILT AND READY!`);
console.log(`========================================\n`);
