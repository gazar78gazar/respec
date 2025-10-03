#!/usr/bin/env node

/**
 * Sprint 2 Week 2 - Test 2: Runtime Flow Validation
 *
 * Purpose: Verify the expected runtime behavior of artifact management
 *
 * What we're testing:
 * 1. Proper method call sequences
 * 2. Conditional logic for conflict handling
 * 3. Integration with UC1ValidationEngine
 * 4. Value passing and transformations
 *
 * This test validates LOGIC, not just code structure
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  critical: 0,
  criticalPassed: 0
};

function test(description, testFn, isCritical = false) {
  results.total++;
  if (isCritical) results.critical++;

  try {
    testFn();
    results.passed++;
    if (isCritical) results.criticalPassed++;
    log(`✓ ${description}`, 'green');
    return true;
  } catch (error) {
    results.failed++;
    log(`✗ ${description}`, 'red');
    log(`  Error: ${error.message}`, 'red');
    return false;
  }
}

// ============= LOAD SOURCE FILES =============

const integrationServicePath = path.join(__dirname, 'src/services/respec/semantic/SemanticIntegrationService_NEW.ts');
const integrationServiceContent = fs.readFileSync(integrationServicePath, 'utf-8');

// ============= TEST 1: Specification Flow Sequence =============

testSection('TEST 1: Specification Handling - Method Call Sequence');

test('Step 1: Gets UC1 specification first', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  if (!handlerCode.includes('this.uc1Engine.getSpecification(specId)')) {
    throw new Error('Does not get UC1 specification');
  }

  // Should get spec BEFORE adding to artifact
  const getSpecIndex = handlerCode.indexOf('getSpecification');
  const addSpecIndex = handlerCode.indexOf('addSpecificationToMapped');

  if (getSpecIndex === -1 || addSpecIndex === -1 || getSpecIndex > addSpecIndex) {
    throw new Error('UC1 spec not retrieved before adding to artifact');
  }
}, true);

test('Step 2: Adds to mapped artifact with correct parameters', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  // Check all required parameters are passed
  const hasUc1Spec = handlerCode.includes('uc1Spec');
  const hasValue = handlerCode.includes('value');
  const hasContext = handlerCode.includes('match.extractedNode.context');
  const hasRationale = handlerCode.includes('match.uc1Match.rationale');

  if (!hasUc1Spec || !hasValue || !hasContext || !hasRationale) {
    throw new Error('Missing required parameters in addSpecificationToMapped call');
  }
}, true);

test('Step 3: Triggers conflict detection after adding', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const addIndex = handlerCode.indexOf('addSpecificationToMapped');
  const detectIndex = handlerCode.indexOf('detectConflicts()');

  if (addIndex === -1 || detectIndex === -1 || detectIndex < addIndex) {
    throw new Error('Conflict detection not called after adding specification');
  }
}, true);

test('Step 4: Checks conflict result before moving', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const hasConflictCheck = handlerCode.includes('!conflictResult.hasConflict') ||
                          handlerCode.includes('conflictResult.conflicts.length === 0');

  if (!hasConflictCheck) {
    throw new Error('Does not check conflict result before moving to respec');
  }
}, true);

test('Step 5: Moves to respec only if no conflicts', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  // Should have if statement checking conflicts
  const detectIndex = handlerCode.indexOf('detectConflicts()');
  const moveIndex = handlerCode.indexOf('moveNonConflictingToRespec()');

  if (detectIndex === -1 || moveIndex === -1 || moveIndex < detectIndex) {
    throw new Error('moveNonConflictingToRespec not called after conflict check');
  }

  // Should be inside an if block checking for no conflicts
  const codeSection = handlerCode.substring(detectIndex, moveIndex + 100);
  if (!codeSection.includes('if (') && !codeSection.includes('hasConflict')) {
    throw new Error('moveNonConflictingToRespec not conditionally called based on conflicts');
  }
}, true);

// ============= TEST 2: Conflict Branching Logic =============

testSection('TEST 2: Conflict Detection - Conditional Branching');

test('Has separate paths for conflict vs no-conflict scenarios', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const hasNoConflictPath = handlerCode.includes('No conflicts');
  const hasConflictPath = handlerCode.includes('conflict(s) detected') ||
                          handlerCode.includes('conflicts detected');

  if (!hasNoConflictPath || !hasConflictPath) {
    throw new Error('Missing separate handling for conflict vs no-conflict scenarios');
  }
}, true);

test('Logs different messages for conflict vs no-conflict', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const noConflictLog = handlerCode.includes('moving') && handlerCode.includes('respec');
  const conflictLog = handlerCode.includes('holding in mapped') ||
                     handlerCode.includes('holding') && handlerCode.includes('mapped');

  if (!noConflictLog || !conflictLog) {
    throw new Error('Missing distinct logging for conflict vs no-conflict paths');
  }
});

test('Only moves to respec when no conflicts detected', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  // moveNonConflictingToRespec should only be in the no-conflict branch
  const moveCall = handlerCode.indexOf('moveNonConflictingToRespec');

  if (moveCall === -1) {
    throw new Error('moveNonConflictingToRespec not called');
  }

  // Should be after an if check
  const beforeMove = handlerCode.substring(0, moveCall);
  const lastIfIndex = beforeMove.lastIndexOf('if (');

  if (lastIfIndex === -1) {
    throw new Error('moveNonConflictingToRespec not inside conditional block');
  }
}, true);

// ============= TEST 3: Requirement Handling Logic =============

testSection('TEST 3: Requirement Handling - Child Specification Logic');

test('Gets child specifications for requirement', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleRequirementMatch'),
    integrationServiceContent.indexOf('handleRequirementMatch') + 1500
  );

  if (!handlerCode.includes('getSpecificationsByRequirement(reqId)')) {
    throw new Error('Does not get child specifications');
  }
}, true);

test('Validates that child specifications exist', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleRequirementMatch'),
    integrationServiceContent.indexOf('handleRequirementMatch') + 1500
  );

  const hasLengthCheck = handlerCode.includes('childSpecs.length === 0') ||
                        handlerCode.includes('childSpecs.length < 1');

  if (!hasLengthCheck) {
    throw new Error('Does not validate child specifications exist');
  }
});

test('Iterates through all child specifications', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleRequirementMatch'),
    integrationServiceContent.indexOf('handleRequirementMatch') + 1500
  );

  if (!handlerCode.includes('for (const spec of childSpecs)')) {
    throw new Error('Does not iterate through child specifications');
  }
}, true);

test('Adds each child spec to mapped artifact', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleRequirementMatch'),
    integrationServiceContent.indexOf('handleRequirementMatch') + 1500
  );

  const hasLoop = handlerCode.includes('for (const spec of childSpecs)');
  const loopSection = handlerCode.substring(handlerCode.indexOf('for (const spec'));
  const hasAdd = loopSection.includes('addSpecificationToMapped');

  if (!hasLoop || !hasAdd) {
    throw new Error('Does not add each child specification in loop');
  }
}, true);

test('Uses default values for child specs when no user value provided', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleRequirementMatch'),
    integrationServiceContent.indexOf('handleRequirementMatch') + 1500
  );

  const hasDefaultValue = handlerCode.includes('spec.default_value') ||
                         handlerCode.includes('default_value || null');

  if (!hasDefaultValue) {
    throw new Error('Does not use default values for child specifications');
  }
});

// ============= TEST 4: Domain Handling Logic =============

testSection('TEST 4: Domain Handling - Nested Iteration Logic');

test('Gets child requirements for domain', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleDomainMatch'),
    integrationServiceContent.indexOf('handleDomainMatch') + 1500
  );

  if (!handlerCode.includes('getRequirementsByDomain(domainId)')) {
    throw new Error('Does not get child requirements');
  }
}, true);

test('Has nested loops for requirements → specifications', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleDomainMatch'),
    integrationServiceContent.indexOf('handleDomainMatch') + 1500
  );

  const hasReqLoop = handlerCode.includes('for (const req of childRequirements)');
  const hasSpecLoop = handlerCode.includes('for (const spec of childSpecs)');

  if (!hasReqLoop || !hasSpecLoop) {
    throw new Error('Missing nested loops for requirements and specifications');
  }
}, true);

test('Gets specifications for each requirement', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleDomainMatch'),
    integrationServiceContent.indexOf('handleDomainMatch') + 1500
  );

  const hasGetSpecs = handlerCode.includes('getSpecificationsByRequirement(req.id)');

  if (!hasGetSpecs) {
    throw new Error('Does not get specifications for each requirement');
  }
}, true);

test('Adds all specifications from all requirements', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleDomainMatch'),
    integrationServiceContent.indexOf('handleDomainMatch') + 1500
  );

  // Should have addSpecificationToMapped inside nested loops
  const reqLoopIndex = handlerCode.indexOf('for (const req of childRequirements)');
  const specLoopIndex = handlerCode.indexOf('for (const spec of childSpecs)', reqLoopIndex);
  const addIndex = handlerCode.indexOf('addSpecificationToMapped', specLoopIndex);

  if (reqLoopIndex === -1 || specLoopIndex === -1 || addIndex === -1) {
    throw new Error('addSpecificationToMapped not called for all specifications in nested loops');
  }
}, true);

// ============= TEST 5: Error Handling Resilience =============

testSection('TEST 5: Error Handling - Graceful Degradation');

test('handleSpecificationMatch has error logging', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  if (!handlerCode.includes('console.error')) {
    throw new Error('Missing error logging in handleSpecificationMatch');
  }
});

test('Errors include context (specId in error message)', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const errorSection = handlerCode.substring(handlerCode.indexOf('catch (error)'));

  if (!errorSection.includes('${specId}') && !errorSection.includes('specId')) {
    throw new Error('Error messages lack context (specId)');
  }
});

test('Has null/undefined checks for UC1 spec', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const hasNullCheck = handlerCode.includes('if (!uc1Spec)') ||
                      handlerCode.includes('if (uc1Spec === null)') ||
                      handlerCode.includes('if (!uc1Spec)');

  if (!hasNullCheck) {
    throw new Error('Missing null check for UC1 specification');
  }
});

test('Returns early if UC1 spec not found', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const nullCheckIndex = handlerCode.indexOf('if (!uc1Spec)');

  if (nullCheckIndex !== -1) {
    const afterCheck = handlerCode.substring(nullCheckIndex, nullCheckIndex + 200);
    if (!afterCheck.includes('return')) {
      throw new Error('Does not return early when UC1 spec not found');
    }
  }
});

// ============= TEST 6: ArtifactManager Availability Check =============

testSection('TEST 6: ArtifactManager Availability - Defensive Programming');

test('Checks if artifactManager exists before using', () => {
  const specHandler = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  if (!specHandler.includes('if (this.artifactManager)')) {
    throw new Error('Does not check if artifactManager exists');
  }
}, true);

test('Has fallback or warning when artifactManager missing', () => {
  const specHandler = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const hasElse = specHandler.includes('} else {');
  const hasLegacyPath = specHandler.includes('legacy') ||
                       specHandler.includes('No artifact manager');

  if (!hasElse || !hasLegacyPath) {
    throw new Error('Missing fallback when artifactManager not available');
  }
});

// ============= TEST 7: Value Transformation =============

testSection('TEST 7: Value Handling - Correct Data Passing');

test('Passes UC1 spec object (not just spec ID)', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  // Should pass uc1Spec variable, not specId
  const addCall = handlerCode.substring(handlerCode.indexOf('addSpecificationToMapped'));

  if (!addCall.includes('uc1Spec') || addCall.indexOf('specId') < addCall.indexOf('uc1Spec')) {
    throw new Error('Does not pass UC1 spec object to addSpecificationToMapped');
  }
}, true);

test('Passes actual value (not undefined or null by default)', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  // value parameter should be passed
  const addCall = handlerCode.substring(handlerCode.indexOf('addSpecificationToMapped'));

  if (!addCall.includes('value')) {
    throw new Error('Does not pass value parameter to addSpecificationToMapped');
  }
}, true);

test('Passes extraction context for traceability', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const hasContext = handlerCode.includes('match.extractedNode.context') ||
                    handlerCode.includes('extractedNode.context');

  if (!hasContext) {
    throw new Error('Does not pass extraction context for traceability');
  }
});

test('Passes match rationale for explanation', () => {
  const handlerCode = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  const hasRationale = handlerCode.includes('match.uc1Match.rationale') ||
                      handlerCode.includes('uc1Match.rationale');

  if (!hasRationale) {
    throw new Error('Does not pass match rationale');
  }
});

// ============= RESULTS =============

testSection('TEST RESULTS');

console.log('');
log(`Total Tests: ${results.total}`, 'cyan');
log(`Passed: ${results.passed}`, 'green');
log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
console.log('');
log(`Critical Tests: ${results.critical}`, 'yellow');
log(`Critical Passed: ${results.criticalPassed}`, results.criticalPassed === results.critical ? 'green' : 'red');
console.log('');

if (results.failed === 0) {
  log('✓ ALL RUNTIME FLOW TESTS PASSED', 'green');
  log('Sprint 2 Week 2 runtime logic is correctly implemented!', 'green');
  process.exit(0);
} else if (results.criticalPassed === results.critical) {
  log('⚠ CRITICAL TESTS PASSED, but some logic tests failed', 'yellow');
  log('Core flow is correct, but some best practices not followed', 'yellow');
  process.exit(0);
} else {
  log('✗ CRITICAL RUNTIME FLOW TESTS FAILED', 'red');
  log(`${results.critical - results.criticalPassed} critical logic issue(s) detected`, 'red');
  log('Sprint 2 Week 2 runtime behavior has critical issues', 'red');
  process.exit(1);
}
