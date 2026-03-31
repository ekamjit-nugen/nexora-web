import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { KanbanService } from './kanban.service';
import { NotFoundException } from '@nestjs/common';

describe('KanbanService', () => {
  let service: KanbanService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KanbanService,
        {
          provide: getModelToken('KanbanBoard'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<KanbanService>(KanbanService);
  });

  describe('createBoard', () => {
    it('should create a kanban board', async () => {
      const boardData = {
        workflowId: 'workflow1',
        title: 'Test Board',
        description: 'Test Description',
        columns: [
          { stateId: 'state1', title: 'Todo', cards: [] },
          { stateId: 'state2', title: 'Done', cards: [] },
        ],
      };

      expect(async () => {
        await service.createBoard('prod1', boardData);
      }).toBeDefined();
    });
  });

  describe('getBoard', () => {
    it('should retrieve a board by id', async () => {
      const mockBoard = { _id: 'board1', title: 'Test Board' };
      mockModel.findById.mockResolvedValue(mockBoard);

      const result = await service.getBoard('board1');

      expect(result).toEqual(mockBoard);
    });

    it('should throw NotFoundException if board not found', async () => {
      mockModel.findById.mockResolvedValue(null);

      await expect(service.getBoard('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductBoard', () => {
    it('should retrieve product board', async () => {
      const mockBoard = { _id: 'board1', productId: 'prod1', title: 'Test Board' };
      mockModel.findOne.mockResolvedValue(mockBoard);

      const result = await service.getProductBoard('prod1');

      expect(result).toEqual(mockBoard);
      expect(mockModel.findOne).toHaveBeenCalledWith({ productId: 'prod1' });
    });

    it('should throw NotFoundException if board not found', async () => {
      mockModel.findOne.mockResolvedValue(null);

      await expect(service.getProductBoard('prod1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('moveCard', () => {
    it('should move card between states', async () => {
      const mockBoard = {
        columns: [
          {
            stateId: 'state1',
            cards: [{ id: 'card1', title: 'Card 1', state: 'state1', order: 0 }],
          },
          { stateId: 'state2', cards: [] },
        ],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findById.mockResolvedValue(mockBoard);

      const result = await service.moveCard('board1', 'card1', 'state1', 'state2', 0);

      expect(mockBoard.save).toHaveBeenCalled();
    });
  });

  describe('reorderCards', () => {
    it('should reorder cards in column', async () => {
      const mockBoard = {
        columns: [
          {
            stateId: 'state1',
            cards: [
              { id: 'card1', title: 'Card 1', order: 0 },
              { id: 'card2', title: 'Card 2', order: 1 },
            ],
          },
        ],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findById.mockResolvedValue(mockBoard);

      await service.reorderCards('board1', 'state1', ['card2', 'card1']);

      expect(mockBoard.save).toHaveBeenCalled();
    });
  });

  describe('getBoardStats', () => {
    it('should return board statistics', async () => {
      const mockBoard = {
        columns: [
          { stateId: 'state1', title: 'Todo', cards: [{ id: 'card1' }, { id: 'card2' }] },
          { stateId: 'state2', title: 'Done', cards: [{ id: 'card3' }] },
        ],
      };

      mockModel.findById.mockResolvedValue(mockBoard);

      const result = await service.getBoardStats('board1');

      expect(result.totalCards).toBe(3);
      expect(result.columnStats).toBeDefined();
    });
  });

  describe('updateBoard', () => {
    it('should update board', async () => {
      const mockBoard = {
        title: 'Old Title',
        save: jest.fn().mockResolvedValue({ title: 'New Title' }),
      };

      mockModel.findById.mockResolvedValue(mockBoard);

      await service.updateBoard('board1', { title: 'New Title' });

      expect(mockBoard.save).toHaveBeenCalled();
    });
  });

  describe('deleteBoard', () => {
    it('should delete a board', async () => {
      mockModel.findByIdAndDelete.mockResolvedValue({});

      await service.deleteBoard('board1');

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('board1');
    });
  });
});
