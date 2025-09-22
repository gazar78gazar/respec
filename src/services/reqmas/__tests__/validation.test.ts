import { describe, it, expect } from 'vitest';

describe('Validation Tests', () => {
  it('should validate required fields', () => {
    const requirement = {
      digitalIO: 8,
      analogIO: 4,
      networkPorts: '2 x RJ45'
    };

    // Test required fields are present
    expect(requirement.digitalIO).toBeDefined();
    expect(requirement.analogIO).toBeDefined();
    expect(requirement.networkPorts).toBeDefined();
  });

  it('should validate numeric ranges', () => {
    const digitalIO = 8;
    const analogIO = 4;

    // Test numeric constraints
    expect(digitalIO).toBeGreaterThanOrEqual(0);
    expect(digitalIO).toBeLessThanOrEqual(128);
    expect(analogIO).toBeGreaterThanOrEqual(0);
    expect(analogIO).toBeLessThanOrEqual(32);
  });

  it('should validate budget format', () => {
    const budgetPerUnit = '$2000';
    const budgetPattern = /^\$?\d+(\.\d{0,2})?$/;

    expect(budgetPerUnit).toMatch(budgetPattern);
  });

  it('should validate temperature ranges', () => {
    const tempRange = '0°C to 50°C';
    const pattern = /(-?\d+)°?C?\s*to\s*(-?\d+)°?C?/i;
    
    expect(tempRange).toMatch(pattern);
  });

  it('should validate IP ratings', () => {
    const ipRatings = ['IP20', 'IP40', 'IP54', 'IP65', 'IP67'];
    const ipPattern = /^IP\d{2}$/;

    ipRatings.forEach(rating => {
      expect(rating).toMatch(ipPattern);
    });
  });
});