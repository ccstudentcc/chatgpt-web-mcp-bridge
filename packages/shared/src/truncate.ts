export interface TruncateResult {
  text: string;
  truncated: boolean;
  originalSizeChars: number;
}

export function truncateText(text: string, maxChars: number): TruncateResult {
  if (text.length <= maxChars) {
    return { text, truncated: false, originalSizeChars: text.length };
  }

  return {
    text: `${text.slice(0, maxChars)}\n\n[truncated: original size ${text.length} chars]`,
    truncated: true,
    originalSizeChars: text.length
  };
}
