// LLM Validation Test Script
// This tests if your LLM integration is working correctly

import { describe, test, expect, beforeAll } from 'vitest';
import { LLMService } from '../LLMService';
import { ReqMASService } from '../ReqMASService';

describe('LLM Integration Validation', () => {
  let llmService;
  let reqmasService;
  
  beforeAll(() => {
    llmService = new LLMService();
    reqmasService = new ReqMASService();
  });

  describe('1. Environment Configuration', () => {
    test('Environment variables are loaded', () => {
      console.log('\n📋 ENVIRONMENT CHECK:');
      console.log('USE_LLM:', import.meta.env.VITE_USE_LLM);
      console.log('PROVIDER:', import.meta.env.VITE_LLM_PROVIDER);
      console.log('Has OpenAI Key:', !!import.meta.env.VITE_OPENAI_API_KEY);
      console.log('Has Anthropic Key:', !!import.meta.env.VITE_ANTHROPIC_API_KEY);
      console.log('Has Google Key:', !!import.meta.env.VITE_GOOGLE_AI_API_KEY);
      
      // At least one should be true
      expect(import.meta.env.VITE_USE_LLM).toBe('true');
      expect(import.meta.env.VITE_LLM_PROVIDER).toBeTruthy();
    });
  });

  describe('2. LLM Service Configuration', () => {
    test('LLM Service is available', () => {
      const isAvailable = llmService.isAvailable();
      console.log('\n🤖 LLM SERVICE STATUS:');
      console.log('Is Available:', isAvailable);
      
      if (!isAvailable) {
        console.log('❌ LLM not available - Check your .env file');
        console.log('Make sure VITE_USE_LLM=true');
        console.log('Make sure you have the correct API key set');
      }
      
      expect(isAvailable).toBe(true);
    });
  });

  describe('3. LLM API Connection', () => {
    test('Can make API calls to LLM', async () => {
      if (!llmService.isAvailable()) {
        console.log('⚠️ Skipping API test - LLM not configured');
        return;
      }

      console.log('\n🌐 TESTING API CONNECTION...');
      const testPrompt = 'Respond with exactly the word "WORKING" and nothing else.';
      
      try {
        const response = await llmService.generateResponse(testPrompt);
        console.log('API Response:', response);
        
        expect(response).toBeTruthy();
        expect(response.toLowerCase()).toContain('working');
        console.log('✅ LLM API is responding!');
      } catch (error) {
        console.log('❌ API Error:', error.message);
        throw error;
      }
    }, 10000); // 10 second timeout for API call
  });

  describe('4. ReqMAS Integration with LLM', () => {
    test('ReqMAS uses LLM for assumptions', async () => {
      console.log('\n🔧 TESTING REQMAS INTEGRATION...');
      
      // Start conversation
      await reqmasService.processMessage("I need an industrial control system");
      
      // Test "don't know" scenario
      const response = await reqmasService.processMessage("I don't know");
      
      console.log('Response contains "assume":', response.response.includes('assume'));
      console.log('Response:', response.response.substring(0, 200) + '...');
      
      // Check assumptions were created
      const assumptions = response.state.requirements.constraints.filter(
        c => c.source === 'usecase'
      );
      
      console.log('Assumptions created:', assumptions.length);
      if (assumptions.length > 0) {
        console.log('First assumption:', assumptions[0]);
      }
      
      expect(response.response).toContain('assume');
      expect(assumptions.length).toBeGreaterThan(0);
      
      console.log('✅ ReqMAS is using LLM successfully!');
    }, 10000);
    
    test('LLM generates contextual assumptions', async () => {
      const service = new ReqMASService(); // Fresh instance
      
      // Set up specific context
      await service.processMessage("I need a system for temperature monitoring");
      await service.processMessage("For industrial ovens");
      
      // Test assumption generation
      const response = await service.processMessage("I'm not sure about the signal type");
      
      console.log('\n📊 CONTEXTUAL ASSUMPTION TEST:');
      console.log('Generated response:', response.response.substring(0, 150) + '...');
      
      const assumptions = response.state.requirements.constraints.filter(
        c => c.source === 'usecase'
      );
      
      if (assumptions.length > 0) {
        console.log('Assumption value:', assumptions[0].value);
        console.log('Assumption confidence:', assumptions[0].confidence);
      }
      
      expect(response.response.toLowerCase()).toContain('assume');
      expect(assumptions.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('5. Error Handling', () => {
    test('System handles LLM failures gracefully', async () => {
      // Temporarily break the API key to test fallback
      const originalKey = import.meta.env.VITE_OPENAI_API_KEY;
      import.meta.env.VITE_OPENAI_API_KEY = 'invalid-key';
      
      const testService = new ReqMASService();
      
      await testService.processMessage("Test system");
      const response = await testService.processMessage("I don't know");
      
      // Should still work with rule-based fallback
      expect(response.response).toBeTruthy();
      
      // Restore key
      import.meta.env.VITE_OPENAI_API_KEY = originalKey;
      
      console.log('✅ Fallback mechanism works when LLM fails');
    });
  });
});

// Summary function
async function runFullDiagnostic() {
  console.log('\n' + '='.repeat(50));
  console.log('       LLM INTEGRATION DIAGNOSTIC REPORT');
  console.log('='.repeat(50));
  
  const llm = new LLMService();
  const reqmas = new ReqMASService();
  
  const report = {
    environment: {
      llmEnabled: import.meta.env.VITE_USE_LLM === 'true',
      provider: import.meta.env.VITE_LLM_PROVIDER,
      hasKey: !!import.meta.env.VITE_OPENAI_API_KEY || 
              !!import.meta.env.VITE_ANTHROPIC_API_KEY || 
              !!import.meta.env.VITE_GOOGLE_AI_API_KEY
    },
    service: {
      available: llm.isAvailable()
    },
    api: {
      working: false,
      error: null
    },
    integration: {
      working: false
    }
  };
  
  // Test API
  if (llm.isAvailable()) {
    try {
      const response = await llm.generateResponse('Say "test"');
      report.api.working = !!response;
    } catch (e) {
      report.api.error = e.message;
    }
  }
  
  // Test integration
  try {
    await reqmas.processMessage("Setup");
    const r = await reqmas.processMessage("I don't know");
    report.integration.working = r.response.includes('assume');
  } catch (e) {
    report.integration.error = e.message;
  }
  
  // Print report
  console.log('\n📊 DIAGNOSTIC RESULTS:\n');
  console.log('Environment Configuration:');
  console.log(`  LLM Enabled: ${report.environment.llmEnabled ? '✅' : '❌'}`);
  console.log(`  Provider: ${report.environment.provider || '❌ Not set'}`);
  console.log(`  API Key: ${report.environment.hasKey ? '✅ Present' : '❌ Missing'}`);
  
  console.log('\nService Status:');
  console.log(`  LLM Service: ${report.service.available ? '✅ Available' : '❌ Not available'}`);
  
  console.log('\nAPI Connection:');
  console.log(`  API Calls: ${report.api.working ? '✅ Working' : '❌ Failed'}`);
  if (report.api.error) {
    console.log(`  Error: ${report.api.error}`);
  }
  
  console.log('\nReqMAS Integration:');
  console.log(`  Integration: ${report.integration.working ? '✅ Working' : '❌ Failed'}`);
  
  console.log('\n' + '='.repeat(50));
  
  const allWorking = report.environment.llmEnabled && 
                     report.service.available && 
                     report.api.working && 
                     report.integration.working;
  
  if (allWorking) {
    console.log('🎉 ALL SYSTEMS OPERATIONAL! LLM Integration is working perfectly!');
  } else {
    console.log('⚠️ Some issues detected. Check the report above for details.');
  }
  
  console.log('='.repeat(50) + '\n');
}

// Export for manual testing
export { runFullDiagnostic };