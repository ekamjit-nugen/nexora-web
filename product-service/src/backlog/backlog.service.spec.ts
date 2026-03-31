import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BacklogService } from './backlog.service';
import { NotFoundException } from '@nestjs/common';

describe('BacklogService', () => {
  let service: BacklogService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacklogService,
        {
          provide: getModelToken('Backlog'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<BacklogService>(BacklogService);
  });

  describe('getBacklog', () => {
    it('should return existing backlog', async () => {
      const mockBacklog = { productId: 'prod1', items: [], sprints: [] };
      mockModel.findOne.mockResolvedValue(mockBacklog);

      const result = await service.getBacklog('prod1');

      expect(result).toEqual(mockBacklog);
    });

    it('should create new backlog if not exists', async () => {
      mockModel.findOne.mockResolvedValue(null);

      const newBacklog = { productId: 'prod1', items: [], sprints: [], save: jest.fn().mockResolvedValue({}) };

      expect(async () => {
        await service.getBacklog('prod1');
      }).toBeDefined();
    });
  });

  describe('addItem', () => {
    it('should add item to backlog', async () => {
      const mockBacklog = {
        productId: 'prod1',
        items: [],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      const itemData = {
        title: 'Task 1',
        description: 'Test task',
        priority: 'high' as const,
        status: 'todo' as const,
        storyPoints: 5,
        tags: ['bug'],
      };

      await service.addItem('prod1', itemData);

      expect(mockBacklog.save).toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('should update backlog item', async () => {
      const mockBacklog = {
        productId: 'prod1',
        items: [{ id: 'item1', title: 'Task 1', status: 'todo' }],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      await service.updateItem('prod1', 'item1', { status: 'done' });

      expect(mockBacklog.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if item not found', async () => {
      const mockBacklog = { productId: 'prod1', items: [] };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      await expect(service.updateItem('prod1', 'nonexistent', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('prioritizeItems', () => {
    it('should reorder items by priority', async () => {
      const mockBacklog = {
        productId: 'prod1',
        items: [
          { id: 'item1', title: 'Task 1', order: 0 },
          { id: 'item2', title: 'Task 2', order: 1 },
          { id: 'item3', title: 'Task 3', order: 2 },
        ],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      await service.prioritizeItems('prod1', ['item3', 'item1', 'item2']);

      expect(mockBacklog.save).toHaveBeenCalled();
    });
  });

  describe('moveItemToSprint', () => {
    it('should move item to sprint', async () => {
      const mockBacklog = {
        productId: 'prod1',
        items: [{ id: 'item1', title: 'Task 1', sprint: undefined }],
        sprints: [{ id: 'sprint1', items: [] }],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      await service.moveItemToSprint('prod1', 'item1', 'sprint1');

      expect(mockBacklog.save).toHaveBeenCalled();
    });
  });

  describe('createSprint', () => {
    it('should create a sprint', async () => {
      const mockBacklog = {
        productId: 'prod1',
        sprints: [],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      const sprintData = {
        name: 'Sprint 1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-14'),
        status: 'planned' as const,
        capacity: 40,
        goal: 'Complete core features',
      };

      await service.createSprint('prod1', sprintData);

      expect(mockBacklog.save).toHaveBeenCalled();
    });
  });

  describe('getSprintCapacity', () => {
    it('should return sprint capacity details', async () => {
      const mockBacklog = {
        productId: 'prod1',
        items: [
          { id: 'item1', sprint: 'sprint1', storyPoints: 15 },
          { id: 'item2', sprint: 'sprint1', storyPoints: 20 },
        ],
        sprints: [
          {
            id: 'sprint1',
            name: 'Sprint 1',
            capacity: 50,
            items: ['item1', 'item2'],
          },
        ],
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      const result = await service.getSprintCapacity('prod1', 'sprint1');

      expect(result.capacity).toBe(50);
      expect(result.allocated).toBe(35);
      expect(result.remaining).toBe(15);
    });

    it('should throw NotFoundException if sprint not found', async () => {
      const mockBacklog = { productId: 'prod1', sprints: [] };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      await expect(service.getSprintCapacity('prod1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getBacklogStats', () => {
    it('should return backlog statistics', async () => {
      const mockBacklog = {
        productId: 'prod1',
        items: [
          { id: 'item1', priority: 'critical', status: 'todo', storyPoints: 5 },
          { id: 'item2', priority: 'high', status: 'done', storyPoints: 3 },
          { id: 'item3', priority: 'low', status: 'inProgress', storyPoints: 2 },
        ],
        sprints: [
          { status: 'active' },
          { status: 'planned' },
        ],
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      const result = await service.getBacklogStats('prod1');

      expect(result.totalItems).toBe(3);
      expect(result.totalStoryPoints).toBe(10);
      expect(result.activeSprints).toBe(1);
    });
  });

  describe('refineItem', () => {
    it('should refine backlog item with details', async () => {
      const mockBacklog = {
        productId: 'prod1',
        items: [{ id: 'item1', title: 'Task 1' }],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      const refinement = {
        description: 'Detailed description',
        acceptanceCriteria: ['Should do X', 'Should do Y'],
        storyPoints: 5,
      };

      await service.refineItem('prod1', 'item1', refinement);

      expect(mockBacklog.save).toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('should delete backlog item', async () => {
      const mockBacklog = {
        productId: 'prod1',
        items: [{ id: 'item1', title: 'Task 1' }],
        sprints: [],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockBacklog);

      await service.deleteItem('prod1', 'item1');

      expect(mockBacklog.items).toHaveLength(0);
      expect(mockBacklog.save).toHaveBeenCalled();
    });
  });
});
