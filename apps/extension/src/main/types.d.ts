declare function GM_xmlhttpRequest(options: {
  method: string;
  url: string;
  data?: string;
  headers?: Record<string, string>;
  timeout?: number;
  onload?: (response: { status: number; responseText: string }) => void;
  onerror?: (error: unknown) => void;
  ontimeout?: () => void;
}): void;
declare function GM_setValue(key: string, value: string): void;
declare function GM_getValue(key: string, defaultValue?: string): string;
declare function GM_setClipboard(text: string): void;
