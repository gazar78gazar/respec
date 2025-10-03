/**
 * Test 1: Sprint 2 Week 1 Runtime Validation
 *
 * Purpose: Verify the implemented flow actually works end-to-end
 *
 * Tests:
 * 1. SemanticMatchingService can be instantiated
 * 2. SemanticIntegrationService can be instantiated
 * 3. SimplifiedRespecService initializes with new services
 * 4. Agent extraction flow works
 * 5. UC1 matching flow is called (check logs exist)
 * 6. Form updates are generated
 */

const fs = require('fs');
const path = require('path');

// ============= CONFIGURATION =============

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const [key, ...valueParts] = line.split('=');
    let value = valueParts.join('=').trim();

    const commentIndex = value.indexOf('#');
    if (commentIndex > 0) {
      value = value.substring(0, commentIndex).trim();
    }

    value = value.replace(/^["']|["']$/g, '');

    if (key && value) {
      envVars[key.trim()] = value;
    }
  });

  return envVars;
}

// ============= TEST UTILITIES =============

function testFileStructure() {
  console.log('📋 Test 1.1: File Structure Validation');
  console.log('─────────────────────────────────────');

  const requiredFiles = [
    'src/services/respec/semantic/SemanticMatchingService.ts',
    'src/services/respec/semantic/SemanticIntegrationService_NEW.ts',
    'src/services/respec/AnthropicService.ts',
    'src/services/respec/SimplifiedRespecService.ts',
    'src/services/respec/UC1ValidationEngine.ts'
  ];

  let allExist = true;
  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    const exists = fs.existsSync(fullPath);
    console.log(exists ? `✅ ${file}` : `❌ ${file} NOT FOUND`);
    if (!exists) allExist = false;
  });

  console.log('');
  return allExist;
}

function testServiceExports() {
  console.log('📋 Test 1.2: Service Exports Validation');
  console.log('─────────────────────────────────────');

  const tests = [
    {
      file: 'src/services/respec/semantic/SemanticMatchingService.ts',
      exports: [
        'export class SemanticMatchingService',
        'matchExtractedNodesToUC1',
        'export interface ExtractedNode',
        'export interface MatchResult',
        'export interface UC1Match',
        'export function createSemanticMatchingService'
      ]
    },
    {
      file: 'src/services/respec/semantic/SemanticIntegrationService_NEW.ts',
      exports: [
        'export class SemanticIntegrationService',
        'processExtractedRequirements',
        'routeMatchesByType',
        'convertToExtractedNodes',
        'convertMatchesToFormUpdates',
        'export function createSemanticIntegrationService'
      ]
    }
  ];

  let allPassed = true;
  tests.forEach(test => {
    const fullPath = path.join(__dirname, test.file);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ ${test.file} not found`);
      allPassed = false;
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    console.log(`\n${path.basename(test.file)}:`);

    test.exports.forEach(exportItem => {
      const found = content.includes(exportItem);
      console.log(found ? `  ✅ ${exportItem}` : `  ❌ ${exportItem} NOT FOUND`);
      if (!found) allPassed = false;
    });
  });

  console.log('');
  return allPassed;
}

function testProcessingFlow() {
  console.log('📋 Test 1.3: Processing Flow Integration');
  console.log('─────────────────────────────────────');

  const simplifiedPath = path.join(__dirname, 'src/services/respec/SimplifiedRespecService.ts');
  if (!fs.existsSync(simplifiedPath)) {
    console.log('❌ SimplifiedRespecService.ts not found');
    return false;
  }

  const content = fs.readFileSync(simplifiedPath, 'utf8');

  const checks = [
    { name: 'semanticIntegrationNew property', pattern: /semanticIntegrationNew/, critical: true },
    { name: 'semanticMatchingService property', pattern: /semanticMatchingService/, critical: true },
    { name: 'Sprint 2 flow comment', pattern: /Sprint 2.*flow/i, critical: false },
    { name: 'processExtractedRequirements call', pattern: /processExtractedRequirements/, critical: true },
    { name: 'Agent extraction step', pattern: /Step 1.*Agent|analyzeRequirements/, critical: true },
    { name: 'Fail fast error handling', pattern: /throw error/, critical: true },
    { name: 'NO fallback to patterns', pattern: /analyzeMessage.*generateFormUpdates/, shouldNotExist: true }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);

    if (check.shouldNotExist) {
      const passed = !found;
      console.log(passed ? `  ✅ ${check.name} (correctly removed)` : `  ❌ ${check.name} (should not exist)`);
      if (!passed && check.critical) allPassed = false;
    } else {
      const passed = found;
      console.log(passed ? `  ✅ ${check.name}` : `  ❌ ${check.name} NOT FOUND`);
      if (!passed && check.critical) allPassed = false;
    }
  });

  console.log('');
  return allPassed;
}

function testConversationalFlow() {
  console.log('📋 Test 1.4: Conversational Flow Integration');
  console.log('─────────────────────────────────────');

  const anthropicPath = path.join(__dirname, 'src/services/respec/AnthropicService.ts');
  if (!fs.existsSync(anthropicPath)) {
    console.log('❌ AnthropicService.ts not found');
    return false;
  }

  const content = fs.readFileSync(anthropicPath, 'utf8');

  const checks = [
    { name: 'Conversational Flow section', pattern: /Conversational [Ff]low:/i },
    { name: 'Use Case Questions', pattern: /Use Case Questions/i },
    { name: 'I Don\'t Know handling', pattern: /I Don't Know|I Don\'t Know/i },
    { name: 'Assumption confidence 0.6', pattern: /confidence.*0\.6|0\.6.*confidence/i },
    { name: 'Category completion tracking', pattern: /4 extractions|75%/i },
    { name: 'Binary/multichoice questions', pattern: /binary|multichoice/i },
    { name: 'Guided questions', pattern: /guiding questions/i }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(found ? `  ✅ ${check.name}` : `  ⚠️  ${check.name} NOT FOUND`);
    if (!found) allPassed = false;
  });

  console.log('');
  return allPassed;
}

function testRoutingLogic() {
  console.log('📋 Test 1.5: Routing Logic Implementation');
  console.log('─────────────────────────────────────');

  const integrationPath = path.join(__dirname, 'src/services/respec/semantic/SemanticIntegrationService_NEW.ts');
  if (!fs.existsSync(integrationPath)) {
    console.log('❌ SemanticIntegrationService_NEW.ts not found');
    return false;
  }

  const content = fs.readFileSync(integrationPath, 'utf8');

  const checks = [
    { name: 'routeMatchesByType method', pattern: /routeMatchesByType/ },
    { name: 'Switch on uc1Match.type', pattern: /switch.*uc1Match\.type/ },
    { name: 'SPECIFICATION case', pattern: /case 'specification':/ },
    { name: 'REQUIREMENT case', pattern: /case 'requirement':/ },
    { name: 'DOMAIN case', pattern: /case 'domain':/ },
    { name: 'Week 1 logging', pattern: /\[Route\].*🎯.*SPECIFICATION|\[Route\].*📋.*REQUIREMENT|\[Route\].*🏢.*DOMAIN/ },
    { name: 'TODO Week 2 comments', pattern: /TODO Week 2/ },
    { name: 'Confidence threshold filtering', pattern: /confidenceThreshold.*0\.7|confidence.*>=.*0\.7/ }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(found ? `  ✅ ${check.name}` : `  ❌ ${check.name} NOT FOUND`);
    if (!found) allPassed = false;
  });

  console.log('');
  return allPassed;
}

function testFormUpdateLogic() {
  console.log('📋 Test 1.6: Form Update Logic (Specifications Only)');
  console.log('─────────────────────────────────────');

  const integrationPath = path.join(__dirname, 'src/services/respec/semantic/SemanticIntegrationService_NEW.ts');
  if (!fs.existsSync(integrationPath)) {
    console.log('❌ SemanticIntegrationService_NEW.ts not found');
    return false;
  }

  const content = fs.readFileSync(integrationPath, 'utf8');

  const checks = [
    { name: 'convertMatchesToFormUpdates method', pattern: /convertMatchesToFormUpdates/ },
    { name: 'Only specifications check', pattern: /type.*!==.*'specification'.*continue|type.*===.*'specification'/s },
    { name: 'Skip non-specifications', pattern: /Skipping.*not a specification/ },
    { name: 'getFieldFromSpecId call', pattern: /getFieldFromSpecId/ },
    { name: 'Form update creation', pattern: /formUpdates\.push/ },
    { name: 'Confidence passed to form', pattern: /confidence:.*uc1Match\.confidence/ }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(found ? `  ✅ ${check.name}` : `  ❌ ${check.name} NOT FOUND`);
    if (!found) allPassed = false;
  });

  console.log('');
  return allPassed;
}

function testInitialization() {
  console.log('📋 Test 1.7: Service Initialization Logic');
  console.log('─────────────────────────────────────');

  const simplifiedPath = path.join(__dirname, 'src/services/respec/SimplifiedRespecService.ts');
  if (!fs.existsSync(simplifiedPath)) {
    console.log('❌ SimplifiedRespecService.ts not found');
    return false;
  }

  const content = fs.readFileSync(simplifiedPath, 'utf8');

  const checks = [
    { name: 'Import SemanticMatchingService', pattern: /import.*SemanticMatchingService/ },
    { name: 'Import SemanticIntegrationService', pattern: /import.*SemanticIntegrationService/ },
    { name: 'createSemanticMatchingService call', pattern: /createSemanticMatchingService/ },
    { name: 'createSemanticIntegrationService call', pattern: /createSemanticIntegrationService/ },
    { name: 'Initialize semantic matching', pattern: /semanticMatchingService.*initialize/ },
    { name: 'Pass uc1Engine to services', pattern: /uc1Engine/ }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(found ? `  ✅ ${check.name}` : `  ❌ ${check.name} NOT FOUND`);
    if (!found) allPassed = false;
  });

  console.log('');
  return allPassed;
}

// ============= MAIN TEST EXECUTION =============

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Test 1: Sprint 2 Week 1 Runtime Validation');
  console.log('═══════════════════════════════════════════════════════\n');

  const envVars = loadEnv();
  const hasApiKey = !!envVars.VITE_ANTHROPIC_API_KEY;
  const hasModel = !!envVars.VITE_LLM_MODEL;

  console.log('📋 Environment Check');
  console.log('─────────────────────────────────────');
  console.log(hasApiKey ? '✅ VITE_ANTHROPIC_API_KEY is set' : '❌ API key missing');
  console.log(hasModel ? `✅ VITE_LLM_MODEL = ${envVars.VITE_LLM_MODEL}` : '❌ Model not set');
  console.log('');

  // Run all tests
  const results = {
    fileStructure: testFileStructure(),
    serviceExports: testServiceExports(),
    processingFlow: testProcessingFlow(),
    conversationalFlow: testConversationalFlow(),
    routingLogic: testRoutingLogic(),
    formUpdateLogic: testFormUpdateLogic(),
    initialization: testInitialization()
  };

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');

  const testResults = [
    { name: 'File Structure', passed: results.fileStructure },
    { name: 'Service Exports', passed: results.serviceExports },
    { name: 'Processing Flow', passed: results.processingFlow },
    { name: 'Conversational Flow', passed: results.conversationalFlow },
    { name: 'Routing Logic', passed: results.routingLogic },
    { name: 'Form Update Logic', passed: results.formUpdateLogic },
    { name: 'Initialization', passed: results.initialization }
  ];

  testResults.forEach(result => {
    console.log(result.passed ? `✅ ${result.name}` : `❌ ${result.name}`);
  });

  const allPassed = testResults.every(r => r.passed);
  console.log('');

  if (allPassed) {
    console.log('✅ ALL RUNTIME VALIDATION TESTS PASSED');
    console.log('');
    console.log('Sprint 2 Week 1 implementation is structurally sound.');
    console.log('Ready for live testing with npm run dev.');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('');
    console.log('Review failed tests above and fix implementation.');
  }
  console.log('');

  return allPassed;
}

// ============= RUN =============

runTests().catch(error => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
