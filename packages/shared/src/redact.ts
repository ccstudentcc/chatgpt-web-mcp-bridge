const blockingSecretMatchers = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /sk-[A-Za-z0-9_-]{12,}/,
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/
];

const assignmentSecretMatchers = [
  /(password\s*=\s*)[^\s]+/i,
  /(api[_-]?key\s*=\s*)[^\s]+/i,
  /(secret\s*=\s*)[^\s]+/i,
  /(token\s*=\s*)[^\s]+/i
];

const blockingSecretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /AKIA[0-9A-Z]{16}/g,
  /sk-[A-Za-z0-9_-]{12,}/g,
  /ghp_[A-Za-z0-9_]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g
];

const assignmentSecretPatterns = [
  /(password\s*=\s*)[^\s]+/gi,
  /(api[_-]?key\s*=\s*)[^\s]+/gi,
  /(secret\s*=\s*)[^\s]+/gi,
  /(token\s*=\s*)[^\s]+/gi
];

export function hasSecretLikeContent(input: string): boolean {
  return blockingSecretMatchers.some((pattern) => pattern.test(input));
}

export function hasRedactableSecretLikeContent(input: string): boolean {
  return [...blockingSecretMatchers, ...assignmentSecretMatchers].some((pattern) => pattern.test(input));
}

export function redactSecretLikeContent(input: string): string {
  let output = input;
  for (const pattern of [...blockingSecretPatterns, ...assignmentSecretPatterns]) {
    output = output.replace(pattern, (match, prefix?: string) => `${prefix ?? ''}[REDACTED]`);
  }
  return output;
}

export interface SensitiveContentAssessment {
  blocked: boolean;
  redacted: boolean;
  content: string;
}

export function assessSensitiveTextContent(input: string): SensitiveContentAssessment {
  if (hasSecretLikeContent(input)) {
    return {
      blocked: true,
      redacted: false,
      content: input
    };
  }

  const content = redactSecretLikeContent(input);
  return {
    blocked: false,
    redacted: content !== input,
    content
  };
}
