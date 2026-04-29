import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the supabase client BEFORE importing the hook.
const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: any[]) => invokeMock(...args) } },
}));

import { useMatchOptions } from '@/components/flows/useMatchOptions';
import { formatDepartureDate } from '@/lib/departureTime';

describe('useMatchOptions — next_departure_date propagation', () => {
  beforeEach(() => invokeMock.mockReset());

  it('propagates next_departure_date from the edge function to consumers', async () => {
    invokeMock.mockResolvedValue({
      data: {
        options: [],
        next_departure_in_days: 3,
        next_departure_date: '2026-06-15',
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useMatchOptions({
        origin_city: 'Paris',
        destination_city: 'Dakar',
        weight_kg: 5,
      }),
    );

    // Wait for debounce (350ms) + microtasks.
    for (let i = 0; i < 30 && result.current.next_departure_date == null; i++) {
      await act(() => new Promise(r => setTimeout(r, 50)));
    }
    expect(result.current.next_departure_date).toBe('2026-06-15');
    expect(result.current.next_departure_in_days).toBe(3);

    // And it formats correctly through the shared helper used by both flows.
    const label = formatDepartureDate(result.current.next_departure_date);
    expect(label.toLowerCase()).toContain('15');
    expect(label.toLowerCase()).toContain('juin');
  });
});
