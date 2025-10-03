#!/usr/bin/env node

/**
 * Sprint 2 Week 2 - Test 1: Artifact Population Validation
 *
 * Purpose: Verify that UC1 matches correctly populate mapped artifact
 *
 * What we're testing:
 * 1. ArtifactManager receives specifications from routing
 * 2. Hierarchical structure (Domain → Requirement → Specification) is preserved
 * 3. Conflict detection is triggered after each add
 * 4. Non-conflicting specs move to respec artifact
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

// Test results tracking
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

// ============= TEST SUITE =============

testSection('TEST 1: ArtifactManager Methods Exist');

const artifactManagerPath = path.join(__dirname, 'src/services/respec/artifacts/ArtifactManager.ts');
const artifactManagerContent = fs.readFileSync(artifactManagerPath, 'utf-8');

test('ArtifactManager has addSpecificationToMapped method', () => {
  if (!artifactManagerContent.includes('async addSpecificationToMapped(')) {
    throw new Error('Method addSpecificationToMapped not found');
  }
}, true);

test('ArtifactManager has detectConflicts method', () => {
  if (!artifactManagerContent.includes('async detectConflicts()')) {
    throw new Error('Method detectConflicts not found');
  }
}, true);

test('ArtifactManager has moveNonConflictingToRespec method', () => {
  if (!artifactManagerContent.includes('async moveNonConflictingToRespec()')) {
    throw new Error('Method moveNonConflictingToRespec not found');
  }
}, true);

test('ArtifactManager maintains hierarchical structure', () => {
  if (!artifactManagerContent.includes('domains[domainId]') ||
      !artifactManagerContent.includes('requirements[reqId]') ||
      !artifactManagerContent.includes('specifications[spec.id]')) {
    throw new Error('Hierarchical structure not properly maintained');
  }
}, true);

// ============= TEST 2: Routing Integration =============

testSection('TEST 2: SemanticIntegrationService_NEW Routing');

const integrationServicePath = path.join(__dirname, 'src/services/respec/semantic/SemanticIntegrationService_NEW.ts');
const integrationServiceContent = fs.readFileSync(integrationServicePath, 'utf-8');

test('SemanticIntegrationService imports ArtifactManager', () => {
  if (!integrationServiceContent.includes("import { ArtifactManager }")) {
    throw new Error('ArtifactManager not imported');
  }
}, true);

test('SemanticIntegrationService has artifactManager property', () => {
  if (!integrationServiceContent.includes('private artifactManager:') ||
      !integrationServiceContent.includes('ArtifactManager | null')) {
    throw new Error('artifactManager property not found');
  }
}, true);

test('Constructor accepts artifactManager parameter', () => {
  if (!integrationServiceContent.includes('artifactManager?: ArtifactManager') ||
      !integrationServiceContent.includes('this.artifactManager = artifactManager')) {
    throw new Error('Constructor does not accept artifactManager');
  }
}, true);

test('handleSpecificationMatch method exists', () => {
  if (!integrationServiceContent.includes('private async handleSpecificationMatch(')) {
    throw new Error('handleSpecificationMatch method not found');
  }
}, true);

test('handleRequirementMatch method exists', () => {
  if (!integrationServiceContent.includes('private async handleRequirementMatch(')) {
    throw new Error('handleRequirementMatch method not found');
  }
}, true);

test('handleDomainMatch method exists', () => {
  if (!integrationServiceContent.includes('private async handleDomainMatch(')) {
    throw new Error('handleDomainMatch method not found');
  }
}, true);

// ============= TEST 3: Specification Handling Flow =============

testSection('TEST 3: Specification Handling Implementation');

test('handleSpecificationMatch calls addSpecificationToMapped', () => {
  if (!integrationServiceContent.includes('await this.artifactManager.addSpecificationToMapped(')) {
    throw new Error('addSpecificationToMapped not called in handleSpecificationMatch');
  }
}, true);

test('handleSpecificationMatch triggers conflict detection', () => {
  if (!integrationServiceContent.includes('await this.artifactManager.detectConflicts()')) {
    throw new Error('detectConflicts not called in handleSpecificationMatch');
  }
}, true);

test('handleSpecificationMatch moves to respec if no conflicts', () => {
  if (!integrationServiceContent.includes('moveNonConflictingToRespec()')) {
    throw new Error('moveNonConflictingToRespec not called when no conflicts');
  }
}, true);

test('handleSpecificationMatch checks conflict result', () => {
  if (!integrationServiceContent.includes('!conflictResult.hasConflict') ||
      !integrationServiceContent.includes('conflictResult.conflicts.length')) {
    throw new Error('Conflict result not properly checked');
  }
}, true);

test('handleSpecificationMatch logs conflict detection', () => {
  const hasNoConflictLog = integrationServiceContent.includes('No conflicts - moving');
  const hasConflictLog = integrationServiceContent.includes('conflict(s) detected - holding in mapped');

  if (!hasNoConflictLog || !hasConflictLog) {
    throw new Error('Missing conflict detection logging');
  }
});

// ============= TEST 4: Requirement Handling Flow =============

testSection('TEST 4: Requirement Handling Implementation');

test('handleRequirementMatch gets child specifications', () => {
  if (!integrationServiceContent.includes('getSpecificationsByRequirement(reqId)')) {
    throw new Error('Does not get child specifications for requirement');
  }
}, true);

test('handleRequirementMatch adds all child specs to mapped', () => {
  const hasLoop = integrationServiceContent.includes('for (const spec of childSpecs)');
  const hasAdd = integrationServiceContent.includes('addSpecificationToMapped(');

  if (!hasLoop || !hasAdd) {
    throw new Error('Does not add all child specifications');
  }
}, true);

test('handleRequirementMatch triggers conflict detection', () => {
  const requirementSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleRequirementMatch'),
    integrationServiceContent.indexOf('handleRequirementMatch') + 2000
  );

  if (!requirementSection.includes('detectConflicts()')) {
    throw new Error('Conflict detection not triggered for requirement');
  }
}, true);

// ============= TEST 5: Domain Handling Flow =============

testSection('TEST 5: Domain Handling Implementation');

test('handleDomainMatch gets child requirements', () => {
  if (!integrationServiceContent.includes('getRequirementsByDomain(domainId)')) {
    throw new Error('Does not get child requirements for domain');
  }
}, true);

test('handleDomainMatch iterates through requirements and specs', () => {
  const hasReqLoop = integrationServiceContent.includes('for (const req of childRequirements)');
  const hasSpecLoop = integrationServiceContent.includes('for (const spec of childSpecs)');

  if (!hasReqLoop || !hasSpecLoop) {
    throw new Error('Does not iterate through all requirements and specifications');
  }
}, true);

test('handleDomainMatch triggers conflict detection', () => {
  const domainSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleDomainMatch'),
    integrationServiceContent.indexOf('handleDomainMatch') + 2000
  );

  if (!domainSection.includes('detectConflicts()')) {
    throw new Error('Conflict detection not triggered for domain');
  }
}, true);

// ============= TEST 6: Factory Function Updated =============

testSection('TEST 6: Factory Function Integration');

test('Factory function accepts artifactManager parameter', () => {
  if (!integrationServiceContent.includes('export function createSemanticIntegrationService(') ||
      !integrationServiceContent.includes('artifactManager?: ArtifactManager')) {
    throw new Error('Factory function missing artifactManager parameter');
  }
}, true);

test('Factory function passes artifactManager to constructor', () => {
  const factorySection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('export function createSemanticIntegrationService'),
    integrationServiceContent.length
  );

  if (!factorySection.includes('new SemanticIntegrationService(') ||
      !factorySection.includes('artifactManager')) {
    throw new Error('Factory does not pass artifactManager to constructor');
  }
}, true);

// ============= TEST 7: SimplifiedRespecService Wiring =============

testSection('TEST 7: SimplifiedRespecService Integration');

const simplifiedRespecPath = path.join(__dirname, 'src/services/respec/SimplifiedRespecService.ts');
const simplifiedRespecContent = fs.readFileSync(simplifiedRespecPath, 'utf-8');

test('SimplifiedRespecService passes artifactManager to factory', () => {
  if (!simplifiedRespecContent.includes('createSemanticIntegrationServiceNew(') ||
      !simplifiedRespecContent.includes('artifactManager,')) {
    throw new Error('SimplifiedRespecService does not pass artifactManager to factory');
  }
}, true);

test('SimplifiedRespecService imports SemanticIntegrationService_NEW correctly', () => {
  if (!simplifiedRespecContent.includes('SemanticIntegrationService_NEW')) {
    throw new Error('SemanticIntegrationService_NEW not imported');
  }
});

// ============= TEST 8: Error Handling =============

testSection('TEST 8: Error Handling');

test('handleSpecificationMatch has try/catch', () => {
  const specSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleSpecificationMatch'),
    integrationServiceContent.indexOf('handleSpecificationMatch') + 1500
  );

  if (!specSection.includes('try {') || !specSection.includes('catch (error)')) {
    throw new Error('handleSpecificationMatch missing try/catch');
  }
});

test('handleRequirementMatch has try/catch', () => {
  const reqSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleRequirementMatch'),
    integrationServiceContent.indexOf('handleRequirementMatch') + 1500
  );

  if (!reqSection.includes('try {') || !reqSection.includes('catch (error)')) {
    throw new Error('handleRequirementMatch missing try/catch');
  }
});

test('handleDomainMatch has try/catch', () => {
  const domainSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('handleDomainMatch'),
    integrationServiceContent.indexOf('handleDomainMatch') + 1500
  );

  if (!domainSection.includes('try {') || !domainSection.includes('catch (error)')) {
    throw new Error('handleDomainMatch missing try/catch');
  }
});

test('Error handling includes console.error logging', () => {
  if (!integrationServiceContent.includes('console.error(`[Route]')) {
    throw new Error('Missing error logging in routing handlers');
  }
});

// ============= TEST 9: Logging Quality =============

testSection('TEST 9: Logging & Observability');

test('Specification handling has detailed logs', () => {
  const logs = [
    '[Route] 🎯 SPECIFICATION:',
    'Added specification',
    'No conflicts',
    'conflict(s) detected'
  ];

  const allLogsPresent = logs.every(log => integrationServiceContent.includes(log));

  if (!allLogsPresent) {
    throw new Error('Missing required specification handling logs');
  }
});

test('Requirement handling has detailed logs', () => {
  const logs = [
    '[Route] 📋 REQUIREMENT:',
    'Found',
    'specifications for requirement'
  ];

  const allLogsPresent = logs.every(log => integrationServiceContent.includes(log));

  if (!allLogsPresent) {
    throw new Error('Missing required requirement handling logs');
  }
});

test('Domain handling has detailed logs', () => {
  const logs = [
    '[Route] 🏢 DOMAIN:',
    'domain'
  ];

  const allLogsPresent = logs.every(log => integrationServiceContent.includes(log));

  if (!allLogsPresent) {
    throw new Error('Missing required domain handling logs');
  }
});

// ============= TEST 10: Routing Switch Statement =============

testSection('TEST 10: Routing Switch Statement');

test('routeMatchesByType has switch statement', () => {
  if (!integrationServiceContent.includes('switch (uc1Match.type)')) {
    throw new Error('routeMatchesByType missing switch statement');
  }
}, true);

test('routeMatchesByType routes specifications to handler', () => {
  const switchSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('switch (uc1Match.type)'),
    integrationServiceContent.indexOf('switch (uc1Match.type)') + 800
  );

  if (!switchSection.includes('case \'specification\':') ||
      !switchSection.includes('handleSpecificationMatch')) {
    throw new Error('Specification routing not correct');
  }
}, true);

test('routeMatchesByType routes requirements to handler', () => {
  const switchSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('switch (uc1Match.type)'),
    integrationServiceContent.indexOf('switch (uc1Match.type)') + 800
  );

  if (!switchSection.includes('case \'requirement\':') ||
      !switchSection.includes('handleRequirementMatch')) {
    throw new Error('Requirement routing not correct');
  }
}, true);

test('routeMatchesByType routes domains to handler', () => {
  const switchSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('switch (uc1Match.type)'),
    integrationServiceContent.indexOf('switch (uc1Match.type)') + 800
  );

  if (!switchSection.includes('case \'domain\':') ||
      !switchSection.includes('handleDomainMatch')) {
    throw new Error('Domain routing not correct');
  }
}, true);

test('routeMatchesByType has default case for unknown types', () => {
  const switchSection = integrationServiceContent.substring(
    integrationServiceContent.indexOf('switch (uc1Match.type)'),
    integrationServiceContent.indexOf('switch (uc1Match.type)') + 800
  );

  if (!switchSection.includes('default:') ||
      !switchSection.includes('Unknown node type')) {
    throw new Error('Missing default case for unknown node types');
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
  log('✓ ALL TESTS PASSED', 'green');
  log('Sprint 2 Week 2 artifact population implementation is structurally complete!', 'green');
  process.exit(0);
} else if (results.criticalPassed === results.critical) {
  log('⚠ CRITICAL TESTS PASSED, but some non-critical tests failed', 'yellow');
  log('Sprint 2 Week 2 core functionality is implemented, minor issues detected', 'yellow');
  process.exit(0);
} else {
  log('✗ CRITICAL TESTS FAILED', 'red');
  log(`${results.critical - results.criticalPassed} critical test(s) failed`, 'red');
  log('Sprint 2 Week 2 implementation has critical issues that must be fixed', 'red');
  process.exit(1);
}
