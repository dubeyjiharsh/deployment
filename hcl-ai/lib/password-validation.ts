/**
 * Password validation utilities
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Password requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

/**
 * Validates password against security requirements
 * @param password - Password to validate
 * @returns Validation result with errors
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password) {
    return {
      isValid: false,
      errors: ["Password is required"],
    };
  }

  // Check minimum length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(
      `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`
    );
  }

  // Check for uppercase letters
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Check for lowercase letters
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Check for numbers
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Check for special characters
  if (
    PASSWORD_REQUIREMENTS.requireSpecialChars &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ) {
    errors.push("Password must contain at least one special character");
  }

  // Check for common weak passwords
  const weakPasswords = [
    "password",
    "password123",
    "12345678",
    "qwerty",
    "admin",
    "admin123",
    "letmein",
  ];
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push("This password is too common and easily guessable");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets password requirements as human-readable text
 */
export function getPasswordRequirementsText(): string[] {
  const requirements: string[] = [];

  requirements.push(
    `At least ${PASSWORD_REQUIREMENTS.minLength} characters long`
  );

  if (PASSWORD_REQUIREMENTS.requireUppercase) {
    requirements.push("Contains at least one uppercase letter (A-Z)");
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase) {
    requirements.push("Contains at least one lowercase letter (a-z)");
  }

  if (PASSWORD_REQUIREMENTS.requireNumbers) {
    requirements.push("Contains at least one number (0-9)");
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChars) {
    requirements.push("Contains at least one special character (!@#$%^&*, etc.)");
  }

  return requirements;
}
