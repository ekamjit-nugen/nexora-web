export const ValidationPatterns = {
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/,
  TAN: /^[A-Z]{4}[0-9]{5}[A-Z]$/,
  CIN: /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PINCODE_IN: /^[1-9][0-9]{5}$/,
  MSME: /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/,
} as const;

export function validatePAN(pan: string): boolean {
  return ValidationPatterns.PAN.test(pan);
}

export function validateGSTIN(gstin: string): boolean {
  return ValidationPatterns.GSTIN.test(gstin);
}

export function validateTAN(tan: string): boolean {
  return ValidationPatterns.TAN.test(tan);
}

export function validateIFSC(ifsc: string): boolean {
  return ValidationPatterns.IFSC.test(ifsc);
}

export function validateCIN(cin: string): boolean {
  return ValidationPatterns.CIN.test(cin);
}
