/**
 * Tests for uploadFileWithProgress
 *
 * Mocks XMLHttpRequest to verify progress callbacks, headers,
 * error handling, and abort behavior.
 */
import { uploadFileWithProgress } from "../api";

// ── Mock XMLHttpRequest ──

type XHREventHandler = ((e: ProgressEvent | Event) => void) | null;

class MockXHR {
  static lastInstance: MockXHR;

  // Request
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: FormData | null = null;
  withCredentials = false;

  // Status
  status = 200;
  responseText = "";

  // Event listeners
  private listeners: Record<string, XHREventHandler[]> = {};
  upload = {
    listeners: {} as Record<string, XHREventHandler[]>,
    addEventListener: jest.fn((event: string, handler: XHREventHandler) => {
      if (!this.upload.listeners[event]) this.upload.listeners[event] = [];
      this.upload.listeners[event].push(handler);
    }),
  };

  constructor() {
    MockXHR.lastInstance = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send(body: FormData | null) {
    this.body = body;
  }

  abort = jest.fn();

  addEventListener(event: string, handler: XHREventHandler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  // Helper: fire an event
  _fire(event: string, detail?: Partial<ProgressEvent>) {
    const handlers = this.listeners[event] || [];
    for (const h of handlers) {
      h?.(detail as ProgressEvent);
    }
  }

  _fireUpload(event: string, detail?: Partial<ProgressEvent>) {
    const handlers = this.upload.listeners[event] || [];
    for (const h of handlers) {
      h?.(detail as ProgressEvent);
    }
  }
}

beforeEach(() => {
  // @ts-expect-error — mock
  global.XMLHttpRequest = jest.fn(() => new MockXHR()) as unknown;
  // Set a CSRF cookie
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "XSRF-TOKEN=test-csrf-token",
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("uploadFileWithProgress", () => {
  const testFile = new File(["hello"], "test.txt", { type: "text/plain" });
  const testToken = "jwt-token-123";

  it("calls onProgress with percentage during upload", () => {
    const onProgress = jest.fn();
    uploadFileWithProgress(testFile, testToken, onProgress);

    const xhr = MockXHR.lastInstance;
    xhr._fireUpload("progress", { lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);

    expect(onProgress).toHaveBeenCalledWith(50);

    xhr._fireUpload("progress", { lengthComputable: true, loaded: 100, total: 100 } as ProgressEvent);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("resolves with url and fileId on successful upload", async () => {
    const onProgress = jest.fn();
    const promise = uploadFileWithProgress(testFile, testToken, onProgress);

    const xhr = MockXHR.lastInstance;
    xhr.status = 200;
    xhr.responseText = JSON.stringify({
      data: { storageUrl: "https://cdn.example.com/file.txt", _id: "file-123" },
    });
    xhr._fire("load");

    const result = await promise;
    expect(result.url).toBe("https://cdn.example.com/file.txt");
    expect(result.fileId).toBe("file-123");
  });

  it("rejects on HTTP error status", async () => {
    const onProgress = jest.fn();
    const promise = uploadFileWithProgress(testFile, testToken, onProgress);

    const xhr = MockXHR.lastInstance;
    xhr.status = 500;
    xhr._fire("load");

    await expect(promise).rejects.toThrow("Upload failed with status 500");
  });

  it("rejects on network error", async () => {
    const onProgress = jest.fn();
    const promise = uploadFileWithProgress(testFile, testToken, onProgress);

    const xhr = MockXHR.lastInstance;
    xhr._fire("error");

    await expect(promise).rejects.toThrow("Upload network error");
  });

  it("aborts on signal abort", async () => {
    const controller = new AbortController();
    const onProgress = jest.fn();
    const promise = uploadFileWithProgress(testFile, testToken, onProgress, controller.signal);

    controller.abort();

    // The abort handler fires xhr.abort() and rejects with AbortError
    const xhr = MockXHR.lastInstance;
    expect(xhr.abort).toHaveBeenCalled();

    await expect(promise).rejects.toThrow("Upload cancelled");
  });

  it("includes Authorization header with Bearer token", () => {
    const onProgress = jest.fn();
    uploadFileWithProgress(testFile, testToken, onProgress);

    const xhr = MockXHR.lastInstance;
    expect(xhr.headers["Authorization"]).toBe("Bearer jwt-token-123");
  });

  it("includes CSRF token header from cookie", () => {
    const onProgress = jest.fn();
    uploadFileWithProgress(testFile, testToken, onProgress);

    const xhr = MockXHR.lastInstance;
    expect(xhr.headers["X-XSRF-TOKEN"]).toBe("test-csrf-token");
  });

  it("appends file to FormData", () => {
    const onProgress = jest.fn();
    uploadFileWithProgress(testFile, testToken, onProgress);

    const xhr = MockXHR.lastInstance;
    expect(xhr.body).toBeInstanceOf(FormData);
    // FormData.get is available in jsdom
    expect((xhr.body as FormData).get("file")).toBe(testFile);
  });

  it("appends conversationId to FormData when provided", () => {
    const onProgress = jest.fn();
    uploadFileWithProgress(testFile, testToken, onProgress, undefined, "conv-456");

    const xhr = MockXHR.lastInstance;
    expect((xhr.body as FormData).get("conversationId")).toBe("conv-456");
  });

  it("sets withCredentials to true", () => {
    const onProgress = jest.fn();
    uploadFileWithProgress(testFile, testToken, onProgress);

    const xhr = MockXHR.lastInstance;
    expect(xhr.withCredentials).toBe(true);
  });
});
