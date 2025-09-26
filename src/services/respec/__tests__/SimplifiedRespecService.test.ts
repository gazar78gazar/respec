import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimplifiedRespecService } from '../SimplifiedRespecService';

// Mock the AnthropicService
vi.mock('../AnthropicService', () => ({
  AnthropicService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    analyzeRequirements: vi.fn()
  }))
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock fetch
global.fetch = vi.fn();

describe('SimplifiedRespecService', () => {
  let service: SimplifiedRespecService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SimplifiedRespecService();
  });

  describe('constructor', () => {
    it('should create service with unique session ID', () => {
      const service1 = new SimplifiedRespecService();
      const service2 = new SimplifiedRespecService();

      expect(service1.getSessionId()).toBeDefined();
      expect(service2.getSessionId()).toBeDefined();
      expect(service1.getSessionId()).not.toBe(service2.getSessionId());
    });
  });

  describe('initialize', () => {
    it('should load UC1.json successfully', async () => {
      const mockUC1Data = {
        specifications: {
          'digital_io': {
            name: 'digital_io',
            form_mapping: {
              section: 'io_connectivity',
              field_name: 'digital_io'
            }
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUC1Data)
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await service.initialize();

      expect(fetch).toHaveBeenCalledWith('/uc1.json');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SimplifiedRespec] UC1.json loaded, extracted',
        expect.any(Number),
        'field mappings'
      );
      consoleSpy.mockRestore();
    });

    it('should use fallback mappings when UC1.json fails to load', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Failed to load'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await service.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SimplifiedRespec] Failed to load UC1.json:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should not reinitialize if already initialized', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await service.initialize();
      const firstCallCount = (fetch as any).mock.calls.length;

      await service.initialize();

      expect((fetch as any).mock.calls.length).toBe(firstCallCount);
      expect(consoleSpy).toHaveBeenCalledWith('[SimplifiedRespec] Already initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('processChatMessage', () => {
    beforeEach(async () => {
      // Mock successful UC1 load
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ specifications: {} })
      });

      await service.initialize();
    });

    it('should process message and return chat result', async () => {
      const mockAnthropicResult = {
        requirements: [{
          section: 'io_connectivity',
          field: 'digital_io',
          value: '8',
          confidence: 0.8,
          isAssumption: false
        }],
        response: 'I found 8 digital I/O requirements.',
        clarificationNeeded: undefined
      };

      // Mock the AnthropicService method
      const mockAnalyze = vi.fn().mockResolvedValue(mockAnthropicResult);
      (service as any).anthropicService.analyzeRequirements = mockAnalyze;

      const result = await service.processChatMessage('I need 8 digital inputs');

      expect(result.success).toBe(true);
      expect(result.systemMessage).toBe('I found 8 digital I/O requirements.');
      expect(result.formUpdates).toHaveLength(1);
      expect(result.formUpdates![0]).toEqual({
        section: 'io_connectivity',
        field: 'digital_io',
        value: '8',
        isAssumption: false,
        confidence: 0.8
      });
    });

    it('should fall back to pattern matching when Anthropic fails', async () => {
      // Mock AnthropicService to throw error
      const mockAnalyze = vi.fn().mockRejectedValue(new Error('API failed'));
      (service as any).anthropicService.analyzeRequirements = mockAnalyze;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.processChatMessage('I need 16 digital inputs');

      expect(result.success).toBe(true);
      expect(result.systemMessage).toContain('16');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SimplifiedRespec] Anthropic processing failed, using fallback:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should add messages to conversation history', async () => {
      const mockAnalyze = vi.fn().mockResolvedValue({
        requirements: [],
        response: 'Test response',
        clarificationNeeded: undefined
      });
      (service as any).anthropicService.analyzeRequirements = mockAnalyze;

      await service.processChatMessage('Test message');

      const history = service.getConversationHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Test message');
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('Test response');
    });
  });

  describe('processFormUpdate', () => {
    it('should acknowledge form updates', async () => {
      const result = await service.processFormUpdate('io_connectivity', 'digital_io', '8');

      expect(result.acknowledged).toBe(true);
      expect(result.acknowledgment).toBeDefined();
      expect(typeof result.acknowledgment).toBe('string');
    });

    it('should add acknowledgment to conversation history', async () => {
      await service.processFormUpdate('io_connectivity', 'digital_io', '8');

      const history = service.getConversationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('assistant');
    });
  });

  describe('triggerAutofill', () => {
    it('should return autofill suggestions for substation context', async () => {
      // Set up conversation history to indicate substation context
      await service.processChatMessage('substation requirements');

      const result = await service.triggerAutofill('button_header');

      expect(result.trigger).toBe('button_header');
      expect(result.fields.length).toBeGreaterThan(0);
      expect(result.message).toContain('substation');
      expect(result.fields.every(f => f.isAssumption)).toBe(true);
    });

    it('should return generic defaults when no specific context', async () => {
      const result = await service.triggerAutofill('dont_know');

      expect(result.fields.length).toBeGreaterThan(0);
      expect(result.message).toContain('common electronic system');
    });
  });

  describe('pattern matching (fallback)', () => {
    it('should recognize digital I/O patterns', () => {
      const analysis = (service as any).analyzeMessage('I need 16 digital inputs');

      expect(analysis.requirements).toHaveLength(1);
      expect(analysis.requirements[0].type).toBe('digital_input');
      expect(analysis.requirements[0].value).toBe(16);
    });

    it('should recognize analog I/O patterns', () => {
      const analysis = (service as any).analyzeMessage('I need 8 analog inputs');

      expect(analysis.requirements).toHaveLength(1);
      expect(analysis.requirements[0].type).toBe('analog_input');
      expect(analysis.requirements[0].value).toBe(8);
    });

    it('should recognize substation context', () => {
      const analysis = (service as any).analyzeMessage('substation automation system');

      expect(analysis.context).toBe('substation');
    });

    it('should recognize industrial context', () => {
      const analysis = (service as any).analyzeMessage('industrial manufacturing control');

      expect(analysis.context).toBe('industrial');
    });

    it('should recognize communication requirements', () => {
      const analysis = (service as any).analyzeMessage('ethernet and modbus communication');

      expect(analysis.requirements.some(r => r.type === 'communication')).toBe(true);
    });
  });

  describe('session management', () => {
    it('should clear session and conversation history', () => {
      service.clearSession();

      expect(service.getConversationHistory()).toHaveLength(0);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        `respec_session_${service.getSessionId()}`
      );
    });

    it('should return debug information', () => {
      const debug = service.getDebugInfo();

      expect(debug.sessionId).toBeDefined();
      expect(debug.isInitialized).toBeDefined();
      expect(debug.conversationLength).toBeDefined();
    });
  });

  describe('field mapping extraction', () => {
    it('should extract field mappings from UC1 data', async () => {
      const mockUC1Data = {
        specifications: {
          'digital_io': {
            name: 'digital_io',
            form_mapping: {
              section: 'io_connectivity',
              field_name: 'digital_io'
            }
          },
          'analog_io': {
            name: 'analog_io',
            form_mapping: {
              section: 'io_connectivity',
              field_name: 'analog_io'
            }
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUC1Data)
      });

      const newService = new SimplifiedRespecService();
      await newService.initialize();

      // Test that field mappings were extracted
      const mappingsForPrompt = (newService as any).getFieldMappingsForPrompt();
      expect(mappingsForPrompt.io_connectivity).toContain('digital_io');
      expect(mappingsForPrompt.io_connectivity).toContain('analog_io');
    });
  });
});