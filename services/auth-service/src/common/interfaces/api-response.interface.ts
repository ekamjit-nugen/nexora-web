export interface StandardResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    fields?: Record<string, string>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}
