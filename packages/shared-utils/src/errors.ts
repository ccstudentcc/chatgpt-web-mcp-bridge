export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toErrorPayload(error: unknown): { code: string; message: string; details?: unknown } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, details: error.details };
  }

  if (error instanceof Error) {
    return { code: 'INTERNAL_ERROR', message: error.message };
  }

  return { code: 'INTERNAL_ERROR', message: 'Unknown internal error.' };
}
