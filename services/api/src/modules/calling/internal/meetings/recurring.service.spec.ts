import { RecurringService } from './recurring.service';

describe('RecurringService', () => {
  let service: RecurringService;

  beforeEach(() => {
    service = new RecurringService({ findOne: jest.fn(), findOneAndUpdate: jest.fn() } as any);
  });

  describe('getNextOccurrences', () => {
    it('should generate daily occurrences', () => {
      const start = new Date('2026-04-01T10:00:00Z');
      const dates = service.getNextOccurrences(
        { frequency: 'daily', interval: 1, endType: 'never' } as any,
        start, 5,
      );
      expect(dates).toHaveLength(5);
      expect(dates[0].toISOString().slice(0, 10)).toBe('2026-04-02');
      expect(dates[4].toISOString().slice(0, 10)).toBe('2026-04-06');
    });

    it('should generate weekly occurrences with daysOfWeek', () => {
      const start = new Date('2026-04-01T10:00:00Z'); // Wednesday
      const dates = service.getNextOccurrences(
        { frequency: 'weekly', interval: 1, daysOfWeek: ['monday', 'wednesday', 'friday'], endType: 'never' } as any,
        start, 3,
      );
      expect(dates).toHaveLength(3);
    });

    it('should generate monthly occurrences', () => {
      const start = new Date('2026-01-15T10:00:00Z');
      const dates = service.getNextOccurrences(
        { frequency: 'monthly', interval: 1, dayOfMonth: 15, endType: 'never' } as any,
        start, 3,
      );
      expect(dates).toHaveLength(3);
      expect(dates[0].getMonth()).toBe(1); // Feb
      expect(dates[1].getMonth()).toBe(2); // Mar
    });

    it('should stop after endAfterOccurrences', () => {
      const start = new Date('2026-04-01T10:00:00Z');
      const dates = service.getNextOccurrences(
        { frequency: 'daily', interval: 1, endType: 'after', endAfterOccurrences: 3 } as any,
        start, 10,
      );
      expect(dates).toHaveLength(3);
    });

    it('should stop at endDate', () => {
      const start = new Date('2026-04-01T10:00:00Z');
      const dates = service.getNextOccurrences(
        { frequency: 'daily', interval: 1, endType: 'on_date', endDate: new Date('2026-04-04T00:00:00Z') } as any,
        start, 10,
      );
      expect(dates).toHaveLength(3);
    });

    it('should skip exception dates', () => {
      const start = new Date('2026-04-01T10:00:00Z');
      const dates = service.getNextOccurrences(
        {
          frequency: 'daily', interval: 1, endType: 'never',
          exceptions: [new Date('2026-04-03')],
        } as any,
        start, 5,
      );
      // April 3 should be skipped
      const dateStrings = dates.map(d => d.toISOString().slice(0, 10));
      expect(dateStrings).not.toContain('2026-04-03');
      expect(dates).toHaveLength(5);
    });

    it('should handle yearly frequency', () => {
      const start = new Date('2026-01-01T10:00:00Z');
      const dates = service.getNextOccurrences(
        { frequency: 'yearly', interval: 1, endType: 'never' } as any,
        start, 3,
      );
      expect(dates).toHaveLength(3);
      expect(dates[0].getFullYear()).toBe(2027);
      expect(dates[2].getFullYear()).toBe(2029);
    });
  });
});
