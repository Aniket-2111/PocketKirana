/**
 * PocketKirana — Reusable Accessible Form Validation Library
 * Provides synchronous & asynchronous field validators with accessible error messages.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export type ValidatorFn = (value: any, formValues?: Record<string, any>) => ValidationResult;

export const Validators = {
  required: (customMsg?: string): ValidatorFn => (value: any) => {
    if (value === null || value === undefined) {
      return { isValid: false, error: customMsg || 'This field is required' };
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return { isValid: false, error: customMsg || 'This field is required' };
    }
    if (Array.isArray(value) && value.length === 0) {
      return { isValid: false, error: customMsg || 'Please select at least one item' };
    }
    return { isValid: true };
  },

  phone: (customMsg?: string): ValidatorFn => (value: any) => {
    const raw = String(value || '').replace(/\D/g, '');
    // Indian 10-digit mobile number starting with 6, 7, 8, 9
    const isValid = /^[6-9]\d{9}$/.test(raw);
    return {
      isValid,
      error: isValid ? undefined : customMsg || 'Please enter a valid 10-digit mobile number',
    };
  },

  email: (customMsg?: string): ValidatorFn => (value: any) => {
    if (!value) return { isValid: true }; // optional if empty; pair with required if mandatory
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
    return {
      isValid,
      error: isValid ? undefined : customMsg || 'Please enter a valid email address',
    };
  },

  otp: (length: number = 6, customMsg?: string): ValidatorFn => (value: any) => {
    const raw = String(value || '').replace(/\D/g, '');
    const isValid = new RegExp(`^\\d{${length}}$`).test(raw);
    return {
      isValid,
      error: isValid ? undefined : customMsg || `Please enter the ${length}-digit verification OTP`,
    };
  },

  pincode: (customMsg?: string): ValidatorFn => (value: any) => {
    const raw = String(value || '').replace(/\D/g, '');
    // Indian 6-digit PIN code
    const isValid = /^[1-9][0-9]{5}$/.test(raw);
    return {
      isValid,
      error: isValid ? undefined : customMsg || 'Please enter a valid 6-digit postal pincode',
    };
  },

  minLength: (min: number, customMsg?: string): ValidatorFn => (value: any) => {
    const len = String(value || '').length;
    const isValid = len >= min;
    return {
      isValid,
      error: isValid ? undefined : customMsg || `Must be at least ${min} characters`,
    };
  },

  maxLength: (max: number, customMsg?: string): ValidatorFn => (value: any) => {
    const len = String(value || '').length;
    const isValid = len <= max;
    return {
      isValid,
      error: isValid ? undefined : customMsg || `Cannot exceed ${max} characters`,
    };
  },

  positiveNumber: (customMsg?: string): ValidatorFn => (value: any) => {
    const num = Number(value);
    const isValid = !isNaN(num) && num > 0;
    return {
      isValid,
      error: isValid ? undefined : customMsg || 'Please enter a valid amount greater than zero',
    };
  },

  quantity: (min: number = 1, max: number = 99, customMsg?: string): ValidatorFn => (value: any) => {
    const num = parseInt(String(value), 10);
    const isValid = !isNaN(num) && num >= min && num <= max;
    return {
      isValid,
      error: isValid ? undefined : customMsg || `Quantity must be between ${min} and ${max}`,
    };
  },

  address: (customMsg?: string): ValidatorFn => (value: any) => {
    const trimmed = String(value || '').trim();
    // Address should be descriptive (at least 8 chars)
    const isValid = trimmed.length >= 8;
    return {
      isValid,
      error: isValid ? undefined : customMsg || 'Please enter a complete delivery address (house/flat, street, landmark)',
    };
  },
};

export function validateField(value: any, validators: ValidatorFn[], formValues?: Record<string, any>): string | undefined {
  for (const validator of validators) {
    const result = validator(value, formValues);
    if (!result.isValid) {
      return result.error;
    }
  }
  return undefined;
}

export function validateForm(values: Record<string, any>, rules: Record<string, ValidatorFn[]>): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const field of Object.keys(rules)) {
    const error = validateField(values[field], rules[field], values);
    if (error) {
      errors[field] = error;
      isValid = false;
    }
  }

  return { isValid, errors };
}
