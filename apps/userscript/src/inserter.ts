export function insertIntoChatInput(value: string): boolean {
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
  if (textarea) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    return true;
  }

  const editable = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
  if (editable) {
    editable.focus();
    editable.textContent = value;
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    return true;
  }

  GM_setClipboard(value);
  return false;
}

export function formatToolResult(tool: string, response: unknown): string {
  return `Tool result for \`${tool}\`:\n\n\`\`\`tool_result\n${JSON.stringify(response, null, 2)}\n\`\`\`\n\nPlease continue based on this tool result.`;
}
