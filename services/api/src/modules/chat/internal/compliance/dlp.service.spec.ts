import { DlpService } from './dlp.service';

describe('DlpService', () => {
  let service: DlpService;
  let mockRuleModel: any;

  beforeEach(() => {
    mockRuleModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ catch: jest.fn() }),
    };
    service = new DlpService(mockRuleModel);
  });

  describe('checkMessage', () => {
    it('should allow short messages without checking rules', async () => {
      const result = await service.checkMessage('org1', 'Hi');
      expect(result.allowed).toBe(true);
    });

    it('should allow messages when no rules exist', async () => {
      mockRuleModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      const result = await service.checkMessage('org1', 'This is a normal message');
      expect(result.allowed).toBe(true);
    });

    it('should block message matching a block rule', async () => {
      mockRuleModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{
          _id: 'rule1',
          name: 'Credit Card',
          pattern: '\\b\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}\\b',
          action: 'block',
          message: 'Credit card numbers are not allowed',
        }]),
      });

      const result = await service.checkMessage('org1', 'My card is 4111-1111-1111-1111');
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('block');
      expect(result.rule).toBe('Credit Card');
    });

    it('should flag message matching a flag rule', async () => {
      mockRuleModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{
          _id: 'rule2',
          name: 'PAN Number',
          pattern: '\\b[A-Z]{5}\\d{4}[A-Z]\\b',
          action: 'flag',
        }]),
      });

      const result = await service.checkMessage('org1', 'My PAN is ABCDE1234F');
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('flag');
    });

    it('should redact matching content', async () => {
      mockRuleModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{
          _id: 'rule3',
          name: 'SSN',
          pattern: '\\d{3}-\\d{2}-\\d{4}',
          action: 'redact',
        }]),
      });

      const result = await service.checkMessage('org1', 'SSN is 123-45-6789');
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('redact');
      expect(result.redactedContent).toBe('SSN is ****');
    });

    it('should warn on matching warn rule', async () => {
      mockRuleModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{
          _id: 'rule4',
          name: 'Phone Bulk',
          pattern: '(?:\\d{10}.*){3,}',
          action: 'warn',
          message: 'Multiple phone numbers detected',
        }]),
      });

      const result = await service.checkMessage('org1', '1234567890 0987654321 1111111111');
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('warn');
    });

    it('should handle invalid regex gracefully', async () => {
      mockRuleModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{
          _id: 'rule5',
          name: 'Bad Regex',
          pattern: '[invalid(',
          action: 'block',
        }]),
      });

      const result = await service.checkMessage('org1', 'Normal message');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getBuiltinPatterns', () => {
    it('should return built-in patterns', async () => {
      const patterns = await service.getBuiltinPatterns();
      expect(patterns).toHaveProperty('credit_card');
      expect(patterns).toHaveProperty('aadhaar');
      expect(patterns).toHaveProperty('pan');
      expect(patterns).toHaveProperty('ssn');
    });
  });
});
