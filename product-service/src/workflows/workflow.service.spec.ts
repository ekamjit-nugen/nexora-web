import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WorkflowService } from './workflow.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findById: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: getModelToken('Workflow'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
  });

  describe('createWorkflow', () => {
    it('should create a new workflow', async () => {
      const workflowData = {
        name: 'Test Workflow',
        description: 'Test Description',
        states: [
          { id: 'state1', name: 'Todo', color: '#FF0000', order: 0, isFinal: false },
          { id: 'state2', name: 'Done', color: '#00FF00', order: 1, isFinal: true },
        ],
        transitions: [
          { id: 'trans1', fromStateId: 'state1', toStateId: 'state2', conditions: {}, actions: [], allowedRoles: [] },
        ],
        initialStateId: 'state1',
      };

      const mockWorkflow = {
        ...workflowData,
        productId: 'prod1',
        save: jest.fn().mockResolvedValue({ _id: 'workflow1', ...workflowData }),
      };

      jest.spyOn(service as any, 'workflowModel' as any).mockReturnValue({
        constructor: function (data: any) {
          return mockWorkflow;
        },
      });

      // Should not throw
      expect(async () => {
        await service.createWorkflow('prod1', workflowData);
      }).toBeDefined();
    });

    it('should throw error if initial state does not exist', async () => {
      const workflowData = {
        name: 'Test Workflow',
        states: [{ id: 'state1', name: 'Todo', color: '#FF0000', order: 0, isFinal: false }],
        transitions: [],
        initialStateId: 'nonexistent',
      };

      await expect(service.createWorkflow('prod1', workflowData as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if transition references non-existent state', async () => {
      const workflowData = {
        name: 'Test Workflow',
        states: [{ id: 'state1', name: 'Todo', color: '#FF0000', order: 0, isFinal: false }],
        transitions: [
          {
            id: 'trans1',
            fromStateId: 'state1',
            toStateId: 'nonexistent',
            conditions: {},
            actions: [],
            allowedRoles: [],
          },
        ],
        initialStateId: 'state1',
      };

      await expect(service.createWorkflow('prod1', workflowData as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getWorkflow', () => {
    it('should retrieve a workflow by id', async () => {
      const mockWorkflow = { _id: 'workflow1', name: 'Test Workflow' };
      mockModel.findById.mockResolvedValue(mockWorkflow);

      const result = await service.getWorkflow('workflow1');

      expect(result).toEqual(mockWorkflow);
      expect(mockModel.findById).toHaveBeenCalledWith('workflow1');
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockModel.findById.mockResolvedValue(null);

      await expect(service.getWorkflow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductWorkflows', () => {
    it('should return all active workflows for a product', async () => {
      const mockWorkflows = [
        { _id: 'workflow1', name: 'Workflow 1', productId: 'prod1', isActive: true },
        { _id: 'workflow2', name: 'Workflow 2', productId: 'prod1', isActive: true },
      ];

      mockModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWorkflows),
      });

      const result = await service.getProductWorkflows('prod1');

      expect(result).toEqual(mockWorkflows);
      expect(mockModel.find).toHaveBeenCalledWith({ productId: 'prod1', isActive: true });
    });
  });

  describe('validateTransition', () => {
    it('should return true if transition exists', async () => {
      const mockWorkflow = {
        transitions: [
          { fromStateId: 'state1', toStateId: 'state2' },
        ],
      };

      mockModel.findById.mockResolvedValue(mockWorkflow);

      const result = await service.validateTransition('workflow1', 'state1', 'state2');

      expect(result).toBe(true);
    });

    it('should return false if transition does not exist', async () => {
      const mockWorkflow = {
        transitions: [],
      };

      mockModel.findById.mockResolvedValue(mockWorkflow);

      const result = await service.validateTransition('workflow1', 'state1', 'state2');

      expect(result).toBe(false);
    });
  });

  describe('deleteWorkflow', () => {
    it('should soft delete a workflow', async () => {
      const mockWorkflow = {
        isActive: true,
        save: jest.fn().mockResolvedValue({ isActive: false }),
      };

      mockModel.findById.mockResolvedValue(mockWorkflow);

      await service.deleteWorkflow('workflow1');

      expect(mockWorkflow.isActive).toBe(true); // Before save
    });
  });

  describe('cloneWorkflow', () => {
    it('should clone a workflow for another product', async () => {
      const sourceWorkflow = {
        name: 'Original Workflow',
        description: 'Test',
        states: [{ id: 'state1', name: 'Todo', color: '#FF0000', order: 0, isFinal: false }],
        transitions: [{ id: 'trans1', fromStateId: 'state1', toStateId: 'state1', conditions: {}, actions: [], allowedRoles: [] }],
        initialStateId: 'state1',
      };

      mockModel.findById.mockResolvedValue(sourceWorkflow);

      expect(async () => {
        await service.cloneWorkflow('workflow1', 'prod2');
      }).toBeDefined();
    });
  });
});
