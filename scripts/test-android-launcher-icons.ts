import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

interface MipmapDensity {
  folder: string;
  size: number;
}

const DENSITIES: MipmapDensity[] = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  // Check PNG magic: 89 50 4E 47 0D 0A 1A 0A
  assert(
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a,
    'Buffer does not have a valid PNG signature'
  );
  // IHDR chunk: width at 16, height at 20 (big-endian 32-bit unsigned int)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

async function runTests() {
  console.log('🧪 Starting Relix Android Launcher Icons Verification...\n');

  // Candidate paths for Android res folder
  const candidateResDirs = [
    path.resolve(process.cwd(), '../hubsupport-phone-finder-android/app/src/main/res'),
    'C:/Users/mfana/projetos/hubsupport-phone-finder-android/app/src/main/res',
    'c:/Users/mfana/projetos/hubsupport-phone-finder-android/app/src/main/res',
  ];

  let resDir = candidateResDirs.find((dir) => fs.existsSync(dir));
  assert(
    resDir,
    `Android res directory not found in any candidate path:\n${candidateResDirs.join('\n')}`
  );
  console.log(`📁 Found Android res directory: ${resDir}\n`);

  // 1. Verify Mipmap PNGs
  console.log('1. Checking Mipmap PNGs (ic_launcher.png & ic_launcher_round.png across all densities)...');
  const iconNames = ['ic_launcher.png', 'ic_launcher_round.png'];

  for (const { folder, size } of DENSITIES) {
    const folderPath = path.join(resDir, folder);
    assert(
      fs.existsSync(folderPath),
      `Expected mipmap folder does not exist: ${folder}`
    );

    for (const iconName of iconNames) {
      const filePath = path.join(folderPath, iconName);
      assert(
        fs.existsSync(filePath),
        `Icon file missing: ${folder}/${iconName}`
      );

      const buf = fs.readFileSync(filePath);
      assert(
        buf.length > 100,
        `Icon file ${folder}/${iconName} is too small (${buf.length} bytes)`
      );

      const { width, height } = readPngDimensions(buf);
      assert.strictEqual(
        width,
        size,
        `Expected ${folder}/${iconName} width to be ${size}px, got ${width}px`
      );
      assert.strictEqual(
        height,
        size,
        `Expected ${folder}/${iconName} height to be ${size}px, got ${height}px`
      );

      console.log(`  ✓ ${folder}/${iconName}: ${width}x${height} (${buf.length} bytes)`);
    }
  }

  // 2. Verify colors.xml contains relix_brand_rose
  console.log('\n2. Checking colors.xml for Relix brand rose...');
  const colorsXmlPath = path.join(resDir, 'values', 'colors.xml');
  assert(fs.existsSync(colorsXmlPath), 'colors.xml must exist');
  const colorsContent = fs.readFileSync(colorsXmlPath, 'utf8');
  assert(
    colorsContent.includes('relix_brand_rose'),
    'colors.xml must define color resource "relix_brand_rose"'
  );
  assert(
    colorsContent.toLowerCase().includes('#ffde1d4b') || colorsContent.toLowerCase().includes('#de1d4b'),
    'colors.xml relix_brand_rose must have hex value #FFDE1D4B or #DE1D4B'
  );
  console.log('  ✓ colors.xml defines relix_brand_rose = #FFDE1D4B');

  // 3. Verify ic_launcher_background.xml
  console.log('\n3. Checking ic_launcher_background.xml...');
  const bgXmlPath = path.join(resDir, 'drawable', 'ic_launcher_background.xml');
  assert(fs.existsSync(bgXmlPath), 'ic_launcher_background.xml must exist');
  const bgContent = fs.readFileSync(bgXmlPath, 'utf8');
  assert(
    bgContent.includes('@color/relix_brand_rose') || bgContent.toLowerCase().includes('#de1d4b'),
    'ic_launcher_background.xml must reference @color/relix_brand_rose or #DE1D4B'
  );
  console.log('  ✓ ic_launcher_background.xml references relix_brand_rose');

  // 4. Verify ic_launcher_foreground.xml
  console.log('\n4. Checking ic_launcher_foreground.xml...');
  const fgXmlPath = path.join(resDir, 'drawable', 'ic_launcher_foreground.xml');
  assert(fs.existsSync(fgXmlPath), 'ic_launcher_foreground.xml must exist');
  const fgContent = fs.readFileSync(fgXmlPath, 'utf8');
  assert(
    fgContent.includes('android:viewportWidth="108"') && fgContent.includes('android:viewportHeight="108"'),
    'ic_launcher_foreground.xml must have 108x108 viewport'
  );
  assert(
    fgContent.toLowerCase().includes('#ffffff') || fgContent.includes('@android:color/white'),
    'ic_launcher_foreground.xml must render white monogram'
  );
  assert(
    !fgContent.includes('#10B981') && !fgContent.includes('Corpo do smartphone'),
    'ic_launcher_foreground.xml must not contain legacy green or smartphone body'
  );
  console.log('  ✓ ic_launcher_foreground.xml contains clean white monogram in 108x108 viewport');

  // 5. Verify mipmap-anydpi-v26 xml references
  console.log('\n5. Checking mipmap-anydpi-v26 adaptive icon descriptors...');
  const adaptiveLauncher = path.join(resDir, 'mipmap-anydpi-v26', 'ic_launcher.xml');
  const adaptiveRound = path.join(resDir, 'mipmap-anydpi-v26', 'ic_launcher_round.xml');
  assert(fs.existsSync(adaptiveLauncher), 'mipmap-anydpi-v26/ic_launcher.xml must exist');
  assert(fs.existsSync(adaptiveRound), 'mipmap-anydpi-v26/ic_launcher_round.xml must exist');

  const launcherXml = fs.readFileSync(adaptiveLauncher, 'utf8');
  assert(
    launcherXml.includes('@drawable/ic_launcher_background') && launcherXml.includes('@drawable/ic_launcher_foreground'),
    'ic_launcher.xml must link background and foreground drawables'
  );

  const roundXml = fs.readFileSync(adaptiveRound, 'utf8');
  assert(
    roundXml.includes('@drawable/ic_launcher_background') && roundXml.includes('@drawable/ic_launcher_foreground'),
    'ic_launcher_round.xml must link background and foreground drawables'
  );
  console.log('  ✓ mipmap-anydpi-v26 adaptive descriptors link valid background and foreground');

  console.log('\n🎉 ALL ANDROID LAUNCHER ICON VERIFICATIONS PASSED!\n');
}

runTests().catch((err) => {
  console.error('\n❌ Verification failed:', err.message);
  process.exit(1);
});
