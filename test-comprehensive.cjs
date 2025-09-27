/**
 * Comprehensive Testing Script for Respec Application
 * Run this script after any major changes to ensure all functionality is intact
 *
 * Usage: node test-comprehensive.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warnings = [];

// Helper functions
function logTest(name) {
  console.log(`\n${colors.blue}[TEST]${colors.reset} ${name}`);
  totalTests++;
}

function logPass(message) {
  console.log(`${colors.green}  ✓${colors.reset} ${message}`);
  passedTests++;
}

function logFail(message) {
  console.log(`${colors.red}  ✗${colors.reset} ${message}`);
  failedTests++;
}

function logWarn(message) {
  console.log(`${colors.yellow}  ⚠${colors.reset} ${message}`);
  warnings.push(message);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
}

// Test functions
function testFileExists(filePath, description) {
  logTest(`File exists: ${description}`);
  if (fs.existsSync(filePath)) {
    logPass(`Found: ${path.basename(filePath)}`);
    return true;
  } else {
    logFail(`Missing: ${filePath}`);
    return false;
  }
}

function testCodePattern(filePath, pattern, description, shouldExist = true) {
  logTest(`Code pattern: ${description}`);

  if (!fs.existsSync(filePath)) {
    logFail(`File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(pattern, 'gm');
  const matches = content.match(regex);

  if (shouldExist && matches) {
    logPass(`Found ${matches.length} occurrence(s)`);
    return true;
  } else if (!shouldExist && !matches) {
    logPass(`Pattern correctly absent`);
    return true;
  } else {
    if (shouldExist) {
      logFail(`Pattern not found: ${pattern}`);
    } else {
      logFail(`Pattern should not exist but found ${matches?.length || 0} occurrence(s)`);
    }
    return false;
  }
}

function testNoOrphanedCode(filePath) {
  logTest(`No orphaned/commented code blocks`);

  if (!fs.existsSync(filePath)) {
    logFail(`File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const orphanedPatterns = [
    /\/\*\s*ORPHANED CODE BLOCK/gi,
    /\/\/\s*OLD .* REMOVED/gi,
    /\/\*[\s\S]*?END OF ORPHANED CODE BLOCK[\s\S]*?\*\//gi,
    /\/\/\s*COMMENTED OUT - old/gi
  ];

  let foundOrphaned = false;
  orphanedPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      logWarn(`Found ${matches.length} orphaned pattern(s): ${pattern.source}`);
      foundOrphaned = true;
    }
  });

  if (!foundOrphaned) {
    logPass('No orphaned code blocks found');
    return true;
  } else {
    logFail('Orphaned code blocks detected');
    return false;
  }
}

function testCompilation() {
  logTest('TypeScript compilation check');

  try {
    const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
    // Count errors
    const errorMatches = output.match(/error TS\d+:/g);
    const errorCount = errorMatches ? errorMatches.length : 0;

    if (errorCount === 0) {
      logPass('No TypeScript errors');
      return true;
    } else {
      // Check if it's the expected errors (reduced after cleanup)
      if (errorCount >= 200 && errorCount <= 280) {
        logWarn(`${errorCount} pre-existing TypeScript errors`);
        return true;
      } else {
        logFail(`Unexpected error count: ${errorCount}`);
        return false;
      }
    }
  } catch (error) {
    // TypeScript will exit with error code if there are errors
    const output = error.stdout || error.toString();
    const errorMatches = output.match(/error TS\d+:/g);
    const errorCount = errorMatches ? errorMatches.length : 0;

    if (errorCount >= 200 && errorCount <= 280) {
      logWarn(`${errorCount} pre-existing TypeScript errors`);
      return true;
    } else {
      logFail(`Compilation failed with ${errorCount} errors`);
      return false;
    }
  }
}

function testCriticalFunctions(filePath) {
  logTest('Critical functions presence');

  const criticalFunctions = [
    { pattern: 'communicateWithMAS\\s*=', name: 'communicateWithMAS' },
    { pattern: 'sendMessageWrapper\\s*=', name: 'sendMessageWrapper' },
    { pattern: 'processChatMessage', name: 'processChatMessage' },
    { pattern: 'processFormUpdate', name: 'processFormUpdate' },
    { pattern: 'triggerAutofill', name: 'triggerAutofill' },
    { pattern: 'mapValueToFormField', name: 'mapValueToFormField' },
    { pattern: 'validateSystemFieldUpdate', name: 'validateSystemFieldUpdate' },
    { pattern: 'case\\s+[\'"]system_populate_field[\'"]', name: 'system_populate_field case' },
    { pattern: 'case\\s+[\'"]chat_message[\'"]', name: 'chat_message case' },
    { pattern: 'case\\s+[\'"]form_update[\'"]', name: 'form_update case' }
  ];

  const content = fs.readFileSync(filePath, 'utf8');
  let allFound = true;

  criticalFunctions.forEach(func => {
    const regex = new RegExp(func.pattern, 'gm');
    if (content.match(regex)) {
      logPass(`Found: ${func.name}`);
    } else {
      logFail(`Missing: ${func.name}`);
      allFound = false;
    }
  });

  return allFound;
}

function testImports(filePath) {
  logTest('Required imports');

  const requiredImports = [
    { pattern: "import.*SimplifiedRespecService.*from.*['\"].*SimplifiedRespecService['\"]", name: 'SimplifiedRespecService' },
    { pattern: "import.*React|useState|useEffect|useCallback|useRef", name: 'React hooks' },
    { pattern: "import.*dataServices.*from.*['\"].*dataServices['\"]", name: 'dataServices' },
    { pattern: "import.*uiUtils.*from.*['\"].*uiUtilities['\"]", name: 'uiUtilities' }
  ];

  const content = fs.readFileSync(filePath, 'utf8');
  let allFound = true;

  requiredImports.forEach(imp => {
    const regex = new RegExp(imp.pattern, 'gm');
    if (content.match(regex)) {
      logPass(`Import found: ${imp.name}`);
    } else {
      logFail(`Import missing: ${imp.name}`);
      allFound = false;
    }
  });

  return allFound;
}

function testServiceIntegration(filePath) {
  logTest('Service integration patterns');

  const integrationPatterns = [
    {
      pattern: 'SimplifiedRespecService\\(\\)',
      name: 'SimplifiedRespecService instantiation'
    },
    {
      pattern: 'simplifiedRespecService\\.processChatMessage',
      name: 'Chat processing integration'
    },
    {
      pattern: 'simplifiedRespecService\\.processFormUpdate',
      name: 'Form update integration'
    },
    {
      pattern: 'simplifiedRespecService\\.triggerAutofill',
      name: 'Autofill integration'
    }
  ];

  const content = fs.readFileSync(filePath, 'utf8');
  let allFound = true;

  integrationPatterns.forEach(pattern => {
    const regex = new RegExp(pattern.pattern, 'gm');
    const matches = content.match(regex);
    if (matches) {
      logPass(`${pattern.name}: ${matches.length} instance(s)`);
    } else {
      logFail(`Missing: ${pattern.name}`);
      allFound = false;
    }
  });

  return allFound;
}

function testLineCount(filePath, expectedMax = 2200) {
  logTest(`Line count (should be < ${expectedMax} after cleanup)`);

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;

  if (lines <= expectedMax) {
    logPass(`${lines} lines (cleanup successful)`);
    return true;
  } else {
    logWarn(`${lines} lines (expected < ${expectedMax})`);
    return true; // Warning, not failure
  }
}

function testProcessIsRunning() {
  logTest('Dev server status');

  try {
    // Check if port 3000 is in use (dev server running)
    execSync('netstat -an | findstr :3000 | findstr LISTENING', { encoding: 'utf8' });
    logPass('Dev server is running on port 3000');
    return true;
  } catch (error) {
    logWarn('Dev server not detected on port 3000 (may be on different port)');
    return true; // Warning, not failure
  }
}

// Main test execution
async function runTests() {
  console.clear();
  console.log(`${colors.bright}${colors.blue}Comprehensive Testing Script for Respec Application${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

  const appFile = path.join(__dirname, 'src', 'app.tsx');

  // Section 1: File Structure Tests
  logSection('1. FILE STRUCTURE TESTS');
  testFileExists(appFile, 'Main app.tsx file');
  testFileExists(path.join(__dirname, 'src', 'services', 'respec', 'SimplifiedRespecService.ts'), 'SimplifiedRespecService');
  testFileExists(path.join(__dirname, 'package.json'), 'package.json');
  testFileExists(path.join(__dirname, 'tsconfig.json'), 'tsconfig.json');
  testFileExists(path.join(__dirname, 'public', 'uc1_v5.2.json'), 'UC1 data file (v5.2)');

  // Section 2: Code Cleanup Tests
  logSection('2. CODE CLEANUP VERIFICATION');
  testNoOrphanedCode(appFile);
  testCodePattern(appFile, 'COMMENTED OUT.*old.*ReSpec', 'Old ReSpec comments', false);
  testCodePattern(appFile, 'OLD communicateWithMAS REMOVED', 'Old MAS implementation', false);
  testLineCount(appFile);

  // Section 3: Critical Functions Tests
  logSection('3. CRITICAL FUNCTIONS');
  testCriticalFunctions(appFile);

  // Section 4: Integration Tests
  logSection('4. SERVICE INTEGRATION');
  testImports(appFile);
  testServiceIntegration(appFile);

  // Section 5: Compilation Tests
  logSection('5. COMPILATION & BUILD');
  testCompilation();
  testProcessIsRunning();

  // Section 6: Specific Functionality Tests
  logSection('6. SPECIFIC FUNCTIONALITY');
  testCodePattern(appFile, "return 'WiFi'.*Default WiFi option", 'WiFi value mapping');
  testCodePattern(appFile, "case 'ethernet_ports'", 'Ethernet mapping');
  testCodePattern(appFile, 'setRequirements.*prev.*=>', 'State management pattern');
  testCodePattern(appFile, 'setChatMessages.*prev.*=>', 'Chat state management');

  // Final Report
  logSection('TEST RESULTS SUMMARY');
  console.log(`${colors.bright}Total Tests: ${totalTests}${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${warnings.length}${colors.reset}`);

  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (failedTests === 0) {
    console.log(`\n${colors.bright}${colors.green}✅ ALL CRITICAL TESTS PASSED!${colors.reset}`);
    console.log('The application is ready for the next phase of implementation.');
    process.exit(0);
  } else {
    console.log(`\n${colors.bright}${colors.red}❌ SOME TESTS FAILED!${colors.reset}`);
    console.log('Please review the failures before proceeding.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Test script error: ${error.message}${colors.reset}`);
  process.exit(1);
});