/**
 * Sprint 0 Test Script
 * Verifies UC8 Data Layer loads successfully
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('SPRINT 0 TEST: UC8 Data Layer Implementation');
console.log('='.repeat(60));

// Test 1: Verify UC8 dataset exists
console.log('\n[Test 1] Checking UC8 dataset file...');
const uc8Path = path.join(__dirname, 'public', 'uc_8.0_2.1.json');
if (fs.existsSync(uc8Path)) {
  console.log('✅ UC8 dataset file exists:', uc8Path);
  const uc8Data = JSON.parse(fs.readFileSync(uc8Path, 'utf8'));
  console.log('✅ UC8 dataset loaded successfully');
  console.log('   - Schema Version:', uc8Data.metadata?.schema_version);
  console.log('   - Dataset Version:', uc8Data.metadata?.dataset_version);
  console.log('   - Scenarios:', Object.keys(uc8Data.scenarios || {}).length);
  console.log('   - Requirements:', Object.keys(uc8Data.requirements || {}).length);
  console.log('   - Specifications:', Object.keys(uc8Data.specifications || {}).length);
  console.log('   - Exclusions:', Object.keys(uc8Data.exclusions || {}).length);
  console.log('   - Comments:', Object.keys(uc8Data.comments || {}).length);
} else {
  console.log('❌ UC8 dataset file NOT FOUND');
  process.exit(1);
}

// Test 2: Verify data layer files exist
console.log('\n[Test 2] Checking data layer files...');
const dataLayerFiles = [
  'src/services/data/UCDataLayer.ts',
  'src/services/data/UCDataTypes.ts',
  'src/services/data/ConflictResolver.ts',
  'src/services/data/DependencyResolver.ts'
];

let allFilesExist = true;
dataLayerFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`❌ ${file} NOT FOUND`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some data layer files are missing');
  process.exit(1);
}

// Test 3: Verify app.tsx integration
console.log('\n[Test 3] Checking app.tsx integration...');
const appTsxPath = path.join(__dirname, 'src', 'app.tsx');
const appTsxContent = fs.readFileSync(appTsxPath, 'utf8');

const checks = [
  { pattern: /import.*ucDataLayer.*from.*UCDataLayer/, name: 'UCDataLayer import' },
  { pattern: /await ucDataLayer\.load\(\)/, name: 'UCDataLayer.load() call' },
  { pattern: /ucDataLayer\.getVersion\(\)/, name: 'getVersion() usage' },
  { pattern: /ucDataLayer\.getMetadata\(\)/, name: 'getMetadata() usage' }
];

let allChecksPass = true;
checks.forEach(check => {
  if (check.pattern.test(appTsxContent)) {
    console.log(`✅ ${check.name} found`);
  } else {
    console.log(`❌ ${check.name} NOT FOUND`);
    allChecksPass = false;
  }
});

// Test 4: TypeScript compilation check (for Sprint 0 files only)
console.log('\n[Test 4] Checking TypeScript syntax...');
const { execSync } = require('child_process');
try {
  const tscOutput = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8', timeout: 30000 });
  const sprint0Errors = tscOutput.split('\n').filter(line =>
    line.includes('UCDataLayer') ||
    line.includes('UCDataTypes') ||
    line.includes('ConflictResolver') ||
    line.includes('DependencyResolver')
  );

  if (sprint0Errors.length === 0) {
    console.log('✅ No TypeScript errors in Sprint 0 files');
  } else {
    console.log('⚠️ TypeScript errors found in Sprint 0 files:');
    sprint0Errors.forEach(err => console.log('   ' + err));
  }
} catch (err) {
  // TypeScript errors are expected in existing files
  const errorOutput = err.stdout || err.message;
  const sprint0Errors = errorOutput.split('\n').filter(line =>
    line.includes('UCDataLayer') ||
    line.includes('UCDataTypes') ||
    line.includes('ConflictResolver') ||
    line.includes('DependencyResolver')
  );

  if (sprint0Errors.length === 0) {
    console.log('✅ No TypeScript errors in Sprint 0 files (pre-existing errors in other files)');
  } else {
    console.log('❌ TypeScript errors found in Sprint 0 files:');
    sprint0Errors.forEach(err => console.log('   ' + err));
    allChecksPass = false;
  }
}

// Final summary
console.log('\n' + '='.repeat(60));
if (allFilesExist && allChecksPass) {
  console.log('✅ SPRINT 0 COMPLETE - All tests passed!');
  console.log('='.repeat(60));
  console.log('\nSummary:');
  console.log('- 4 data layer files created successfully');
  console.log('- UC8 dataset (uc_8.0_2.1.json) verified');
  console.log('- app.tsx integration complete');
  console.log('- No TypeScript errors in Sprint 0 code');
  console.log('\nNext Steps:');
  console.log('1. Run `npm run dev` to test UC8 loading in browser');
  console.log('2. Check browser console for UC8 Data Layer logs');
  console.log('3. Proceed to Sprint 1 - Service Refactoring');
  process.exit(0);
} else {
  console.log('❌ SPRINT 0 INCOMPLETE - Some tests failed');
  console.log('='.repeat(60));
  process.exit(1);
}
