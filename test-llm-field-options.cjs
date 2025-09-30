/**
 * LLM-Aware Field Options Testing Script
 * Validates the implementation of LLM-aware field options enhancement
 *
 * Usage: node test-llm-field-options.cjs
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

function logFinding(message) {
  console.log(`${colors.yellow}  🔍${colors.reset} ${message}`);
  findings.push(message);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}${'='.repeat(60)}${colors.reset}`);
}

// Test functions for Phase 1: Data Structure Setup
function testPhase1DataStructures() {
  logTest('Phase 1: Data structures and interfaces');

  const simplifiedRespecFile = path.join(__dirname, 'src', 'services', 'respec', 'SimplifiedRespecService.ts');
  const content = fs.readFileSync(simplifiedRespecFile, 'utf8');

  // Check for EnhancedFormUpdate interface
  const enhancedFormUpdatePattern = /interface\s+EnhancedFormUpdate\s+extends\s+FormUpdate\s*{[^}]*originalRequest\?\s*:\s*string[^}]*substitutionNote\?\s*:\s*string[^}]*}/s;
  if (enhancedFormUpdatePattern.test(content)) {
    logPass('EnhancedFormUpdate interface with originalRequest and substitutionNote found');
  } else {
    logFail('EnhancedFormUpdate interface missing or incomplete');
  }

  // Check for FieldOptionsMap interface
  const fieldOptionsMapPattern = /interface\s+FieldOptionsMap\s*{[^}]*\[section:\s*string\][^}]*\[field:\s*string\][^}]*type:\s*'dropdown'[^}]*options\?\s*:\s*string\[\][^}]*}/s;
  if (fieldOptionsMapPattern.test(content)) {
    logPass('FieldOptionsMap interface with proper structure found');
  } else {
    logFail('FieldOptionsMap interface missing or incomplete');
  }

  // Check for fieldOptionsMap private field
  const fieldOptionsMapFieldPattern = /private\s+fieldOptionsMap:\s*FieldOptionsMap\s*=\s*{}/;
  if (fieldOptionsMapFieldPattern.test(content)) {
    logPass('fieldOptionsMap private field initialized');
  } else {
    logFail('fieldOptionsMap private field missing');
  }

  // Check for buildFieldOptionsMap method
  const buildMethodPattern = /private\s+buildFieldOptionsMap\s*\([^)]*fieldDefinitions[^)]*\):\s*void\s*{/;
  if (buildMethodPattern.test(content)) {
    logPass('buildFieldOptionsMap method found');
  } else {
    logFail('buildFieldOptionsMap method missing');
  }

  // Check for initialize method modification
  const initializePattern = /async\s+initialize\s*\([^)]*fieldDefinitions\?\s*:\s*any[^)]*\):\s*Promise<void>/;
  if (initializePattern.test(content)) {
    logPass('initialize method accepts fieldDefinitions parameter');
  } else {
    logFail('initialize method not updated to accept fieldDefinitions');
  }

  return true;
}

// Test functions for Phase 2: LLM Context Enhancement
function testPhase2ContextEnhancement() {
  logTest('Phase 2: LLM context enhancement methods');

  const simplifiedRespecFile = path.join(__dirname, 'src', 'services', 'respec', 'SimplifiedRespecService.ts');
  const content = fs.readFileSync(simplifiedRespecFile, 'utf8');

  // Check for identifyRelevantFields method
  const identifyFieldsPattern = /private\s+identifyRelevantFields\s*\([^)]*message:\s*string[^)]*\):\s*string\[\]\s*{/;
  if (identifyFieldsPattern.test(content)) {
    logPass('identifyRelevantFields method found');
  } else {
    logFail('identifyRelevantFields method missing');
  }

  // Check for buildContextPrompt method
  const buildContextPattern = /private\s+buildContextPrompt\s*\([^)]*message:\s*string[^)]*identifiedFields:\s*string\[\][^)]*\):\s*string\s*{/;
  if (buildContextPattern.test(content)) {
    logPass('buildContextPrompt method found');
  } else {
    logFail('buildContextPrompt method missing');
  }

  // Check for processChatMessage enhancement
  const processMessagePattern = /identifyRelevantFields\s*\(\s*message\s*\)/;
  if (processMessagePattern.test(content)) {
    logPass('processChatMessage calls identifyRelevantFields');
  } else {
    logFail('processChatMessage not enhanced with field identification');
  }

  const buildContextCallPattern = /buildContextPrompt\s*\(\s*message[^)]*identifiedFields\s*\)/;
  if (buildContextCallPattern.test(content)) {
    logPass('processChatMessage calls buildContextPrompt');
  } else {
    logFail('processChatMessage not enhanced with context building');
  }

  // Check for field pattern matching in identifyRelevantFields
  const commonFieldPatternsPattern = /commonFieldPatterns\s*=\s*{[^}]*storage[^}]*compute_performance\.storage_capacity[^}]*}/s;
  if (commonFieldPatternsPattern.test(content)) {
    logPass('identifyRelevantFields includes storage field pattern matching');
  } else {
    logFail('identifyRelevantFields missing storage pattern matching');
  }

  return true;
}

// Test functions for Phase 3: Response Handling
function testPhase3ResponseHandling() {
  logTest('Phase 3: Enhanced response handling');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Check for substitution note handling
  const substitutionNotePattern = /if\s*\(\s*update\.substitutionNote\s*\)\s*{[\s\S]*setChatMessages[\s\S]*role:\s*'system'[\s\S]*update\.substitutionNote[\s\S]*}/;
  if (substitutionNotePattern.test(content)) {
    logPass('Substitution note handling found in chat message processing');
  } else {
    logFail('Substitution note handling missing');
  }

  // Check for enhanced form updates type usage
  const enhancedFormUpdatesPattern = /forEach\s*\(\s*\(\s*update:\s*EnhancedFormUpdate\s*\)/;
  if (enhancedFormUpdatesPattern.test(content)) {
    logPass('EnhancedFormUpdate type used in chat result processing');
  } else {
    logFail('EnhancedFormUpdate type not used');
  }

  // Check for trace logging of substitution notes
  const traceLogPattern = /addTrace\s*\(\s*['"]substitution_note['"][^)]*originalRequest[^)]*substitutionNote[^)]*\)/s;
  if (traceLogPattern.test(content)) {
    logPass('Substitution note trace logging found');
  } else {
    logFail('Substitution note trace logging missing');
  }

  return true;
}

// Test functions for AnthropicService updates
function testAnthropicServiceUpdates() {
  logTest('AnthropicService LLM-aware enhancements');

  const anthropicFile = path.join(__dirname, 'src', 'services', 'respec', 'AnthropicService.ts');
  const content = fs.readFileSync(anthropicFile, 'utf8');

  // Check for enhanced requirements interface
  const enhancedRequirementsPattern = /requirements:\s*Array<\s*{[^}]*originalRequest\?\s*:\s*string[^}]*substitutionNote\?\s*:\s*string[^}]*}>/s;
  if (enhancedRequirementsPattern.test(content)) {
    logPass('AnthropicService requirements interface includes enhanced fields');
  } else {
    logFail('AnthropicService requirements interface not enhanced');
  }

  // Check for field-aware system prompt
  const fieldAwarePromptPattern = /CRITICAL:\s*Field-Aware\s*Value\s*Selection/;
  if (fieldAwarePromptPattern.test(content)) {
    logPass('System prompt includes field-aware selection instructions');
  } else {
    logFail('System prompt missing field-aware instructions');
  }

  // Check for dropdown constraint instruction
  const dropdownConstraintPattern = /NEVER\s*suggest\s*values\s*that\s*aren't\s*in\s*the\s*available\s*options/;
  if (dropdownConstraintPattern.test(content)) {
    logPass('System prompt includes dropdown value constraints');
  } else {
    logFail('System prompt missing dropdown constraints');
  }

  // Check for substitution explanation requirement
  const substitutionExplanationPattern = /substitutionNote\s*explaining\s*the\s*choice/;
  if (substitutionExplanationPattern.test(content)) {
    logPass('System prompt requires substitution explanations');
  } else {
    logFail('System prompt missing substitution explanation requirement');
  }

  return true;
}

// Test functions for app.tsx initialization
function testAppInitialization() {
  logTest('App.tsx field definitions initialization');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Check for field definitions passing to SimplifiedRespecService
  const initializationPattern = /simplifiedRespecService\.initialize\s*\(\s*formFieldsData\.field_definitions\s*\)/;
  if (initializationPattern.test(content)) {
    logPass('App.tsx passes formFieldsData.field_definitions to service initialization');
  } else {
    logFail('App.tsx missing field definitions initialization');
  }

  return true;
}

// Integration test scenarios
function testIntegrationScenarios() {
  logTest('Integration scenario validation');

  const appFile = path.join(__dirname, 'src', 'app.tsx');
  const content = fs.readFileSync(appFile, 'utf8');

  // Check for formFieldsData inline definition
  const formFieldsDataPattern = /const\s+formFieldsData\s*=\s*{[\s\S]*field_definitions[\s\S]*}/;
  if (formFieldsDataPattern.test(content)) {
    logPass('formFieldsData with field_definitions found in app.tsx');
  } else {
    logFail('formFieldsData definition missing in app.tsx');
    return false;
  }

  // Check for storage_capacity field structure
  const storageFieldPattern = /storage_capacity:\s*{[\s\S]*options:\s*\[[\s\S]*"512GB"[\s\S]*\]/;
  if (storageFieldPattern.test(content)) {
    logPass('storage_capacity field has options including 512GB');
  } else {
    logFail('storage_capacity field missing proper options');
  }

  // Check for processor_type field structure
  const processorFieldPattern = /processor_type:\s*{[\s\S]*options:\s*\[[\s\S]*"Intel[\s\S]*Core[\s\S]*i[0-9]"[\s\S]*\]/;
  if (processorFieldPattern.test(content)) {
    logPass('processor_type field has options including Intel processors');
  } else {
    logFail('processor_type field missing options');
  }

  // Check for compute_performance section
  const computePerformancePattern = /compute_performance:\s*{[\s\S]*storage_capacity[\s\S]*processor_type[\s\S]*}/;
  if (computePerformancePattern.test(content)) {
    logPass('compute_performance section contains expected fields');
    logFinding('Form field definitions properly structured for LLM context');
  } else {
    logFail('compute_performance section missing or incomplete');
  }

  return true;
}

// Test for expected scenarios from specification
function testSpecificationScenarios() {
  logTest('Specification test scenarios');

  const simplifiedRespecFile = path.join(__dirname, 'src', 'services', 'respec', 'SimplifiedRespecService.ts');
  const content = fs.readFileSync(simplifiedRespecFile, 'utf8');

  // Test Scenario 1: Storage field identification
  const storageIdentificationPattern = /'storage':\s*\['compute_performance\.storage_capacity'\]/;
  if (storageIdentificationPattern.test(content)) {
    logPass('Storage keyword correctly maps to compute_performance.storage_capacity');
  } else {
    logFail('Storage keyword mapping missing or incorrect');
  }

  // Test Scenario 2: Context prompt building for dropdown fields
  const dropdownPromptPattern = /Available\s*options:\s*\[\$\{fieldOptions\.options\.join\(/;
  if (dropdownPromptPattern.test(content)) {
    logPass('Context prompt includes available options for dropdown fields');
  } else {
    logFail('Context prompt missing dropdown options display');
  }

  // Test Scenario 3: Unit conversion instruction
  const unitConversionPattern = /"half\s*a\s*tera"\s*=\s*500GB\s*→\s*512GB/;
  if (unitConversionPattern.test(content)) {
    logPass('Context prompt includes unit conversion examples');
  } else {
    logFail('Context prompt missing unit conversion examples');
  }

  return true;
}

// Main diagnostic execution
async function runTests() {
  console.clear();
  console.log(`${colors.bright}${colors.blue}LLM-Aware Field Options Testing Script${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

  // Phase 1 Tests
  logSection('PHASE 1: DATA STRUCTURE SETUP');
  testPhase1DataStructures();

  // Phase 2 Tests
  logSection('PHASE 2: LLM CONTEXT ENHANCEMENT');
  testPhase2ContextEnhancement();

  // Phase 3 Tests
  logSection('PHASE 3: RESPONSE HANDLING');
  testPhase3ResponseHandling();

  // AnthropicService Tests
  logSection('ANTHROPIC SERVICE UPDATES');
  testAnthropicServiceUpdates();

  // App initialization Tests
  logSection('APP INITIALIZATION');
  testAppInitialization();

  // Integration Tests
  logSection('INTEGRATION SCENARIOS');
  testIntegrationScenarios();

  // Specification Tests
  logSection('SPECIFICATION COMPLIANCE');
  testSpecificationScenarios();

  // Summary
  logSection('TEST SUMMARY');
  console.log(`${colors.bright}Total Tests: ${totalTests}${colors.reset}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);

  const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
  console.log(`${colors.bright}Success Rate: ${successRate}%${colors.reset}`);

  if (findings.length > 0) {
    console.log(`\n${colors.bright}Key Findings:${colors.reset}`);
    findings.forEach(finding => {
      console.log(`${colors.yellow}  • ${finding}${colors.reset}`);
    });
  }

  // Implementation Status
  logSection('IMPLEMENTATION STATUS');

  if (failedTests === 0) {
    console.log(`${colors.bright}${colors.green}✓ ALL PHASES COMPLETE${colors.reset}`);
    console.log(`  LLM-aware field options enhancement fully implemented`);
    console.log(`  Ready for real-world testing with storage value scenarios`);
  } else {
    console.log(`${colors.bright}${colors.red}✗ IMPLEMENTATION INCOMPLETE${colors.reset}`);
    console.log(`  ${failedTests} test(s) failing - review and fix before proceeding`);
  }

  // Next Steps
  logSection('NEXT STEPS');
  console.log(`${colors.bright}Ready for Manual Testing:${colors.reset}`);
  console.log(`  1. Start dev server: npm run dev`);
  console.log(`  2. Test: "I need 500GB storage" (should select 512GB with note)`);
  console.log(`  3. Test: "I need half a tera" (should select 512GB with conversion note)`);
  console.log(`  4. Test: "I need 512GB" (should select 512GB with no note)`);
  console.log(`  5. Verify substitution notes appear in chat`);

  console.log(`\n${colors.bright}Status:${colors.reset} Testing complete - ${failedTests === 0 ? 'Ready for validation' : 'Fix issues before proceeding'}`);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Testing script error: ${error.message}${colors.reset}`);
  process.exit(1);
});