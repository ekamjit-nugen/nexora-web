import { ResponseInterceptor } from '../response.interceptor';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  const createMockContext = (requestId?: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: requestId ? { 'x-request-id': requestId } : {},
      }),
      getResponse: () => ({}),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  });

  const createMockCallHandler = (data: any) => ({
    handle: () => of(data),
  });

  it('should wrap plain data in { success: true, data, meta }', async () => {
    const context = createMockContext('req-123');
    const handler = createMockCallHandler({ name: 'Test' });

    const result$ = interceptor.intercept(context as any, handler as any);
    const result = await lastValueFrom(result$);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Test' });
    expect(result.meta).toBeDefined();
    expect(result.meta.requestId).toBe('req-123');
  });

  it('should pass through response that already has success property', async () => {
    const context = createMockContext('req-456');
    const handler = createMockCallHandler({ success: true, data: { id: 1 } });

    const result$ = interceptor.intercept(context as any, handler as any);
    const result = await lastValueFrom(result$);

    // Should not double-wrap: no result.data.data
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1 });
    expect(result.meta).toBeDefined();
  });

  it('should add meta.timestamp and meta.requestId', async () => {
    const context = createMockContext('req-789');
    const handler = createMockCallHandler('hello');

    const result$ = interceptor.intercept(context as any, handler as any);
    const result = await lastValueFrom(result$);

    expect(result.meta.timestamp).toBeDefined();
    expect(typeof result.meta.timestamp).toBe('string');
    // Verify it's an ISO date string
    expect(new Date(result.meta.timestamp).toISOString()).toBe(result.meta.timestamp);
    expect(result.meta.requestId).toBe('req-789');
  });
});
