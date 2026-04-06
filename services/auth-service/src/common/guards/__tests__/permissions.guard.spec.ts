import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockContext = (userPermissions: string[] = []) => ({
    switchToHttp: () => ({
      getRequest: () => ({ user: { permissions: userPermissions } }),
      getResponse: () => ({}),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  });

  it('should return true when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext();
    expect(guard.canActivate(context as any)).toBe(true);
  });

  it('should return true when user has required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['read:users']);

    const context = createMockContext(['read:users', 'write:users']);
    expect(guard.canActivate(context as any)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin:delete']);

    const context = createMockContext(['read:users']);
    expect(() => guard.canActivate(context as any)).toThrow(ForbiddenException);
  });

  it('should return true when user has all of multiple required permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['read:users', 'write:users']);

    const context = createMockContext(['read:users', 'write:users', 'admin:settings']);
    expect(guard.canActivate(context as any)).toBe(true);
  });

  it('should throw when user has some but not all required permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['read:users', 'admin:delete']);

    const context = createMockContext(['read:users']);
    expect(() => guard.canActivate(context as any)).toThrow(ForbiddenException);
  });
});
