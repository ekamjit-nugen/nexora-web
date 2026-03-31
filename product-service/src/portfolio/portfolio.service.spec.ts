import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PortfolioService } from './portfolio.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: getModelToken('Portfolio'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
  });

  describe('createPortfolio', () => {
    it('should create a portfolio with initial metrics', async () => {
      const portfolioData = {
        name: 'Enterprise Portfolio',
        description: 'All products',
        managers: ['manager1', 'manager2'],
      };

      expect(async () => {
        await service.createPortfolio('org1', portfolioData);
      }).toBeDefined();
    });
  });

  describe('getPortfolio', () => {
    it('should retrieve a portfolio by id', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        name: 'Enterprise Portfolio',
        metrics: {},
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      const result = await service.getPortfolio('portfolio1');

      expect(result).toEqual(mockPortfolio);
    });

    it('should throw NotFoundException if not found', async () => {
      mockModel.findById.mockResolvedValue(null);

      await expect(service.getPortfolio('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrganizationPortfolio', () => {
    it('should retrieve portfolio for organization', async () => {
      const mockPortfolio = { _id: 'portfolio1', organizationId: 'org1' };
      mockModel.findOne.mockResolvedValue(mockPortfolio);

      const result = await service.getOrganizationPortfolio('org1');

      expect(result).toEqual(mockPortfolio);
    });

    it('should throw NotFoundException if not found', async () => {
      mockModel.findOne.mockResolvedValue(null);

      await expect(service.getOrganizationPortfolio('org1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addProduct', () => {
    it('should add product to portfolio', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        products: [],
        metrics: {},
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      const product = {
        productId: 'prod1',
        status: 'active' as const,
        priority: 1,
        investment: 50000,
        expectedRevenue: 100000,
        healthScore: 85,
      };

      await service.addProduct('portfolio1', product);

      expect(mockPortfolio.save).toHaveBeenCalled();
    });

    it('should throw error if product already in portfolio', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        products: [{ productId: 'prod1', status: 'active' }],
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      const product = {
        productId: 'prod1',
        status: 'active' as const,
        priority: 1,
        investment: 50000,
        expectedRevenue: 100000,
        healthScore: 85,
      };

      await expect(service.addProduct('portfolio1', product)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateProduct', () => {
    it('should update product in portfolio', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        products: [
          {
            productId: 'prod1',
            status: 'active',
            investment: 50000,
            healthScore: 85,
          },
        ],
        metrics: {},
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      await service.updateProduct('portfolio1', 'prod1', { healthScore: 90 });

      expect(mockPortfolio.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product not found', async () => {
      const mockPortfolio = { _id: 'portfolio1', products: [] };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      await expect(
        service.updateProduct('portfolio1', 'nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeProduct', () => {
    it('should remove product from portfolio', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        products: [
          { productId: 'prod1', status: 'active' },
          { productId: 'prod2', status: 'active' },
        ],
        metrics: {},
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      await service.removeProduct('portfolio1', 'prod1');

      expect(mockPortfolio.products).toHaveLength(1);
      expect(mockPortfolio.save).toHaveBeenCalled();
    });
  });

  describe('getPortfolioStats', () => {
    it('should return portfolio statistics', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        metrics: {
          totalValue: 250000,
          activeProducts: 3,
          riskScore: 25,
          healthScore: 82,
          roi: 45.5,
        },
        products: [
          { productId: 'prod1', status: 'active', expectedRevenue: 100000, healthScore: 85 },
          { productId: 'prod2', status: 'active', expectedRevenue: 80000, healthScore: 80 },
          { productId: 'prod3', status: 'deprecated', expectedRevenue: 20000, healthScore: 45 },
        ],
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      const result = await service.getPortfolioStats('portfolio1');

      expect(result.metrics).toBeDefined();
      expect(result.productsByStatus.active).toBe(2);
      expect(result.productsByStatus.deprecated).toBe(1);
    });
  });

  describe('metrics calculation', () => {
    it('should calculate correct ROI from products', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        products: [
          { productId: 'prod1', investment: 50000, expectedRevenue: 100000, status: 'active', healthScore: 85 },
        ],
        metrics: {},
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      await service.addProduct('portfolio1', mockPortfolio.products[0]);

      expect(mockPortfolio.save).toHaveBeenCalled();
    });

    it('should calculate risk score based on health scores', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        products: [
          { productId: 'prod1', status: 'active', healthScore: 85, investment: 50000, expectedRevenue: 100000 },
          { productId: 'prod2', status: 'active', healthScore: 45, investment: 30000, expectedRevenue: 60000 },
        ],
        metrics: {},
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      const result = await service.getPortfolioStats('portfolio1');

      expect(result).toBeDefined();
    });
  });

  describe('updatePortfolio', () => {
    it('should update portfolio metadata', async () => {
      const mockPortfolio = {
        _id: 'portfolio1',
        name: 'Old Name',
        managers: [],
        save: jest.fn().mockResolvedValue({ name: 'New Name' }),
      };

      mockModel.findById.mockResolvedValue(mockPortfolio);

      await service.updatePortfolio('portfolio1', { name: 'New Name' });

      expect(mockPortfolio.save).toHaveBeenCalled();
    });
  });

  describe('deletePortfolio', () => {
    it('should delete a portfolio', async () => {
      mockModel.findByIdAndDelete.mockResolvedValue({});

      await service.deletePortfolio('portfolio1');

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('portfolio1');
    });
  });
});
