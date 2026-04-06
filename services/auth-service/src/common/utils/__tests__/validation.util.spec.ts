import {
  validatePAN,
  validateGSTIN,
  validateTAN,
  validateIFSC,
  validateCIN,
} from '../validation.util';

describe('Validation Utilities', () => {
  describe('validatePAN', () => {
    it('should pass for valid PAN', () => {
      expect(validatePAN('ABCDE1234F')).toBe(true);
    });

    it('should fail for lowercase PAN', () => {
      expect(validatePAN('abcde1234f')).toBe(false);
    });

    it('should fail for wrong format (digits first)', () => {
      expect(validatePAN('12345ABCDE')).toBe(false);
    });

    it('should fail for wrong length (9 chars)', () => {
      expect(validatePAN('ABCD1234F')).toBe(false);
    });

    it('should fail for wrong length (11 chars)', () => {
      expect(validatePAN('ABCDEF1234G')).toBe(false);
    });

    it('should fail for empty string', () => {
      expect(validatePAN('')).toBe(false);
    });

    it('should fail when last char is digit', () => {
      expect(validatePAN('ABCDE12345')).toBe(false);
    });
  });

  describe('validateGSTIN', () => {
    it('should pass for valid GSTIN', () => {
      expect(validateGSTIN('06ABCDE1234F1ZQ')).toBe(true);
    });

    it('should fail for lowercase GSTIN', () => {
      expect(validateGSTIN('06abcde1234f1zq')).toBe(false);
    });

    it('should fail for wrong length', () => {
      expect(validateGSTIN('06ABCDE1234F')).toBe(false);
    });

    it('should fail for missing state code digits', () => {
      expect(validateGSTIN('ABABCDE1234F1ZQ')).toBe(false);
    });

    it('should fail for empty string', () => {
      expect(validateGSTIN('')).toBe(false);
    });
  });

  describe('validateTAN', () => {
    it('should pass for valid TAN', () => {
      expect(validateTAN('DELC12345F')).toBe(true);
    });

    it('should fail for lowercase TAN', () => {
      expect(validateTAN('delc12345f')).toBe(false);
    });

    it('should fail for wrong length', () => {
      expect(validateTAN('DELC1234F')).toBe(false);
    });

    it('should fail for wrong format', () => {
      expect(validateTAN('1234DELCFG')).toBe(false);
    });

    it('should fail for empty string', () => {
      expect(validateTAN('')).toBe(false);
    });
  });

  describe('validateIFSC', () => {
    it('should pass for valid IFSC', () => {
      expect(validateIFSC('SBIN0001234')).toBe(true);
    });

    it('should fail for lowercase IFSC', () => {
      expect(validateIFSC('sbin0001234')).toBe(false);
    });

    it('should fail for wrong length', () => {
      expect(validateIFSC('SBIN000123')).toBe(false);
    });

    it('should fail when 5th char is not 0', () => {
      expect(validateIFSC('SBIN1001234')).toBe(false);
    });

    it('should fail for empty string', () => {
      expect(validateIFSC('')).toBe(false);
    });
  });

  describe('validateCIN', () => {
    it('should pass for valid CIN', () => {
      expect(validateCIN('U12345MH2020PLC123456')).toBe(true);
    });

    it('should pass for CIN starting with L', () => {
      expect(validateCIN('L12345MH2020PLC123456')).toBe(true);
    });

    it('should fail for lowercase CIN', () => {
      expect(validateCIN('u12345mh2020plc123456')).toBe(false);
    });

    it('should fail for wrong starting character', () => {
      expect(validateCIN('A12345MH2020PLC123456')).toBe(false);
    });

    it('should fail for wrong length', () => {
      expect(validateCIN('U12345MH2020PLC12345')).toBe(false);
    });

    it('should fail for empty string', () => {
      expect(validateCIN('')).toBe(false);
    });
  });
});
