const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /AKIA[0-9A-Z]{16}/g,
  /sk-[A-Za-z0-9_-]{12,}/g,
  /ghp_[A-Za-z0-9_]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /(password\s*=\s*)[^\s]+/gi,
  /(api[_-]?key\s*=\s*)[^\s]+/gi,
  /(secret\s*=\s*)[^\s]+/gi,
  /(token\s*=\s*)[^\s]+/gi
];

export function hasSecretLikeContent(input: string): boolean {
  return secretPatterns.some((pattern) => pattern.test(input));
}

export function redactSecretLikeContent(input: string): string {
  let output = input;
  for (const pattern of secretPatterns) {
    output = output.replace(pattern, (match, prefix?: string) => `${prefix ?? ''}[REDACTED]`);
  }
  return output;
}
