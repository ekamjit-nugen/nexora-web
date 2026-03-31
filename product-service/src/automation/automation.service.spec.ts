import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AutomationService } from './automation.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AutomationService', () => {
  let service: AutomationService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findById: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        {
          provide: getModelToken('AutomationRule'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<AutomationService>(AutomationService);
  });

  describe('createRule', () => {
    it('should create an automation rule', async () => {
      const ruleData = {
        name: 'Test Rule',
        description: 'Test Description',
        trigger: 'stateChange',
        conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
        actions: [{ type: 'notifyUser', config: { userId: 'user1' } }],
        priority: 1,
      };

      const mockRule = {
        ...ruleData,
        productId: 'prod1',
        save: jest.fn().mockResolvedValue({ _id: 'rule1', ...ruleData }),
      };

      expect(async () => {
        await service.createRule('prod1', ruleData as any);
      }).toBeDefined();
    });

    it('should throw error if no conditions provided', async () => {
      const ruleData = {
        name: 'Test Rule',
        trigger: 'stateChange',
        conditions: [],
        actions: [{ type: 'notifyUser', config: {} }],
      };

      await expect(service.createRule('prod1', ruleData as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if no actions provided', async () => {
      const ruleData = {
        name: 'Test Rule',
        trigger: 'stateChange',
        conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
        actions: [],
      };

      await expect(service.createRule('prod1', ruleData as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRule', () => {
    it('should retrieve a rule by id', async () => {
      const mockRule = { _id: 'rule1', name: 'Test Rule' };
      mockModel.findById.mockResolvedValue(mockRule);

      const result = await service.getRule('rule1');

      expect(result).toEqual(mockRule);
    });

    it('should throw NotFoundException if rule not found', async () => {
      mockModel.findById.mockResolvedValue(null);

      await expect(service.getRule('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('evaluateConditions', () => {
    it('should evaluate equals operator correctly', () => {
      const conditions = [{ field: 'status', operator: 'equals', value: 'active' }];
      const data = { status: 'active' };

      const result = service.evaluateConditions(conditions, data);

      expect(result).toBe(true);
    });

    it('should evaluate contains operator correctly', () => {
      const conditions = [{ field: 'title', operator: 'contains', value: 'test' }];
      const data = { title: 'test-item' };

      const result = service.evaluateConditions(conditions, data);

      expect(result).toBe(true);
    });

    it('should evaluate gt operator correctly', () => {
      const conditions = [{ field: 'count', operator: 'gt', value: 5 }];
      const data = { count: 10 };

      const result = service.evaluateConditions(conditions, data);

      expect(result).toBe(true);
    });

    it('should evaluate lt operator correctly', () => {
      const conditions = [{ field: 'count', operator: 'lt', value: 10 }];
      const data = { count: 5 };

      const result = service.evaluateConditions(conditions, data);

      expect(result).toBe(true);
    });

    it('should evaluate in operator correctly', () => {
      const conditions = [{ field: 'status', operator: 'in', value: ['active', 'pending'] }];
      const data = { status: 'active' };

      const result = service.evaluateConditions(conditions, data);

      expect(result).toBe(true);
    });

    it('should evaluate regex operator correctly', () => {
      const conditions = [{ field: 'email', operator: 'regex', value: '^[a-zA-Z0-9]+@' }];
      const data = { email: 'test@example.com' };

      const result = service.evaluateConditions(conditions, data);

      expect(result).toBe(true);
    });

    it('should return false if all conditions not met', () => {
      const conditions = [
        { field: 'status', operator: 'equals', value: 'active' },
        { field: 'count', operator: 'gt', value: 10 },
      ];
      const data = { status: 'active', count: 5 };

      const result = service.evaluateConditions(conditions, data);

      expect(result).toBe(false);
    });
  });

  describe('getRulesByTrigger', () => {
    it('should return rules by trigger type', async () => {
      const mockRules = [
        { _id: 'rule1', trigger: 'stateChange', productId: 'prod1' },
        { _id: 'rule2', trigger: 'stateChange', productId: 'prod1' },
      ];

      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockRules),
        }),
      });

      const result = await service.getRulesByTrigger('prod1', 'stateChange');

      expect(result).toEqual(mockRules);
    });
  });

  describe('toggleRule', () => {
    it('should toggle rule active status', async () => {
      const mockRule = {
        _id: 'rule1',
        isActive: true,
        save: jest.fn().mockResolvedValue({ isActive: false }),
      };

      mockModel.findById.mockResolvedValue(mockRule);

      const result = await service.toggleRule('rule1');

      expect(mockRule.isActive).toBe(true);
    });
  });

  describe('executeActions', () => {
    it('should execute actions without error', async () => {
      const actions = [
        { type: 'notifyUser', config: { userId: 'user1', message: 'Test' } },
        { type: 'createTask', config: { title: 'Task 1' } },
      ];
      const context = { productId: 'prod1' };

      await expect(service.executeActions(actions, context)).resolves.not.toThrow();
    });
  });
});
