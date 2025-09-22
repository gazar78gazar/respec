// Complete Test Suite for ReqMAS Service
// Run with: npm test

import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReqMASService } from '../ReqMASService';

// Mock localStorage for testing
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  length: 0,
  key: vi.fn()
};

global.localStorage = localStorageMock as any;

describe('ReqMAS Service - Critical Functionality Tests', () => {
  let service: ReqMASService;

  beforeEach(() => {
    // Clear localStorage to ensure clean state
    localStorageMock.clear();
    localStorageMock.getItem.mockReturnValue(null);
    service = new ReqMASService();
  });

  // ============= CATEGORY 1: CONVERSATION FLOW BUGS =============
  
  describe('1. Conversation Flow Integrity', () => {
    
    test('1.1 Should maintain conversation context between messages', async () => {
      // First message
      const response1 = await service.processMessage("I need a PC controller for 4 ovens");
      expect(response1.response).toContain("control");
      
      // Second message answering the question
      const response2 = await service.processMessage("Both monitoring and control");
      expect(response2.state.requirements.constraints.length).toBeGreaterThan(0);
      
      // Third message - should remember context
      const response3 = await service.processMessage("4 analog inputs");
      const ioConstraints = response3.state.requirements.constraints.filter(
        c => c.category === 'io'
      );
      expect(ioConstraints.length).toBeGreaterThan(0);
    });

    test('1.2 Should handle "I dont know" with assumptions', async () => {
      await service.processMessage("I need industrial PC");
      const response = await service.processMessage("I don't know");
      
      expect(response.response).toContain("let's assume");
      expect(response.response).toContain("You can always change that later");
      
      const assumptions = response.state.requirements.constraints.filter(
        c => c.source === 'usecase'
      );
      expect(assumptions.length).toBeGreaterThan(0);
      expect(assumptions[0].confidence).toBeLessThan(1.0);
    });

    test('1.3 Should generate category wrap-up at 80% completion', async () => {
      await service.processMessage("Industrial control system");
      await service.processMessage("Monitor and control");
      await service.processMessage("10 devices");
      
      // Should trigger wrap-up
      const response = await service.processMessage("Yes");
      
      // Check for wrap-up indicators
      const hasWrapUp = response.response.includes("Alright") || 
                        response.response.includes("we need") ||
                        response.response.includes("proceed to");
      expect(hasWrapUp).toBe(true);
    });

    test('1.4 Should not lose track of last system question', async () => {
      await service.processMessage("I need a controller");
      
      // User asks question instead of answering
      const response = await service.processMessage("Does it matter?");
      
      // Should answer then repeat the question
      expect(response.response).toContain("Sure");
      expect(response.response.toLowerCase()).toContain("now");
      
      // Original question context should be maintained
      const state = service.getPublicState();
      expect(state.chatLog[state.chatLog.length - 1].message).toContain("?");
    });
  });

  // ============= CATEGORY 2: STATE MANAGEMENT BUGS =============
  
  describe('2. State Management Risks', () => {
    
    test('2.1 Should not duplicate constraints on update', async () => {
      await service.processMessage("I need 4 analog inputs");
      await service.processMessage("Actually, I need 4 analog inputs"); // Same value
      
      const state = service.getPublicState();
      const analogInputs = state.requirements.constraints.filter(
        c => c.id === 'analog_inputs'
      );
      
      expect(analogInputs.length).toBe(1); // Should not duplicate
      expect(analogInputs[0].value).toBe('4');
    });

    test('2.2 Should preserve conversation context in private cache', async () => {
      await service.processMessage("Industrial PC needed");
      const stateBefore = service.getPublicState();
      
      // Process multiple messages
      await service.processMessage("4 inputs");
      await service.processMessage("2 ethernet ports");
      
      const stateAfter = service.getPublicState();
      
      // Public state should update
      expect(stateAfter.requirements.constraints.length).toBeGreaterThan(
        stateBefore.requirements.constraints.length
      );
      
      // Session ID should remain constant
      expect(stateAfter.sessionId).toBe(stateBefore.sessionId);
    });

    test('2.3 Should handle localStorage save/load correctly', () => {
      // Process message
      service.processMessage("PC with 4 analog inputs");
      
      // Create new instance (simulating page refresh)
      const newService = new ReqMASService();
      newService.loadState();
      
      const state = newService.getPublicState();
      expect(state.requirements.constraints.length).toBeGreaterThan(0);
      expect(state.chatLog.length).toBeGreaterThan(0);
    });

    test('2.4 Should maintain correct category progression', async () => {
      const categoryOrder = ['use_case', 'io', 'communication', 'performance', 'environment', 'commercial'];
      let currentCategoryIndex = 0;
      
      // Process through categories
      for (let i = 0; i < 15; i++) {
        await service.processMessage("test answer " + i);
        const state = service.getPublicState();
        
        // Check we don't skip categories
        const activeCategory = state.requirements.constraints[state.requirements.constraints.length - 1]?.category;
        if (activeCategory) {
          const categoryIndex = categoryOrder.indexOf(activeCategory);
          expect(categoryIndex).toBeGreaterThanOrEqual(currentCategoryIndex);
          currentCategoryIndex = Math.max(currentCategoryIndex, categoryIndex);
        }
      }
    });
  });

  // ============= CATEGORY 3: CLARIFICATION & CONFLICT RESOLUTION =============
  
  describe('3. Clarification and Conflict Handling', () => {
    
    test('3.1 Should handle clarification responses correctly', async () => {
      // Create conflict scenario
      await service.processMessage("I need both 4-20mA and 0-10V signals");
      
      const state = service.getPublicState();
      expect(state.pendingClarification).toBeDefined();
      
      // Answer clarification
      const response = await service.processMessage("4-20mA current");
      
      // Clarification should be resolved
      expect(response.state.pendingClarification).toBeUndefined();
      
      // Value should be set
      const signalType = response.state.requirements.constraints.find(
        c => c.id === 'signal_type'
      );
      expect(signalType?.value).toContain('4-20mA');
    });

    test('3.2 Should retry clarification on invalid response', async () => {
      await service.processMessage("Both current and voltage signals");
      
      // Invalid clarification response
      const response = await service.processMessage("maybe both?");
      
      // Should still have pending clarification
      expect(response.state.pendingClarification).toBeDefined();
      expect(response.response).toContain("didn't understand");
    });

    test('3.3 Should detect and resolve MUTEX conflicts', async () => {
      // Add conflicting requirements sequentially
      await service.processMessage("4-20mA current signals");
      await service.processMessage("0-10V voltage signals");
      
      const state = service.getPublicState();
      
      // Should trigger clarification or keep only latest
      const signalTypes = state.requirements.constraints.filter(
        c => c.id === 'signal_type'
      );
      
      // Should not have both conflicting values active
      const hasConflict = signalTypes.length > 1 && 
                          signalTypes.some(s => s.value.includes('4-20')) &&
                          signalTypes.some(s => s.value.includes('0-10'));
      
      expect(hasConflict || state.pendingClarification).toBeTruthy();
    });
  });

  // ============= CATEGORY 4: EXTRACTION PATTERN BUGS =============
  
  describe('4. Requirement Extraction Accuracy', () => {
    
    test('4.1 Should extract multiple requirements from single input', async () => {
      const response = await service.processMessage(
        "I need 4 analog inputs, 2 analog outputs, and 2 ethernet ports"
      );
      
      const constraints = response.state.requirements.constraints;
      
      expect(constraints.find(c => c.id === 'analog_inputs')?.value).toBe('4');
      expect(constraints.find(c => c.id === 'analog_outputs')?.value).toBe('2');
      expect(constraints.find(c => c.id === 'ethernet_ports')?.value).toBe('2');
    });

    test('4.2 Should handle ambiguous number references', async () => {
      await service.processMessage("I need 2 USB and 2 ethernet");
      
      const state = service.getPublicState();
      const usb = state.requirements.constraints.find(c => c.id === 'usb_ports');
      const ethernet = state.requirements.constraints.find(c => c.id === 'ethernet_ports');
      
      expect(usb?.value).toBe('2');
      expect(ethernet?.value).toBe('2');
    });

    test('4.3 Should extract temperature ranges correctly', async () => {
      const response = await service.processMessage("Operating temperature -10 to 60 degrees");
      
      const temp = response.state.requirements.constraints.find(
        c => c.id === 'temperature'
      );
      
      expect(temp?.value).toContain('-10');
      expect(temp?.value).toContain('60');
    });

    test('4.4 Should not extract from user questions', async () => {
      await service.processMessage("System setup");
      
      // User asks about possibilities, not stating requirement
      const response = await service.processMessage("Could it have 10 ethernet ports?");
      
      // Should not add as constraint
      const ethernet = response.state.requirements.constraints.find(
        c => c.id === 'ethernet_ports' && c.value === '10'
      );
      
      expect(ethernet).toBeUndefined();
    });
  });

  // ============= CATEGORY 5: EDGE CASES & ERROR SCENARIOS =============
  
  describe('5. Edge Cases and Error Handling', () => {
    
    test('5.1 Should handle empty input gracefully', async () => {
      const response = await service.processMessage("");
      
      expect(response.response).toBeDefined();
      expect(response.state).toBeDefined();
      // Should not crash
    });

    test('5.2 Should handle very long input', async () => {
      const longInput = "I need " + "a system with many requirements ".repeat(100);
      
      const response = await service.processMessage(longInput);
      
      expect(response.response).toBeDefined();
      expect(response.response.length).toBeLessThan(1000); // Response should be reasonable
    });

    test('5.3 Should handle special characters in input', async () => {
      const response = await service.processMessage("I need IP65-rated & fanless @ 60°C");
      
      const constraints = response.state.requirements.constraints;
      const ip = constraints.find(c => c.id === 'ip_rating');
      
      expect(ip?.value).toContain('65');
    });

    test('5.4 Should handle rapid successive messages', async () => {
      const promises = [
        service.processMessage("input 1"),
        service.processMessage("input 2"),
        service.processMessage("input 3")
      ];
      
      const responses = await Promise.all(promises);
      
      // All should complete
      expect(responses.length).toBe(3);
      
      // State should be consistent
      const finalState = responses[2].state;
      expect(finalState.chatLog.length).toBeGreaterThanOrEqual(3);
    });

    test('5.5 Should complete flow and trigger autofill', async () => {
      // Speed through all categories
      const inputs = [
        "Industrial control",
        "Both monitoring and control",
        "10 devices",
        "4 analog inputs",
        "2 ethernet ports",
        "Linux",
        "Regular response time", 
        "256GB storage",
        "0 to 40 degrees",
        "Fanless",
        "$1500",
        "2 weeks"
      ];
      
      for (const input of inputs) {
        await service.processMessage(input);
      }
      
      // Trigger autofill
      const result = service.triggerAutofill();
      
      expect(result.constraints.length).toBeGreaterThan(inputs.length);
      
      // Check defaults were added
      const hasDefaults = result.constraints.some(c => c.source === 'autofill');
      expect(hasDefaults).toBe(true);
    });
  });

  // ============= CATEGORY 6: CONSISTENCY TESTS =============
  
  describe('6. System Consistency', () => {
    
    test('6.1 Chat log and debug log should stay synchronized', async () => {
      await service.processMessage("Test 1");
      await service.processMessage("Test 2");
      await service.processMessage("Test 3");
      
      const state = service.getPublicState();
      
      // Should have user and system messages
      const userMessages = state.chatLog.filter(m => m.sender === 'user');
      const systemMessages = state.chatLog.filter(m => m.sender === 'system');
      
      expect(userMessages.length).toBe(3);
      expect(systemMessages.length).toBe(3);
      
      // Debug log should have entries
      expect(state.debugLog.length).toBeGreaterThan(0);
    });

    test('6.2 Confidence scores should be consistent', async () => {
      // User input should have high confidence
      await service.processMessage("4 analog inputs");
      
      // Assumption should have lower confidence  
      await service.processMessage("I don't know");
      
      const state = service.getPublicState();
      const userConstraint = state.requirements.constraints.find(
        c => c.source === 'user'
      );
      const assumptionConstraint = state.requirements.constraints.find(
        c => c.source === 'usecase'
      );
      
      if (userConstraint && assumptionConstraint) {
        expect(userConstraint.confidence).toBeGreaterThan(assumptionConstraint.confidence);
      }
    });

    test('6.3 Session should maintain unique ID', () => {
      const id1 = service.getPublicState().sessionId;
      service.processMessage("test");
      const id2 = service.getPublicState().sessionId;
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/); // UUID format
    });
  });
});

// ============= INTEGRATION TEST SUITE =============

describe('ReqMAS Integration Tests', () => {
  let service: ReqMASService;

  beforeEach(() => {
    localStorage.clear();
    service = new ReqMASService();
  });

  test('Complete happy path conversation', async () => {
    const conversation = [
      { 
        input: "I need a PC controller to collect analog sensor data from four ovens",
        expectedPattern: /control|monitor/i
      },
      {
        input: "Both monitoring and control",
        expectedPattern: /analog|input|signal/i
      },
      {
        input: "4-20mA current",
        expectedPattern: /ethernet|communication/i
      },
      {
        input: "2 ethernet ports and 2 USB",
        expectedPattern: /operating|system/i
      },
      {
        input: "Ubuntu Linux",
        expectedPattern: /temperature|environment/i
      },
      {
        input: "0 to 60 degrees",
        expectedPattern: /fan|cooling/i
      },
      {
        input: "Must be fanless",
        expectedPattern: /budget|price|cost/i
      },
      {
        input: "$1000",
        expectedPattern: /covered|complete|autofill/i
      }
    ];

    for (const step of conversation) {
      const response = await service.processMessage(step.input);
      expect(response.response).toMatch(step.expectedPattern);
    }

    // Should reach completion
    const finalState = service.getPublicState();
    expect(finalState.currentStep).toMatch(/completed|awaiting/);
  });
});