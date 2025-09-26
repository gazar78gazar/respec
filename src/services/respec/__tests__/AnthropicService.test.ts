import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicService } from '../AnthropicService';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn()
      }
    }))
  };
});

describe('AnthropicService', () => {
  let service: AnthropicService;

  beforeEach(() => {
    service = new AnthropicService('test-api-key');
  });

  describe('constructor', () => {
    it('should initialize with provided API key', () => {
      const serviceWithKey = new AnthropicService('my-key');
      expect(serviceWithKey).toBeDefined();
    });

    it('should warn when no API key is provided', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      new AnthropicService();
      expect(consoleSpy).toHaveBeenCalledWith('[AnthropicService] No API key provided - will use fallback responses');
      consoleSpy.mockRestore();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with API key', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await service.initialize();
      expect(consoleSpy).toHaveBeenCalledWith('[AnthropicService] Initialized with API key');
      consoleSpy.mockRestore();
    });

    it('should store field mappings when provided', async () => {
      const fieldMappings = { 'io_connectivity': ['digital_io', 'analog_io'] };
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await service.initialize(fieldMappings);

      expect(consoleSpy).toHaveBeenCalledWith('[AnthropicService] Received field mappings:', fieldMappings);
      consoleSpy.mockRestore();
    });
  });

  describe('analyzeRequirements - fallback mode', () => {
    beforeEach(() => {
      // Create service without API key to test fallback
      service = new AnthropicService();
    });

    it('should extract digital I/O requirements', async () => {
      const result = await service.analyzeRequirements('I need 16 digital inputs');

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: 'io_connectivity',
        field: 'digital_io',
        value: '16',
        confidence: 0.8,
        isAssumption: false
      });
    });

    it('should extract analog I/O requirements', async () => {
      const result = await service.analyzeRequirements('I need 8 analog inputs');

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: 'io_connectivity',
        field: 'analog_io',
        value: '8',
        confidence: 0.8,
        isAssumption: false
      });
    });

    it('should extract ethernet ports requirements', async () => {
      const result = await service.analyzeRequirements('I need 2 ethernet ports');

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: 'io_connectivity',
        field: 'ethernet_ports',
        value: '2',
        confidence: 0.8,
        isAssumption: false
      });
    });

    it('should extract processor requirements', async () => {
      const result = await service.analyzeRequirements('I need an Intel Core i7 processor');

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: 'compute_performance',
        field: 'processor_type',
        value: 'Intel Core i7',
        confidence: 0.8,
        isAssumption: false
      });
    });

    it('should extract memory requirements', async () => {
      const result = await service.analyzeRequirements('I need 8GB memory');

      expect(result.requirements).toHaveLength(1);
      expect(result.requirements[0]).toEqual({
        section: 'compute_performance',
        field: 'memory_capacity',
        value: '8',
        confidence: 0.8,
        isAssumption: false
      });
    });

    it('should extract multiple requirements from single message', async () => {
      const result = await service.analyzeRequirements('I need 16 digital inputs and 8 analog inputs');

      expect(result.requirements).toHaveLength(2);
      expect(result.requirements.map(r => r.field)).toContain('digital_io');
      expect(result.requirements.map(r => r.field)).toContain('analog_io');
    });

    it('should return clarification request when no requirements found', async () => {
      const result = await service.analyzeRequirements('Hello there');

      expect(result.requirements).toHaveLength(0);
      expect(result.clarificationNeeded).toBeDefined();
      expect(result.response).toContain('Could you provide more specific details');
    });

    it('should handle quantity and budget patterns', async () => {
      const result = await service.analyzeRequirements('quantity: 5 and budget per unit: 1000');

      expect(result.requirements).toHaveLength(2);
      const fields = result.requirements.map(r => r.field);
      expect(fields).toContain('quantity');
      expect(fields).toContain('budget_per_unit');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should include field mappings in system prompt when available', async () => {
      const fieldMappings = {
        'io_connectivity': ['digital_io', 'analog_io'],
        'compute_performance': ['processor_type', 'memory_capacity']
      };

      await service.initialize(fieldMappings);

      // Access private method for testing
      const prompt = (service as any).buildSystemPrompt();

      expect(prompt).toContain('io_connectivity: digital_io, analog_io');
      expect(prompt).toContain('compute_performance: processor_type, memory_capacity');
    });

    it('should use default field descriptions when no mappings provided', async () => {
      await service.initialize();

      const prompt = (service as any).buildSystemPrompt();

      expect(prompt).toContain('compute_performance: processor_type');
      expect(prompt).toContain('io_connectivity: digital_io');
      expect(prompt).toContain('form_factor: power_input');
    });
  });
});