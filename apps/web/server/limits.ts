// Operational limits. None is a regulated value.
export const LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxRequestBytes: 26 * 1024 * 1024,
  maxFilesPerDataset: 20,
  maxFileNameLength: 120,
  maxXlsxUncompressedBytes: 200 * 1024 * 1024,
  maxJsonBytes: 2 * 1024 * 1024,
  maxTextLength: 200,
  passwordMinLength: 12,
  passwordMaxLength: 200,
  sessionDays: 14,
  invitationDays: 7,
  loginAttemptsPerEmail: 10,     // per window
  loginAttemptsPerAddress: 30,
  signupAttemptsPerAddress: 10,
  attemptWindowMinutes: 15,
} as const;
