import { DeadlineExceededError, withDeadline } from '../with-deadline';

describe('withDeadline', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the work result when it finishes in time', async () => {
    await expect(withDeadline(async () => 'done', 1_000)).resolves.toBe('done');
  });

  it('passes the work rejection through untouched', async () => {
    const boom = new Error('boom');
    await expect(
      withDeadline(async () => {
        throw boom;
      }, 1_000),
    ).rejects.toBe(boom);
  });

  it('rejects with DeadlineExceededError and aborts the signal when work hangs', async () => {
    let seenSignal: AbortSignal | undefined;
    const pending = withDeadline((signal) => {
      seenSignal = signal;
      return new Promise<never>(() => undefined);
    }, 1_000);
    const assertion = expect(pending).rejects.toBeInstanceOf(DeadlineExceededError);

    await jest.advanceTimersByTimeAsync(1_000);

    await assertion;
    expect(seenSignal?.aborted).toBe(true);
  });

  it('clears its timer once the work settles', async () => {
    await withDeadline(async () => 'fast', 1_000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
