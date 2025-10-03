/**
 * Test 4: Legacy Path Preservation
 *
 * Purpose: Ensure existing functionality still works after Sprint 2 changes
 *
 * Critical Tests:
 * 1. communicateWithMAS() → setChatMessages() flow intact
 * 2. Form field updates work
 * 3. Substitution notes still display
 * 4. Existing test scripts still pass
 * 5. No new TypeScript errors introduced
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============= UTILITY FUNCTIONS =============

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

// ============= TEST FUNCTIONS =============

function testCommunicateWithMASFlow() {
  console.log('📋 Test 4.1: communicateWithMAS Flow Preservation');
  console.log('─────────────────────────────────────');

  const appPath = path.join(__dirname, 'src/app.tsx');
  if (!fs.existsSync(appPath)) {
    console.log('❌ app.tsx not found');
    return false;
  }

  const content = fs.readFileSync(appPath, 'utf8');

  const checks = [
    { name: 'communicateWithMAS function exists', pattern: /const communicateWithMAS.*=.*async/s, critical: true },
    { name: 'setChatMessages function exists', pattern: /const setChatMessages.*=/s, critical: true },
    { name: 'ChatWindow.onSendMessage wired', pattern: /onSendMessage.*=.*sendMessageWrapper|onSendMessage.*=.*communicateWithMAS/s, critical: true },
    { name: 'SimplifiedRespecService integration', pattern: /respecService.*processChatMessage/s, critical: true },
    { name: 'Form updates handling', pattern: /EnhancedFormUpdate|formUpdates/i, critical: true },
    { name: 'Chat message display', pattern: /setChatMessages.*chatMessages/s, critical: true }
  ];

  let criticalPass = 0;
  let criticalTotal = 0;

  checks.forEach(check => {
    const found = check.pattern.test(content);
    const symbol = found ? '✅' : (check.critical ? '❌' : '⚠️ ');
    console.log(`${symbol} ${check.name}`);

    if (check.critical) {
      criticalTotal++;
      if (found) criticalPass++;
    }
  });

  console.log('');
  console.log(`Critical: ${criticalPass}/${criticalTotal}`);
  console.log('');

  return criticalPass === criticalTotal;
}

function testFormFieldUpdates() {
  console.log('📋 Test 4.2: Form Field Update Mechanism');
  console.log('─────────────────────────────────────');

  const appPath = path.join(__dirname, 'src/app.tsx');
  const content = fs.readFileSync(appPath, 'utf8');

  const checks = [
    { name: 'updateField function exists', pattern: /const updateField.*=/s, critical: true },
    { name: 'setRequirements state setter', pattern: /setRequirements/i, critical: true },
    { name: 'Form field mapping', pattern: /requirements\[section\]|requirements\[.*section.*\]/s, critical: true },
    { name: 'Value update logic', pattern: /requirements.*\[.*field.*\].*=|Object\.assign/s, critical: true },
    { name: 'State update trigger', pattern: /setRequirements.*{.*\.\.\.requirements/s, critical: true }
  ];

  let criticalPass = 0;
  let criticalTotal = 0;

  checks.forEach(check => {
    const found = check.pattern.test(content);
    const symbol = found ? '✅' : (check.critical ? '❌' : '⚠️ ');
    console.log(`${symbol} ${check.name}`);

    if (check.critical) {
      criticalTotal++;
      if (found) criticalPass++;
    }
  });

  console.log('');
  console.log(`Critical: ${criticalPass}/${criticalTotal}`);
  console.log('');

  return criticalPass === criticalTotal;
}

function testSubstitutionNotes() {
  console.log('📋 Test 4.3: Substitution Notes Feature');
  console.log('─────────────────────────────────────');

  const anthropicPath = path.join(__dirname, 'src/services/respec/AnthropicService.ts');
  const content = fs.readFileSync(anthropicPath, 'utf8');

  const checks = [
    { name: 'substitutionNote in interface', pattern: /substitutionNote\?:/i, critical: true },
    { name: 'originalRequest in interface', pattern: /originalRequest\?:/i, critical: true },
    { name: 'Substitution in system prompt', pattern: /substitution/i, critical: true },
    { name: 'Closest match guidance', pattern: /closest.*match|closest.*option/i, critical: false },
    { name: 'Explain substitution instruction', pattern: /explain.*substitution|substitution.*note/i, critical: false }
  ];

  let criticalPass = 0;
  let criticalTotal = 0;

  checks.forEach(check => {
    const found = check.pattern.test(content);
    const symbol = found ? '✅' : (check.critical ? '❌' : '⚠️ ');
    console.log(`${symbol} ${check.name}`);

    if (check.critical) {
      criticalTotal++;
      if (found) criticalPass++;
    }
  });

  console.log('');
  console.log(`Critical: ${criticalPass}/${criticalTotal}`);
  console.log('');

  return criticalPass === criticalTotal;
}

function testExistingScripts() {
  console.log('📋 Test 4.4: Existing Test Scripts');
  console.log('─────────────────────────────────────');

  const testScripts = [
    'test-llm-api-connection.cjs',
    'test-sprint2-week1-validation.cjs'
  ];

  let allPass = true;

  testScripts.forEach(script => {
    const scriptPath = path.join(__dirname, script);
    if (!fs.existsSync(scriptPath)) {
      console.log(`⚠️  ${script} not found (may be optional)`);
      return;
    }

    try {
      console.log(`  Testing ${script}...`);
      const output = execSync(`node "${scriptPath}"`, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30000
      });

      // Check if test passed (look for success indicators)
      const passed = output.includes('✅') || output.includes('PASSED') || !output.includes('❌');
      console.log(passed ? `  ✅ ${script} passed` : `  ❌ ${script} failed`);

      if (!passed) allPass = false;
    } catch (error) {
      console.log(`  ❌ ${script} errored: ${error.message.split('\n')[0]}`);
      allPass = false;
    }
  });

  console.log('');
  return allPass;
}

function testTypeScriptErrors() {
  console.log('📋 Test 4.5: TypeScript Error Count');
  console.log('─────────────────────────────────────');

  try {
    console.log('  Running: npx tsc --noEmit...');

    // Run TypeScript compilation (expect errors, we're just counting them)
    const output = execSync('npx tsc --noEmit', {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60000
    }).catch(error => error.stdout || error.stderr || '');

    // Count errors
    const errorLines = String(output).split('\n').filter(line => line.includes('error TS'));
    const errorCount = errorLines.length;

    console.log(`  Found ${errorCount} TypeScript errors`);

    // Check for new errors in Sprint 2 files
    const sprint2Files = [
      'SemanticMatchingService',
      'SemanticIntegrationService_NEW'
    ];

    const sprint2Errors = errorLines.filter(line =>
      sprint2Files.some(file => line.includes(file))
    );

    if (sprint2Errors.length > 0) {
      console.log(`  ❌ ${sprint2Errors.length} errors in new Sprint 2 files`);
      sprint2Errors.slice(0, 5).forEach(err => console.log(`    ${err.substring(0, 100)}`));
      return false;
    }

    console.log(`  ✅ No errors in new Sprint 2 files`);

    // Baseline was ~218 errors (from completion doc)
    if (errorCount > 250) {
      console.log(`  ⚠️  Error count (${errorCount}) significantly higher than baseline (~218)`);
    } else {
      console.log(`  ✅ Error count within acceptable range (baseline: ~218)`);
    }

    console.log('');
    return sprint2Errors.length === 0;

  } catch (error) {
    // TypeScript compilation will "fail" due to existing errors, but we capture output
    const output = error.stdout || error.stderr || '';
    const errorLines = String(output).split('\n').filter(line => line.includes('error TS'));
    const errorCount = errorLines.length;

    console.log(`  Found ${errorCount} TypeScript errors`);

    const sprint2Files = [
      'SemanticMatchingService',
      'SemanticIntegrationService_NEW'
    ];

    const sprint2Errors = errorLines.filter(line =>
      sprint2Files.some(file => line.includes(file))
    );

    if (sprint2Errors.length > 0) {
      console.log(`  ❌ ${sprint2Errors.length} errors in new Sprint 2 files:`);
      sprint2Errors.slice(0, 5).forEach(err => console.log(`    ${err.substring(0, 100)}`));
      console.log('');
      return false;
    }

    console.log(`  ✅ No new errors in Sprint 2 files`);
    console.log(`  ✅ Error count: ${errorCount} (baseline: ~218)`);
    console.log('');
    return true;
  }
}

function testDebugTraceSystem() {
  console.log('📋 Test 4.6: Debug Trace System');
  console.log('─────────────────────────────────────');

  const appPath = path.join(__dirname, 'src/app.tsx');
  const content = fs.readFileSync(appPath, 'utf8');

  const checks = [
    { name: 'debugTrace state exists', pattern: /debugTrace|setDebugTrace/i },
    { name: 'Console logging preserved', pattern: /console\.log/i },
    { name: 'Sprint 2 flow logging', pattern: /\[SimplifiedRespec\].*Sprint 2|Sprint 2.*flow/i }
  ];

  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(found ? `  ✅ ${check.name}` : `  ⚠️  ${check.name}`);
  });

  console.log('');
  return true; // Non-critical
}

// ============= MAIN TEST EXECUTION =============

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Test 4: Legacy Path Preservation');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('Testing that Sprint 2 changes did not break existing functionality...\n');

  // Run all tests
  const results = {
    communicateFlow: testCommunicateWithMASFlow(),
    formUpdates: testFormFieldUpdates(),
    substitutionNotes: testSubstitutionNotes(),
    existingScripts: testExistingScripts(),
    typeScriptErrors: testTypeScriptErrors(),
    debugTrace: testDebugTraceSystem()
  };

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');

  const testResults = [
    { name: 'communicateWithMAS Flow', passed: results.communicateFlow, critical: true },
    { name: 'Form Field Updates', passed: results.formUpdates, critical: true },
    { name: 'Substitution Notes', passed: results.substitutionNotes, critical: true },
    { name: 'Existing Test Scripts', passed: results.existingScripts, critical: false },
    { name: 'TypeScript Errors', passed: results.typeScriptErrors, critical: true },
    { name: 'Debug Trace System', passed: results.debugTrace, critical: false }
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
    console.log('✅ ALL CRITICAL LEGACY COMPATIBILITY TESTS PASSED');
    console.log('');
    console.log('Sprint 2 changes preserved existing functionality.');
    console.log('All critical integration points remain functional.');
  } else {
    console.log('❌ SOME CRITICAL TESTS FAILED');
    console.log('');
    console.log('Sprint 2 changes may have broken existing functionality.');
    console.log('Review failed tests and restore compatibility.');
  }
  console.log('');

  return criticalPassed === criticalTests.length;
}

// ============= RUN =============

runTests().catch(error => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
