import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutosave } from './useAutosave'

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces: saves once after quiet period', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save, 1000))

    act(() => result.current.schedule('a'))
    act(() => result.current.schedule('ab'))
    act(() => result.current.schedule('abc'))
    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('pending')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith('abc')
  })

  it('reports error status when the save fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useAutosave(save, 500))
    act(() => result.current.schedule('x'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(result.current.status).toBe('error')
  })
})
