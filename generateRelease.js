const fs = require('fs');
const path = require('path');

// Konfiguration
const KEEP_STABLE = 3;      // wie viele Releases behalten
const KEEP_PRE = 3;         // wie viele Pre-Releases behalten

const firmwareDir = path.resolve(__dirname, 'firmware');
const binFiles = fs.readdirSync(firmwareDir).filter(f => f.endsWith('.bin'));

if (binFiles.length === 0) {
  console.log('❌ No .bin files found in firmware folder.');
  process.exit(1);
}

// ⬅️ Sortiere nach Änderungszeit (neueste oben)
binFiles.sort((a, b) => {
  const aTime = fs.statSync(path.join(firmwareDir, a)).mtimeMs;
  const bTime = fs.statSync(path.join(firmwareDir, b)).mtimeMs;
  return bTime - aTime;
});

// ➗ Trennen in stable vs. prerelease
const stable = [];
const pre = [];

for (const file of binFiles) {
  const lower = file.toLowerCase();
  (lower.includes('nightly') || lower.includes('beta') ? pre : stable).push(file);
}

// ✂️ Nur die letzten X behalten
const selectedFiles = [...stable.slice(0, KEEP_STABLE), ...pre.slice(0, KEEP_PRE)];

// 🗑 Alle anderen löschen
const toDelete = binFiles.filter(f => !selectedFiles.includes(f));
for (const file of toDelete) {
  try {
    fs.unlinkSync(path.join(firmwareDir, file));
    const json = file.replace(/\.bin$/, '.json');
    const jsonPath = path.join(firmwareDir, json);
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    console.log(`🗑 Removed old firmware: ${file}`);
  } catch (e) {
    console.warn(`⚠️ Could not delete ${file}:`, e.message);
  }
}

// 🧾 Neu aufbauen
const firmwareList = [];

for (const file of selectedFiles) {
  const versionMatch = file.match(/_V?([\w.\-]+)\.bin$/);
  const version = versionMatch ? versionMatch[1] : 'unknown';
  const isPre = file.toLowerCase().includes('nightly') || file.toLowerCase().includes('beta');

  firmwareList.push({
    version,
    prerelease: isPre,
    file
  });

  const manifest = {
    name: file.replace(/\.bin$/, ''),
    version,
    builds: [
      {
        chipFamily: "ESP32",
        parts: [
          {
            path: file,
            offset: 0
          }
        ]
      }
    ]
  };

  const manifestPath = path.join(firmwareDir, file.replace(/\.bin$/, '.json'));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ Created manifest: ${manifestPath}`);
}

// 💾 firmware.json schreiben
const firmwareJsonPath = path.join(firmwareDir, 'firmware.json');
fs.writeFileSync(firmwareJsonPath, JSON.stringify(firmwareList, null, 2));

// Zeitstempel
fs.writeFileSync(path.join(firmwareDir, 'last_update.txt'), `Updated at ${new Date().toISOString()}`);
console.log("✅ Firmware list and manifests updated.");
