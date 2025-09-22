// Simple test runner for browser console
// Copy-paste this into browser console to run tests

const runTests = () => {
  console.log('🧪 Running reqMAS Service Tests...\n');
  
  const tests = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  // Test 1: Basic flow
  try {
    const service = new ReqMASService();
    service.processMessage("I need a controller").then(r => {
      if (r.response && r.state) {
        tests.passed++;
        console.log('✅ Test 1: Basic message processing');
      } else {
        tests.failed++;
        tests.errors.push('Test 1: Response structure invalid');
      }
    });
  } catch (e) {
    tests.failed++;
    tests.errors.push(`Test 1: ${e.message}`);
  }
  
  // Test 2: State persistence
  try {
    const service = new ReqMASService();
    const id1 = service.getPublicState().sessionId;
    service.processMessage("test");
    const id2 = service.getPublicState().sessionId;
    
    if (id1 === id2) {
      tests.passed++;
      console.log('✅ Test 2: Session persistence');
    } else {
      tests.failed++;
      tests.errors.push('Test 2: Session ID changed');
    }
  } catch (e) {
    tests.failed++;
    tests.errors.push(`Test 2: ${e.message}`);
  }
  
  // Test 3: Extraction patterns
  try {
    const service = new ReqMASService();
    service.processMessage("I need 4 analog inputs and 2 ethernet ports").then(r => {
      const constraints = r.state.requirements.constraints;
      const hasAnalog = constraints.some(c => c.id === 'analog_inputs' && c.value === '4');
      const hasEthernet = constraints.some(c => c.id === 'ethernet_ports' && c.value === '2');
      
      if (hasAnalog && hasEthernet) {
        tests.passed++;
        console.log('✅ Test 3: Requirement extraction');
      } else {
        tests.failed++;
        tests.errors.push('Test 3: Failed to extract requirements');
      }
    });
  } catch (e) {
    tests.failed++;
    tests.errors.push(`Test 3: ${e.message}`);
  }
  
  // Test 4: Don't know handling
  try {
    const service = new ReqMASService();
    service.processMessage("System needed").then(() => {
      service.processMessage("I don't know").then(r => {
        if (r.response.includes("assume") && r.response.includes("change")) {
          tests.passed++;
          console.log('✅ Test 4: Assumption generation');
        } else {
          tests.failed++;
          tests.errors.push('Test 4: No assumption generated');
        }
      });
    });
  } catch (e) {
    tests.failed++;
    tests.errors.push(`Test 4: ${e.message}`);
  }
  
  // Test 5: Clarification handling
  try {
    const service = new ReqMASService();
    service.processMessage("Both 4-20mA and 0-10V signals").then(r => {
      if (r.state.pendingClarification) {
        tests.passed++;
        console.log('✅ Test 5: Conflict detection');
      } else {
        tests.failed++;
        tests.errors.push('Test 5: No clarification triggered');
      }
    });
  } catch (e) {
    tests.failed++;
    tests.errors.push(`Test 5: ${e.message}`);
  }
  
  // Results
  setTimeout(() => {
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${tests.passed}`);
    console.log(`❌ Failed: ${tests.failed}`);
    
    if (tests.errors.length > 0) {
      console.log('\n⚠️ Errors:');
      tests.errors.forEach(e => console.log(`  - ${e}`));
    }
    
    if (tests.failed === 0) {
      console.log('\n🎉 All tests passed!');
    }
  }, 2000);
};

// Run tests
runTests();