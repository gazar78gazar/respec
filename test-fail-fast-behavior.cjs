/**
 * Test 5: Error Handling (Fail-Fast)
 *
 * Purpose: Verify fail-fast error handling as per Sprint 2 requirements
 *
 * Tests:
 * 1. No fallback to pattern matching
 * 2. Errors throw (not caught and hidden)
 * 3. Pattern matching methods removed or disabled
 * 4. Error messages clear and helpful
 */

const fs = require('fs');
const path = require('path');

// ============= TEST FUNCTIONS =============

function testPatternMatchingRemoved() {
  console.log('📋 Test 5.1: Pattern Matching Fallback Removal');
  console.log('─────────────────────────────────────');

  const simplifiedPath = path.join(__dirname, 'src/services/respec/SimplifiedRespecService.ts');
  if (!fs.existsSync(simplifiedPath)) {
    console.log('❌ SimplifiedRespecService.ts not found');
    return false;
  }

  const content = fs.readFileSync(simplifiedPath, 'utf8');

  const checks = [
    {
      name: 'analyzeMessage method',
      pattern: /analyzeMessage.*\(/,
      shouldExist: false,
      description: 'analyzeMessage should not be called in processChatMessage'
    },
    {
      name: 'generateFormUpdates method',
      pattern: /generateFormUpdates.*\(/,
      shouldExist: false,
      description: 'generateFormUpdates should not be called as fallback'
    },
    {
      name: 'generateResponse method',
      pattern: /generateResponse.*\(/,
      shouldExist: false,
      description: 'generateResponse should not be called as fallback'
    },
    {
      name: 'Pattern matching fallback block',
      pattern: /catch.*analyzeMessage.*generateFormUpdates/s,
      shouldExist: false,
      description: 'Pattern matching fallback in catch block should be removed'
    }
  ];

  let allCorrect = true;
  checks.forEach(check => {
    const found = check.pattern.test(content);
    const isCorrect = check.shouldExist ? found : !found;

    if (isCorrect) {
      console.log(`  ✅ ${check.name} ${check.shouldExist ? 'present' : 'removed'}`);
    } else {
      console.log(`  ❌ ${check.name} ${check.shouldExist ? 'missing' : 'still present'}`);
      allCorrect = false;
    }
  });

  console.log('');
  return allCorrect;
}

function testFailFastErrorHandling() {
  console.log('📋 Test 5.2: Fail-Fast Error Handling');
  console.log('─────────────────────────────────────');

  const simplifiedPath = path.join(__dirname, 'src/services/respec/SimplifiedRespecService.ts');
  const content = fs.readFileSync(simplifiedPath, 'utf8');

  // Find the processChatMessage method
  const methodMatch = content.match(/async processChatMessage[\s\S]*?(?=\n  async |\n  private |\n  public |\n\}$)/);

  if (!methodMatch) {
    console.log('❌ processChatMessage method not found');
    return false;
  }

  const method = methodMatch[0];

  const checks = [
    {
      name: 'Try-catch block exists',
      pattern: /try\s*\{[\s\S]*?\}\s*catch/,
      shouldExist: true
    },
    {
      name: 'Throw error on failure',
      pattern: /throw error|throw new Error/i,
      shouldExist: true
    },
    {
      name: 'Fail fast comment',
      pattern: /[Ff]ail fast|MVP.*fail/i,
      shouldExist: true
    },
    {
      name: 'NO fallback pattern',
      pattern: /fallback.*pattern|pattern.*fallback/i,
      shouldExist: false
    },
    {
      name: 'Error logged before throw',
      pattern: /console\.error.*error/i,
      shouldExist: true
    }
  ];

  let allCorrect = true;
  checks.forEach(check => {
    const found = check.pattern.test(method);
    const isCorrect = check.shouldExist ? found : !found;

    if (isCorrect) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allCorrect = false;
    }
  });

  console.log('');
  return allCorrect;
}

function testErrorMessages() {
  console.log('📋 Test 5.3: Error Message Quality');
  console.log('─────────────────────────────────────');

  const files = [
    'src/services/respec/SimplifiedRespecService.ts',
    'src/services/respec/semantic/SemanticMatchingService.ts',
    'src/services/respec/semantic/SemanticIntegrationService_NEW.ts'
  ];

  let allGood = true;

  files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ⚠️  ${path.basename(file)} not found`);
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // Find all error messages
    const errorMessages = content.match(/console\.error\(['"`](.*?)['"`]/g) || [];
    const throwMessages = content.match(/throw new Error\(['"`](.*?)['"`]/g) || [];

    const hasDescriptiveErrors = errorMessages.length > 0 || throwMessages.length > 0;
    const hasContext = errorMessages.some(msg => msg.includes('[') && msg.includes(']'));

    console.log(`  ${hasDescriptiveErrors ? '✅' : '⚠️ '} ${path.basename(file)}: ${errorMessages.length + throwMessages.length} error messages`);

    if (hasContext) {
      console.log(`    ✅ Includes contextual prefixes [ServiceName]`);
    } else if (errorMessages.length > 0) {
      console.log(`    ⚠️  No contextual prefixes found`);
    }
  });

  console.log('');
  return allGood;
}

function testLLMErrorHandling() {
  console.log('📋 Test 5.4: LLM Error Propagation');
  console.log('─────────────────────────────────────');

  const checks = [
    {
      file: 'src/services/respec/semantic/SemanticMatchingService.ts',
      checks: [
        { name: 'Client not initialized check', pattern: /if \(!this\.client\).*throw/s },
        { name: 'LLM call wrapped in try-catch', pattern: /try\s*\{[\s\S]*?messages\.create[\s\S]*?\}\s*catch/s },
        { name: 'Error re-thrown or logged', pattern: /throw error|console\.error.*error/i }
      ]
    },
    {
      file: 'src/services/respec/semantic/SemanticIntegrationService_NEW.ts',
      checks: [
        { name: 'Error handling in processExtractedRequirements', pattern: /try\s*\{[\s\S]*?\}\s*catch/s },
        { name: 'Error logged', pattern: /console\.error.*error/i },
        { name: 'Error re-thrown', pattern: /throw error/i }
      ]
    }
  ];

  let allPass = true;

  checks.forEach(fileCheck => {
    const fullPath = path.join(__dirname, fileCheck.file);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ❌ ${path.basename(fileCheck.file)} not found`);
      allPass = false;
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    console.log(`  ${path.basename(fileCheck.file)}:`);

    fileCheck.checks.forEach(check => {
      const found = check.pattern.test(content);
      console.log(`    ${found ? '✅' : '❌'} ${check.name}`);
      if (!found) allPass = false;
    });
  });

  console.log('');
  return allPass;
}

function testNoSilentFailures() {
  console.log('📋 Test 5.5: No Silent Failures');
  console.log('─────────────────────────────────────');

  const files = [
    'src/services/respec/SimplifiedRespecService.ts',
    'src/services/respec/semantic/SemanticMatchingService.ts',
    'src/services/respec/semantic/SemanticIntegrationService_NEW.ts'
  ];

  let allPass = true;

  files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // Find catch blocks that might hide errors
    const catchBlocks = content.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/g) || [];
    const silentCatches = catchBlocks.filter(block => {
      // Silent if it doesn't log or throw
      return !block.includes('console.') && !block.includes('throw');
    });

    if (silentCatches.length > 0) {
      console.log(`  ❌ ${path.basename(file)}: ${silentCatches.length} silent catch blocks`);
      silentCatches.slice(0, 2).forEach(block => {
        console.log(`    ${block.substring(0, 80)}...`);
      });
      allPass = false;
    } else {
      console.log(`  ✅ ${path.basename(file)}: No silent failures`);
    }
  });

  console.log('');
  return allPass;
}

// ============= MAIN TEST EXECUTION =============

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Test 5: Error Handling (Fail-Fast) Validation');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('Testing Sprint 2 fail-fast error handling requirements...\n');

  // Run all tests
  const results = {
    patternMatchingRemoved: testPatternMatchingRemoved(),
    failFastHandling: testFailFastErrorHandling(),
    errorMessages: testErrorMessages(),
    llmErrorHandling: testLLMErrorHandling(),
    noSilentFailures: testNoSilentFailures()
  };

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');

  const testResults = [
    { name: 'Pattern Matching Fallback Removed', passed: results.patternMatchingRemoved, critical: true },
    { name: 'Fail-Fast Error Handling', passed: results.failFastHandling, critical: true },
    { name: 'Error Message Quality', passed: results.errorMessages, critical: false },
    { name: 'LLM Error Propagation', passed: results.llmErrorHandling, critical: true },
    { name: 'No Silent Failures', passed: results.noSilentFailures, critical: true }
  ];

  testResults.forEach(result => {
    const symbol = result.passed ? '✅' : (result.critical ? '❌' : '⚠️ ');
    console.log(`${symbol} ${result.name}`);
  });

  const criticalTests = testResults.filter(r => r.critical);
  const criticalPassed = criticalTests.filter(r => r.passed).length;

  console.log('');
  console.log(`Critical Tests: ${criticalPassed}/${criticalTests.length}`);
  console.log('');

  if (criticalPassed === criticalTests.length) {
    console.log('✅ ALL CRITICAL FAIL-FAST TESTS PASSED');
    console.log('');
    console.log('Sprint 2 implements proper fail-fast error handling:');
    console.log('  - No fallback to pattern matching');
    console.log('  - Errors propagate correctly');
    console.log('  - LLM failures surface immediately');
    console.log('  - No silent error hiding');
  } else {
    console.log('❌ SOME CRITICAL TESTS FAILED');
    console.log('');
    console.log('Fail-fast error handling not fully implemented.');
    console.log('Review failed tests and ensure errors propagate correctly.');
  }
  console.log('');

  return criticalPassed === criticalTests.length;
}

// ============= RUN =============

runTests().catch(error => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
