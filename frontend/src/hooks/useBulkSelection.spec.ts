import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from './useBulkSelection';

describe('useBulkSelection', () => {
  const mockItems = [
    { _id: '1', name: 'Item 1' },
    { _id: '2', name: 'Item 2' },
    { _id: '3', name: 'Item 3' },
  ];

  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => useBulkSelection({ items: mockItems }));

    expect(result.current.count).toBe(0);
    expect(result.current.selected).toEqual([]);
  });

  it('should toggle item selection', () => {
    const { result } = renderHook(() => useBulkSelection({ items: mockItems }));

    act(() => {
      result.current.toggleItem('1');
    });

    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.count).toBe(1);
  });

  it('should deselect item when toggling again', () => {
    const { result } = renderHook(() => useBulkSelection({ items: mockItems }));

    act(() => {
      result.current.toggleItem('1');
      result.current.toggleItem('1');
    });

    expect(result.current.isSelected('1')).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it('should select all items', () => {
    const { result } = renderHook(() => useBulkSelection({ items: mockItems }));

    act(() => {
      result.current.toggleAll();
    });

    expect(result.current.isAllSelected()).toBe(true);
    expect(result.current.count).toBe(3);
  });

  it('should deselect all items when all are selected', () => {
    const { result } = renderHook(() => useBulkSelection({ items: mockItems }));

    act(() => {
      result.current.toggleAll();
      result.current.toggleAll();
    });

    expect(result.current.count).toBe(0);
  });

  it('should detect indeterminate state', () => {
    const { result } = renderHook(() => useBulkSelection({ items: mockItems }));

    act(() => {
      result.current.toggleItem('1');
    });

    expect(result.current.isIndeterminate()).toBe(true);
  });

  it('should clear selection', () => {
    const { result } = renderHook(() => useBulkSelection({ items: mockItems }));

    act(() => {
      result.current.toggleAll();
      result.current.clearSelection();
    });

    expect(result.current.count).toBe(0);
    expect(result.current.isSelected('1')).toBe(false);
  });

  it('should call selection change callback', () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useBulkSelection({ items: mockItems, onSelectionChange }),
    );

    act(() => {
      result.current.toggleItem('1');
    });

    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });

  it('should return all selected IDs', () => {
    const { result } = renderHook(() => useBulkSelection({ items: mockItems }));

    act(() => {
      result.current.toggleItem('1');
      result.current.toggleItem('3');
    });

    expect(result.current.selected).toEqual(expect.arrayContaining(['1', '3']));
    expect(result.current.selected.length).toBe(2);
  });
});
