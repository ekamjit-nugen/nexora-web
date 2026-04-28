import { BadRequestException, NotFoundException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilterImpl } from '../http-exception.filter';

describe('HttpExceptionFilterImpl', () => {
  let filter: HttpExceptionFilterImpl;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new HttpExceptionFilterImpl();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      headers: { 'x-request-id': 'test-req-id' },
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should return 400 with BAD_REQUEST code for BadRequestException', () => {
    const exception = new BadRequestException('Invalid input');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'BAD_REQUEST',
        }),
        meta: expect.objectContaining({
          requestId: 'test-req-id',
        }),
      }),
    );
  });

  it('should return 404 with NOT_FOUND code for NotFoundException', () => {
    const exception = new NotFoundException('Resource not found');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      }),
    );
  });

  it('should return 500 with INTERNAL_ERROR for unknown errors', () => {
    const exception = new Error('Something broke');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        }),
      }),
    );
  });

  it('should format validation errors (array of messages) into fields', () => {
    // Simulate class-validator style validation error
    const exception = new BadRequestException({
      message: ['email must be an email', 'password must be longer than 8 characters'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields: {
            email: 'must be an email',
            password: 'must be longer than 8 characters',
          },
        }),
      }),
    );
  });
});
