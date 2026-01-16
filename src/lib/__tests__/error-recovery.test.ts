import {
  RetryManager,
  NetworkRecoveryManager,
  StatePreservationManager,
  getRecoveryStrategy,
  shouldRetryError,
  withAutoRetry,
} from '../error-recovery';

// Mock setTimeout for faster tests
jest.useFakeTimers();

describe('error-recovery', () => {
  describe('RetryManager', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllTimers();
    });

    describe('constructor', () => {
      it('should use default options', () => {
        const manager = new RetryManager();
        const state = manager.getState();
        expect(state.attempt).toBe(0);
        expect(state.isRetrying).toBe(false);
      });

      it('should accept custom options', () => {
        const manager = new RetryManager({ maxRetries: 5 });
        expect(manager).toBeDefined();
      });
    });

    describe('execute', () => {
      it('should succeed on first attempt', async () => {
        const manager = new RetryManager();
        const operation = jest.fn().mockResolvedValue('success');

        const resultPromise = manager.execute(operation);
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should retry on failure and succeed', async () => {
        const manager = new RetryManager({ maxRetries: 3, retryDelay: 100 });
        const operation = jest
          .fn()
          .mockRejectedValueOnce(new Error('First fail'))
          .mockResolvedValue('success');

        const onRetry = jest.fn();
        const onRecoverySuccess = jest.fn();

        const managerWithCallbacks = new RetryManager({
          maxRetries: 3,
          retryDelay: 100,
          onRetry,
          onRecoverySuccess,
        });

        const resultPromise = managerWithCallbacks.execute(operation);
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledWith(1);
        expect(onRetry).toHaveBeenCalledWith(2);
        expect(onRecoverySuccess).toHaveBeenCalled();
      });

      it('should throw after max retries', async () => {
        const error = new Error('Always fails');
        const operation = jest.fn().mockRejectedValue(error);
        const onMaxRetriesReached = jest.fn();
        const onRecoveryFailure = jest.fn();

        const managerWithCallbacks = new RetryManager({
          maxRetries: 2,
          retryDelay: 100,
          onMaxRetriesReached,
          onRecoveryFailure,
        });

        // Start the promise
        let caughtError: Error | undefined;
        const promise = managerWithCallbacks.execute(operation).catch((e) => {
          caughtError = e;
        });

        // Advance timers to allow all retries
        await jest.advanceTimersByTimeAsync(5000);
        await promise;

        expect(caughtError?.message).toBe('Always fails');
        expect(operation).toHaveBeenCalledTimes(2);
        expect(onMaxRetriesReached).toHaveBeenCalled();
        expect(onRecoveryFailure).toHaveBeenCalledWith(error);
      });

      it('should use exponential backoff when enabled', async () => {
        const manager = new RetryManager({
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true,
        });

        const operation = jest
          .fn()
          .mockRejectedValueOnce(new Error('First fail'))
          .mockRejectedValueOnce(new Error('Second fail'))
          .mockResolvedValue('success');

        const resultPromise = manager.execute(operation);
        await jest.runAllTimersAsync();
        await resultPromise;

        expect(operation).toHaveBeenCalledTimes(3);
      });

      it('should pass context to error logs', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const manager = new RetryManager({ maxRetries: 2, retryDelay: 100 });
        const operation = jest
          .fn()
          .mockRejectedValueOnce(new Error('fail'))
          .mockResolvedValue('success');

        const resultPromise = manager.execute(operation, 'test-context');
        await jest.runAllTimersAsync();
        await resultPromise;

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('test-context'),
          expect.any(Error)
        );
        consoleSpy.mockRestore();
      });
    });

    describe('reset', () => {
      it('should reset state', async () => {
        const manager = new RetryManager({ maxRetries: 3, retryDelay: 100 });
        const operation = jest
          .fn()
          .mockRejectedValueOnce(new Error('fail'))
          .mockResolvedValue('success');

        const resultPromise = manager.execute(operation);
        await jest.runAllTimersAsync();
        await resultPromise;

        expect(manager.getState().attempt).toBe(2);

        manager.reset();

        expect(manager.getState().attempt).toBe(0);
        expect(manager.getState().isRetrying).toBe(false);
      });
    });

    describe('getState', () => {
      it('should return current state', () => {
        const manager = new RetryManager();
        const state = manager.getState();

        expect(state).toEqual({
          attempt: 0,
          isRetrying: false,
        });
      });
    });
  });

  describe('NetworkRecoveryManager', () => {
    describe('isRecoverableError', () => {
      it('should return true for network errors', () => {
        const manager = new NetworkRecoveryManager();

        expect(manager.isRecoverableError(new Error('Network error'))).toBe(true);
        expect(manager.isRecoverableError(new Error('Connection timeout'))).toBe(true);
        expect(manager.isRecoverableError(new Error('fetch error'))).toBe(true);
        expect(manager.isRecoverableError(new Error('offline'))).toBe(true);
        expect(manager.isRecoverableError(new Error('connection refused'))).toBe(true);
      });

      it('should return true for transient HTTP status codes', () => {
        const manager = new NetworkRecoveryManager();

        expect(manager.isRecoverableError(new Error('408 Request Timeout'))).toBe(true);
        expect(manager.isRecoverableError(new Error('429 Too Many Requests'))).toBe(true);
        expect(manager.isRecoverableError(new Error('500 Internal Server Error'))).toBe(true);
        expect(manager.isRecoverableError(new Error('502 Bad Gateway'))).toBe(true);
        expect(manager.isRecoverableError(new Error('503 Service Unavailable'))).toBe(true);
        expect(manager.isRecoverableError(new Error('504 Gateway Timeout'))).toBe(true);
      });

      it('should return true for TypeError with fetch', () => {
        const manager = new NetworkRecoveryManager();
        const error = new TypeError('Failed to fetch');

        expect(manager.isRecoverableError(error)).toBe(true);
      });

      it('should return false for non-recoverable errors', () => {
        const manager = new NetworkRecoveryManager();

        expect(manager.isRecoverableError(new Error('Validation failed'))).toBe(false);
        expect(manager.isRecoverableError(new Error('Not found'))).toBe(false);
        expect(manager.isRecoverableError(new Error('Some random error'))).toBe(false);
      });
    });

    describe('executeNetworkOperation', () => {
      it('should succeed on first attempt', async () => {
        const manager = new NetworkRecoveryManager();
        const operation = jest.fn().mockResolvedValue('success');

        const resultPromise = manager.executeNetworkOperation(operation);
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toBe('success');
      });

      it('should retry network errors with extended delay', async () => {
        const manager = new NetworkRecoveryManager({ maxRetries: 2, retryDelay: 100 });
        const operation = jest
          .fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValue('success');

        const resultPromise = manager.executeNetworkOperation(operation);
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toBe('success');
      });
    });
  });

  describe('StatePreservationManager', () => {
    let stateManager: StatePreservationManager;

    beforeEach(() => {
      stateManager = StatePreservationManager.getInstance();
      stateManager.clearAllStates();
    });

    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = StatePreservationManager.getInstance();
        const instance2 = StatePreservationManager.getInstance();
        expect(instance1).toBe(instance2);
      });
    });

    describe('saveState and getState', () => {
      it('should save and retrieve state', () => {
        const state = { data: 'test', value: 123 };
        stateManager.saveState('test-key', state);

        const retrieved = stateManager.getState('test-key');
        expect(retrieved).toEqual(state);
      });

      it('should return null for non-existent key', () => {
        expect(stateManager.getState('non-existent')).toBeNull();
      });

      it('should return null for expired state', () => {
        stateManager.saveState('expired-key', { data: 'test' });

        // Fast forward past expiration time (5 minutes)
        jest.advanceTimersByTime(6 * 60 * 1000);

        expect(stateManager.getState('expired-key')).toBeNull();
      });
    });

    describe('clearState', () => {
      it('should clear specific state', () => {
        stateManager.saveState('key1', { data: 1 });
        stateManager.saveState('key2', { data: 2 });

        stateManager.clearState('key1');

        expect(stateManager.getState('key1')).toBeNull();
        expect(stateManager.getState('key2')).toEqual({ data: 2 });
      });
    });

    describe('clearAllStates', () => {
      it('should clear all states', () => {
        stateManager.saveState('key1', { data: 1 });
        stateManager.saveState('key2', { data: 2 });

        stateManager.clearAllStates();

        expect(stateManager.getState('key1')).toBeNull();
        expect(stateManager.getState('key2')).toBeNull();
      });
    });

    describe('subscribe', () => {
      it('should notify listeners on state change', () => {
        const listener = jest.fn();
        stateManager.subscribe('test-key', listener);

        stateManager.saveState('test-key', { data: 'test' });

        expect(listener).toHaveBeenCalledWith({ data: 'test' });
      });

      it('should return unsubscribe function', () => {
        const listener = jest.fn();
        const unsubscribe = stateManager.subscribe('test-key', listener);

        unsubscribe();
        stateManager.saveState('test-key', { data: 'test' });

        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe('saveFormState and getFormState', () => {
      it('should save and retrieve form state', () => {
        const formData = { name: 'John', email: 'john@example.com' };
        stateManager.saveFormState('contact-form', formData);

        const retrieved = stateManager.getFormState('contact-form');
        expect(retrieved).toEqual(formData);
      });

      it('should return null for non-existent form', () => {
        expect(stateManager.getFormState('non-existent-form')).toBeNull();
      });
    });

    describe('saveComponentState and getComponentState', () => {
      it('should save and retrieve component state', () => {
        const componentState = { isOpen: true, selectedIndex: 2 };
        stateManager.saveComponentState('modal-1', componentState);

        const retrieved = stateManager.getComponentState('modal-1');
        expect(retrieved).toEqual(componentState);
      });

      it('should return null for non-existent component', () => {
        expect(stateManager.getComponentState('non-existent-component')).toBeNull();
      });
    });
  });

  describe('getRecoveryStrategy', () => {
    it('should return aggressive retry for network errors', () => {
      const strategy = getRecoveryStrategy(new Error('Network error'));

      expect(strategy.maxRetries).toBe(5);
      expect(strategy.retryDelay).toBe(1000);
      expect(strategy.exponentialBackoff).toBe(true);
    });

    it('should return aggressive retry for timeout errors', () => {
      const strategy = getRecoveryStrategy(new Error('Request timeout'));

      expect(strategy.maxRetries).toBe(5);
    });

    it('should return aggressive retry for fetch errors', () => {
      const strategy = getRecoveryStrategy(new Error('Fetch failed'));

      expect(strategy.maxRetries).toBe(5);
    });

    it('should return redirect for authentication errors', () => {
      const strategy = getRecoveryStrategy(new Error('Unauthorized'));

      expect(strategy.maxRetries).toBe(1);
      expect(strategy.fallbackAction).toBeDefined();
    });

    it('should return no retry for validation errors', () => {
      const strategy = getRecoveryStrategy(new Error('Validation failed'));

      expect(strategy.maxRetries).toBe(0);
      expect(strategy.preserveState).toBe(true);
    });

    it('should return reload strategy for chunk loading errors', () => {
      const error = new Error('Chunk loading failed');
      error.name = 'ChunkLoadError';
      const strategy = getRecoveryStrategy(error);

      expect(strategy.maxRetries).toBe(2);
      expect(strategy.fallbackAction).toBeDefined();
    });

    it('should return default strategy for unknown errors', () => {
      const strategy = getRecoveryStrategy(new Error('Unknown error'));

      expect(strategy.maxRetries).toBe(3);
      expect(strategy.exponentialBackoff).toBe(true);
    });
  });

  describe('shouldRetryError', () => {
    it('should return false for validation errors', () => {
      expect(shouldRetryError(new Error('Validation error occurred'))).toBe(false);
      expect(shouldRetryError(new Error('Invalid input provided'))).toBe(false);
    });

    it('should return false for auth errors', () => {
      expect(shouldRetryError(new Error('Unauthorized access'))).toBe(false);
      expect(shouldRetryError(new Error('Forbidden resource'))).toBe(false);
    });

    it('should return false for client errors', () => {
      expect(shouldRetryError(new Error('Not found'))).toBe(false);
      expect(shouldRetryError(new Error('Bad request'))).toBe(false);
      expect(shouldRetryError(new Error('Conflict detected'))).toBe(false);
    });

    it('should return true for retryable errors', () => {
      expect(shouldRetryError(new Error('Network error'))).toBe(true);
      expect(shouldRetryError(new Error('Server timeout'))).toBe(true);
      expect(shouldRetryError(new Error('Internal server error'))).toBe(true);
    });
  });

  describe('withAutoRetry', () => {
    it('should wrap function with retry logic', async () => {
      const originalFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValue('success');

      const wrappedFn = withAutoRetry(originalFn, { maxRetries: 3, retryDelay: 100 });

      // Start the promise, then advance timers
      let result: string | undefined;
      const promise = wrappedFn().then((r) => {
        result = r;
      });

      // Advance timers to allow retries
      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });

    it('should call fallback on failure', async () => {
      const error = new Error('Always fails');
      const originalFn = jest.fn().mockRejectedValue(error);
      const fallbackAction = jest.fn();

      const wrappedFn = withAutoRetry(originalFn, {
        maxRetries: 2,
        retryDelay: 100,
        fallbackAction,
      });

      // Start the promise
      let caughtError: Error | undefined;
      const promise = wrappedFn().catch((e) => {
        caughtError = e;
      });

      // Advance timers to allow all retries
      await jest.advanceTimersByTimeAsync(5000);
      await promise;

      expect(caughtError?.message).toBe('Always fails');
      expect(fallbackAction).toHaveBeenCalled();
    });

    it('should pass arguments to wrapped function', async () => {
      const originalFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = withAutoRetry(originalFn, { maxRetries: 3 });

      const promise = wrappedFn('arg1', 'arg2');
      await jest.advanceTimersByTimeAsync(100);
      await promise;

      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});
