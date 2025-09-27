/**
 * Field Structure Enhancement Testing Script
 * Tests the enhanced field data structure with dataSource, priority, and toggleHistory
 *
 * Usage: node test-field-structure.cjs
 */

const fs = require('fs');
const path = require('path');

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

function testFieldStructurePattern(filePath, pattern, description, expectedCount = 1) {
  logTest(`Field structure: ${description}`);

  if (!fs.existsSync(filePath)) {
    logFail(`File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(pattern, 'gm');
  const matches = content.match(regex);
  const matchCount = matches ? matches.length : 0;

  if (matchCount >= expectedCount) {
    logPass(`Found ${matchCount} occurrence(s) (expected >= ${expectedCount})`);
    return true;
  } else {
    logFail(`Found ${matchCount} occurrence(s), expected >= ${expectedCount}`);
    return false;
  }
}

function testEnhancedFieldCreation(filePath) {
  logTest('Enhanced field creation patterns');

  const content = fs.readFileSync(filePath, 'utf8');

  // Test patterns for the enhanced field structure
  const patterns = [
    {
      name: 'dataSource field assignment',
      pattern: /dataSource:\s*['"](?:requirement|assumption)['"]|dataSource:\s*\([^)]+\)\s*\?\s*['"]assumption['"][^:]*:\s*['"]requirement['"]/,
      expectedMin: 6
    },
    {
      name: 'priority field assignment',
      pattern: /priority:\s*.*\|\|\s*1|priority:\s*getPriority/,
      expectedMin: 6
    },
    {
      name: 'toggleHistory field initialization',
      pattern: /toggleHistory:\s*.*\|\|\s*\[\]|toggleHistory:\s*\[\]/,
      expectedMin: 6
    },
    {
      name: 'lastUpdated field assignment',
      pattern: /lastUpdated:\s*new\s+Date\(\)\.toISOString\(\)/,
      expectedMin: 6
    }
  ];

  let allPassed = true;
  patterns.forEach(pattern => {
    const matches = content.match(new RegExp(pattern.pattern, 'gm'));
    const count = matches ? matches.length : 0;

    if (count >= pattern.expectedMin) {
      logPass(`${pattern.name}: ${count} occurrences`);
    } else {
      logFail(`${pattern.name}: ${count} occurrences (expected >= ${pattern.expectedMin})`);
      allPassed = false;
    }
  });

  return allPassed;
}

function testToggleHistoryImplementation(filePath) {
  logTest('Toggle history implementation');

  const content = fs.readFileSync(filePath, 'utf8');

  // Check for complete toggle history implementation
  const historyPatterns = [
    {
      name: 'Toggle history array spread',
      pattern: /\.\.\.\(currentField\.toggleHistory\s*\|\|\s*\[\]\)/,
      expectedMin: 1
    },
    {
      name: 'History entry structure',
      pattern: /timestamp:\s*new\s+Date\(\)\.toISOString\(\),\s*from:\s*previousState,\s*to:\s*newState/,
      expectedMin: 1
    },
    {
      name: 'Triggered by system tracking',
      pattern: /triggeredBy:\s*['"]system['"],\s*reason/,
      expectedMin: 1
    }
  ];

  let allPassed = true;
  historyPatterns.forEach(pattern => {
    const matches = content.match(new RegExp(pattern.pattern, 'gm'));
    const count = matches ? matches.length : 0;

    if (count >= pattern.expectedMin) {
      logPass(`${pattern.name}: ${count} occurrences`);
    } else {
      logFail(`${pattern.name}: ${count} occurrences (expected >= ${pattern.expectedMin})`);
      allPassed = false;
    }
  });

  return allPassed;
}

function testDataSourceConsistency(filePath) {
  logTest('DataSource field consistency');

  const content = fs.readFileSync(filePath, 'utf8');

  // Check that dataSource is consistently set based on isAssumption
  const consistencyPatterns = [
    {
      name: 'Conditional dataSource assignment',
      pattern: /dataSource:\s*\([^)]*isAssumption[^)]*\)\s*\?\s*['"]assumption['"][^:]*:\s*['"]requirement['"]/,
      expectedMin: 1
    },
    {
      name: 'Direct assumption dataSource',
      pattern: /dataSource:\s*['"]assumption['"],\s*$/m,
      expectedMin: 2
    },
    {
      name: 'Direct requirement dataSource',
      pattern: /dataSource:\s*['"]requirement['"],\s*$/m,
      expectedMin: 2
    },
    {
      name: 'Toggle dataSource update',
      pattern: /dataSource:\s*newState/,
      expectedMin: 1
    }
  ];

  let allPassed = true;
  consistencyPatterns.forEach(pattern => {
    const matches = content.match(new RegExp(pattern.pattern, 'gm'));
    const count = matches ? matches.length : 0;

    if (count >= pattern.expectedMin) {
      logPass(`${pattern.name}: ${count} occurrences`);
    } else {
      logFail(`${pattern.name}: ${count} occurrences (expected >= ${pattern.expectedMin})`);
      allPassed = false;
    }
  });

  return allPassed;
}

// Main test execution
async function runFieldStructureTests() {
  console.clear();
  console.log(`${colors.bright}${colors.blue}Field Structure Enhancement Testing Script${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

  const appFile = path.join(__dirname, 'src', 'app.tsx');

  // Section 1: Enhanced Field Creation
  logSection('1. ENHANCED FIELD CREATION');
  testEnhancedFieldCreation(appFile);

  // Section 2: Field Structure Components
  logSection('2. FIELD STRUCTURE COMPONENTS');
  testFieldStructurePattern(appFile, 'dataSource:', 'DataSource field presence', 8);
  testFieldStructurePattern(appFile, 'priority:', 'Priority field presence', 8);
  testFieldStructurePattern(appFile, 'toggleHistory:', 'ToggleHistory field presence', 8);
  testFieldStructurePattern(appFile, 'lastUpdated:', 'LastUpdated field presence', 8);

  // Section 3: Toggle History Implementation
  logSection('3. TOGGLE HISTORY IMPLEMENTATION');
  testToggleHistoryImplementation(appFile);

  // Section 4: DataSource Consistency
  logSection('4. DATASOURCE CONSISTENCY');
  testDataSourceConsistency(appFile);

  // Section 5: Integration Verification
  logSection('5. INTEGRATION VERIFICATION');
  testFieldStructurePattern(appFile, 'getPriority\\([^)]+\\)', 'Priority calculation function usage', 1);
  testFieldStructurePattern(appFile, 'priority.*\\|\\|.*1', 'Priority preservation pattern', 5);
  testFieldStructurePattern(appFile, 'toggleHistory.*\\|\\|.*\\[\\]', 'ToggleHistory preservation pattern', 5);

  // Final Report
  logSection('FIELD STRUCTURE TEST RESULTS SUMMARY');
  console.log(`${colors.bright}Total Tests: ${totalTests}${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${warnings.length}${colors.reset}`);

  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (failedTests === 0) {
    console.log(`\n${colors.bright}${colors.green}✅ FIELD STRUCTURE ENHANCEMENT COMPLETE!${colors.reset}`);
    console.log('Enhanced field data structure with dataSource, priority, and toggleHistory successfully implemented.');
    process.exit(0);
  } else {
    console.log(`\n${colors.bright}${colors.red}❌ FIELD STRUCTURE IMPLEMENTATION ISSUES!${colors.reset}`);
    console.log('Please review the failures before proceeding.');
    process.exit(1);
  }
}

// Run the tests
runFieldStructureTests().catch(error => {
  console.error(`${colors.red}Test script error: ${error.message}${colors.reset}`);
  process.exit(1);
});