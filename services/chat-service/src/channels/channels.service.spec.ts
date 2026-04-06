import { ChannelsService } from './channels.service';
import { NotFoundException } from '@nestjs/common';

describe('ChannelsService', () => {
  let service: ChannelsService;
  let mockConversationModel: any;
  let mockCategoryModel: any;

  beforeEach(() => {
    mockConversationModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateMany: jest.fn(),
    };
    mockCategoryModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    service = new ChannelsService(mockConversationModel, mockCategoryModel);
  });

  describe('browsePublicChannels', () => {
    it('should find public and announcement channels for the org', async () => {
      const mockChannels = [{ _id: 'ch1', name: 'general', channelType: 'public' }];
      mockConversationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockChannels) }),
      });

      const result = await service.browsePublicChannels('org1', 'user1');
      expect(result).toEqual(mockChannels);
      expect(mockConversationModel.find).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: 'org1',
        type: 'channel',
        channelType: { $in: ['public', 'announcement'] },
      }));
    });
  });

  describe('joinChannel', () => {
    it('should add user to public channel', async () => {
      const mockChannel = {
        _id: 'ch1', type: 'channel', channelType: 'public', isDeleted: false,
        participants: [{ userId: 'owner1', role: 'owner' }],
      };
      mockConversationModel.findOne.mockResolvedValue(mockChannel);
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({ ...mockChannel, participants: [...mockChannel.participants, { userId: 'user1' }] });

      const result = await service.joinChannel('ch1', 'user1');
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should return existing channel if already a member', async () => {
      const mockChannel = {
        _id: 'ch1', type: 'channel', channelType: 'public', isDeleted: false,
        participants: [{ userId: 'user1', role: 'member' }],
      };
      mockConversationModel.findOne.mockResolvedValue(mockChannel);

      const result = await service.joinChannel('ch1', 'user1');
      expect(result).toEqual(mockChannel);
      expect(mockConversationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw if channel not found', async () => {
      mockConversationModel.findOne.mockResolvedValue(null);
      await expect(service.joinChannel('ch1', 'user1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('category CRUD', () => {
    it('should list categories sorted by order', async () => {
      const mockCategories = [{ _id: 'cat1', name: 'Engineering', order: 0 }];
      mockCategoryModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockCategories) }),
      });

      const result = await service.listCategories('org1');
      expect(result).toEqual(mockCategories);
    });

    it('should delete category and unlink channels', async () => {
      mockCategoryModel.findByIdAndDelete.mockResolvedValue({ _id: 'cat1' });
      mockConversationModel.updateMany.mockResolvedValue({});

      const result = await service.deleteCategory('cat1');
      expect(result).toEqual({ deleted: true });
      expect(mockConversationModel.updateMany).toHaveBeenCalledWith(
        { categoryId: 'cat1' },
        { $set: { categoryId: null } },
      );
    });

    it('should throw if category not found on delete', async () => {
      mockCategoryModel.findByIdAndDelete.mockResolvedValue(null);
      await expect(service.deleteCategory('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
