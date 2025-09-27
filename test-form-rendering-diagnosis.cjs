/**
 * Form Rendering Diagnosis Script
 * Validates the root causes of form fields not displaying
 *
 * Usage: node test-form-rendering-diagnosis.cjs
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
let findings = [];

// Helper functions
function logTest(name) {
  console.log(`\n${colors.blue}[DIAGNOSIS]${colors.reset} ${name}`);
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

function logFinding(message) {
  console.log(`${colors.yellow}  🔍${colors.reset} ${message}`);
  findings.push(message);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
}

// Diagnostic functions
function diagnoseActiveTabState() {
  logTest('ActiveTab initialization analysis');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Find activeTab initial state
  const activeTabPattern = /useState\(['"](.*?)['"][^)]*activeTab/;
  const activeTabMatch = content.match(activeTabPattern);

  if (activeTabMatch) {
    const initialTab = activeTabMatch[1];
    logFinding(`ActiveTab initialized to: "${initialTab}"`);

    // Check if this key exists in SECTION_MAPPING
    const sectionMappingPattern = /const\s+SECTION_MAPPING\s*=\s*{([^}]+)}/s;
    const mappingMatch = content.match(sectionMappingPattern);

    if (mappingMatch) {
      const mappingContent = mappingMatch[1];
      const keys = mappingContent.match(/['"]([^'"]+)['"]\s*:/g);
      const validKeys = keys ? keys.map(k => k.replace(/['"]|:/g, '').trim()) : [];

      logFinding(`Valid SECTION_MAPPING keys: [${validKeys.join(', ')}]`);

      if (validKeys.includes(initialTab)) {
        logPass(`ActiveTab "${initialTab}" is a valid key`);
        return true;
      } else {
        logFail(`ActiveTab "${initialTab}" is NOT a valid key`);
        logFinding(`This causes sections = SECTION_MAPPING["${initialTab}"] || [] to return []`);
        return false;
      }
    } else {
      logFail('Could not find SECTION_MAPPING definition');
      return false;
    }
  } else {
    logFail('Could not find activeTab initialization');
    return false;
  }
}

function diagnoseSectionMapping() {
  logTest('SECTION_MAPPING structure analysis');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Extract full SECTION_MAPPING
  const sectionMappingPattern = /const\s+SECTION_MAPPING\s*=\s*{([^}]+)}/s;
  const mappingMatch = content.match(sectionMappingPattern);

  if (mappingMatch) {
    const mappingContent = mappingMatch[1];

    // Count entries
    const entries = mappingContent.match(/['"][^'"]+['"]\s*:\s*\[[^\]]+\]/g);
    const entryCount = entries ? entries.length : 0;

    logFinding(`SECTION_MAPPING has ${entryCount} entries`);

    if (entries) {
      entries.forEach(entry => {
        const keyMatch = entry.match(/['"]([^'"]+)['"]/);
        const valueMatch = entry.match(/\[([^\]]+)\]/);
        if (keyMatch && valueMatch) {
          const key = keyMatch[1];
          const sections = valueMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
          logFinding(`"${key}" -> [${sections.join(', ')}]`);
        }
      });
    }

    if (entryCount > 0) {
      logPass(`SECTION_MAPPING structure is valid with ${entryCount} entries`);
      return true;
    } else {
      logFail('SECTION_MAPPING appears to be empty or malformed');
      return false;
    }
  } else {
    logFail('Could not find SECTION_MAPPING definition');
    return false;
  }
}

function diagnoseFormRenderingLogic() {
  logTest('Form rendering logic analysis');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Check RequirementsForm sections logic
  const sectionsLogicPattern = /const\s+sections\s*=\s*SECTION_MAPPING\[activeTab\]\s*\|\|\s*\[\]/;
  const hasSectionsLogic = sectionsLogicPattern.test(content);

  if (hasSectionsLogic) {
    logPass('Found sections logic: SECTION_MAPPING[activeTab] || []');
  } else {
    logFail('Could not find sections extraction logic');
    return false;
  }

  // Check if sections.map exists
  const sectionsMapPattern = /sections\.map\(/;
  const hasSectionsMap = sectionsMapPattern.test(content);

  if (hasSectionsMap) {
    logPass('Found sections.map() for form rendering');
  } else {
    logFail('Could not find sections.map() logic');
    return false;
  }

  // Check FormField rendering
  const formFieldPattern = /<FormField/;
  const hasFormField = formFieldPattern.test(content);

  if (hasFormField) {
    logPass('Found FormField component usage');
    return true;
  } else {
    logFail('Could not find FormField component rendering');
    return false;
  }
}

function diagnoseStateFlowIssue() {
  logTest('State-to-UI flow analysis');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Check if FormField uses data prop correctly
  const formFieldDataPattern = /data=\{data\}/;
  const hasDataProp = formFieldDataPattern.test(content);

  if (hasDataProp) {
    logPass('FormField receives data prop');
  } else {
    logFail('FormField missing data prop');
  }

  // Check useEffect in FormField for state updates
  const useEffectPattern = /useEffect\(\(\)\s*=>\s*{[^}]*setLocalValue\(data\?\.\value/s;
  const hasStateSync = useEffectPattern.test(content);

  if (hasStateSync) {
    logPass('FormField syncs with data changes via useEffect');
  } else {
    logFail('FormField missing state synchronization');
  }

  // Check if requirements state is passed to FormField
  const requirementsPassPattern = /requirements=\{requirements\}/;
  const hasRequirementsPass = requirementsPassPattern.test(content);

  if (hasRequirementsPass) {
    logPass('Requirements state passed to form component');
    return true;
  } else {
    logFail('Requirements state not properly passed');
    return false;
  }
}

function diagnoseFieldCountIssue() {
  logTest('Field count calculation analysis');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Find calculateAccuracy function
  const calculateAccuracyPattern = /calculateAccuracy\s*=\s*\(\)\s*=>\s*{([^}]+(?:{[^}]*}[^}]*)*)/s;
  const accuracyMatch = content.match(calculateAccuracyPattern);

  if (accuracyMatch) {
    logPass('Found calculateAccuracy function');

    // Check if it iterates over requirements
    const iterationPattern = /Object\.values\(requirements\)/;
    const hasIteration = iterationPattern.test(accuracyMatch[1]);

    if (hasIteration) {
      logPass('Function iterates over requirements state');
    } else {
      logFail('Function missing requirements iteration');
    }

    // Check for field count validation
    const validationPattern = /Field count mismatch/;
    const hasValidation = validationPattern.test(accuracyMatch[1]);

    if (hasValidation) {
      logPass('Function includes field count validation');
      logFinding('Field count mismatch indicates empty requirements state');
      return true;
    } else {
      logFail('Function missing field count validation');
    }
  } else {
    logFail('Could not find calculateAccuracy function');
  }

  return false;
}

function diagnoseRequirementsInitialization() {
  logTest('Requirements state initialization');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Check requirements initialization
  const requirementsInitPattern = /useState<Requirements>\(\{\}\)/;
  const hasEmptyInit = requirementsInitPattern.test(content);

  if (hasEmptyInit) {
    logFinding('Requirements initialized as empty object {}');
  }

  // Check for initialization logic
  const initLogicPattern = /initialRequirements\[section\]\[fieldKey\]\s*=/;
  const hasInitLogic = initLogicPattern.test(content);

  if (hasInitLogic) {
    logPass('Found requirements initialization logic');
  } else {
    logFail('Missing requirements initialization logic');
  }

  // Check useEffect for initialization
  const initEffectPattern = /useEffect\(.*formFieldsData.*\[\]/;
  const hasInitEffect = initEffectPattern.test(content);

  if (hasInitEffect) {
    logPass('Found useEffect for requirements initialization');
    return true;
  } else {
    logFail('Missing useEffect for requirements initialization');
    return false;
  }
}

// Main diagnostic execution
async function runDiagnostics() {
  console.clear();
  console.log(`${colors.bright}${colors.blue}Form Rendering Diagnosis Script${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

  // Section 1: Root Cause Analysis
  logSection('1. ROOT CAUSE ANALYSIS');
  const tabStateValid = diagnoseActiveTabState();
  const sectionMappingValid = diagnoseSectionMapping();
  const renderingLogicValid = diagnoseFormRenderingLogic();

  // Section 2: State Flow Analysis
  logSection('2. STATE FLOW ANALYSIS');
  const stateFlowValid = diagnoseStateFlowIssue();
  const fieldCountValid = diagnoseFieldCountIssue();
  const requirementsInitValid = diagnoseRequirementsInitialization();

  // Section 3: Findings Summary
  logSection('3. DIAGNOSIS SUMMARY');
  console.log(`${colors.bright}Total Checks: ${totalTests}${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);

  console.log(`\n${colors.bright}Key Findings:${colors.reset}`);
  findings.forEach(finding => {
    console.log(`${colors.yellow}  • ${finding}${colors.reset}`);
  });

  // Section 4: Root Cause Confirmation
  logSection('4. ROOT CAUSE CONFIRMATION');

  if (!tabStateValid) {
    console.log(`${colors.bright}${colors.red}✗ PRIMARY ROOT CAUSE CONFIRMED:${colors.reset}`);
    console.log(`  ActiveTab state is invalid, causing empty sections array`);
    console.log(`  This prevents any form fields from rendering`);
  }

  if (!sectionMappingValid || !renderingLogicValid) {
    console.log(`${colors.bright}${colors.red}✗ SECONDARY ROOT CAUSE:${colors.reset}`);
    console.log(`  Section mapping or rendering logic issues`);
  }

  if (tabStateValid && sectionMappingValid && renderingLogicValid) {
    console.log(`${colors.bright}${colors.green}✓ NO RENDERING ISSUES DETECTED${colors.reset}`);
    console.log(`  Form should be displaying correctly`);
  }

  // Section 5: Recommended Fixes
  logSection('5. RECOMMENDED RESOLUTION');

  if (!tabStateValid) {
    console.log(`${colors.bright}Fix #1: Update activeTab initialization${colors.reset}`);
    console.log(`  Change: useState('System') → useState('Compute Performance')`);
    console.log(`  Impact: Form fields will render immediately`);
  }

  console.log(`\n${colors.bright}Status:${colors.reset} Diagnosis complete - Ready for fix implementation`);
}

// Run the diagnostics
runDiagnostics().catch(error => {
  console.error(`${colors.red}Diagnosis script error: ${error.message}${colors.reset}`);
  process.exit(1);
});