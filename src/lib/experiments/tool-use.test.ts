import { describe, expect, it } from 'vitest';

import {
  applyToolDemoAction,
  finalShelfAnswer,
  handleCalculatorRequest,
  initialToolDemo,
  makeCalculatorRequest,
  replacementRequest,
  validateCalculatorRequest,
  type CalculatorRequest,
} from './tool-use';

describe('the calculator handler', () => {
  it('calculates three boards at 87cm each', () => {
    const response = handleCalculatorRequest(makeCalculatorRequest('shelf-test', 3));
    expect(response).toEqual({ requestId: 'shelf-test', status: 'success', value: 261, unit: 'cm' });
    if (response.status === 'success') expect(finalShelfAnswer(response)).toBe('You need 261cm of board, before allowing for cuts.');
  });

  it('uses the changed input rather than a prepared result', () => {
    expect(handleCalculatorRequest(makeCalculatorRequest('four', 4))).toMatchObject({ value: 348 });
    expect(handleCalculatorRequest(makeCalculatorRequest('seven', 7))).toMatchObject({ value: 609 });
  });

  it('rejects invalid, non-finite, and out-of-range operands', () => {
    const invalid = (operands: readonly [number, number]): CalculatorRequest => ({
      id: 'bad', tool: 'calculator', operation: 'multiply', operands, unit: 'cm',
    });
    expect(validateCalculatorRequest(invalid([Number.NaN, 87]))).toMatch(/finite/);
    expect(validateCalculatorRequest(invalid([3, Number.POSITIVE_INFINITY]))).toMatch(/finite/);
    expect(handleCalculatorRequest(invalid([-1, 87])).status).toBe('error');
    expect(handleCalculatorRequest(invalid([10_000, 87])).status).toBe('error');
  });

  it('allowlists the handler, operation, and unit', () => {
    const request = makeCalculatorRequest('typed', 3);
    expect(validateCalculatorRequest({ ...request, tool: 'weather' } as unknown as CalculatorRequest)).toMatch(/calculator/);
    expect(validateCalculatorRequest({ ...request, operation: 'add' } as unknown as CalculatorRequest)).toMatch(/multiplication/);
    expect(validateCalculatorRequest({ ...request, unit: 'm' } as unknown as CalculatorRequest)).toMatch(/centimetres/);
  });
});

describe('the tool handoff state', () => {
  it('does not show a completed result before the matching request succeeds', () => {
    const start = initialToolDemo();
    expect(start.phase).toBe('waiting');
    expect(start.response).toBeNull();
    const running = applyToolDemoAction(start, { kind: 'begin', requestId: start.request!.id });
    expect(running.phase).toBe('running');
    expect(running.response).toBeNull();
    const response = handleCalculatorRequest(running.request!);
    expect(applyToolDemoAction(running, { kind: 'resolve', response })).toMatchObject({ phase: 'success', response });
  });

  it('puts the old answer aside and creates a new request when the input changes', () => {
    const start = initialToolDemo();
    const running = applyToolDemoAction(start, { kind: 'begin', requestId: start.request!.id });
    const done = applyToolDemoAction(running, { kind: 'resolve', response: handleCalculatorRequest(running.request!) });
    const changed = applyToolDemoAction(done, { kind: 'change-count', count: 5 });
    expect(changed.request?.id).not.toBe(done.request?.id);
    expect(changed.request?.operands).toEqual([5, 87]);
    expect(changed).toMatchObject({ phase: 'waiting', response: null });
    expect(changed.previousSuccess).toEqual({ boardCount: 3, response: { requestId: start.request!.id, status: 'success', value: 261, unit: 'cm' } });

    const changedRunning = applyToolDemoAction(changed, { kind: 'begin', requestId: changed.request!.id });
    const changedDone = applyToolDemoAction(changedRunning, { kind: 'resolve', response: handleCalculatorRequest(changed.request!) });
    expect(changedDone).toMatchObject({
      response: { status: 'success', value: 435 },
      previousSuccess: { boardCount: 3, response: { value: 261 } },
    });
  });

  it('keeps invalid input from becoming a request', () => {
    const invalid = applyToolDemoAction(initialToolDemo(), { kind: 'change-count', count: null });
    expect(invalid.request).toBeNull();
    expect(invalid.response).toBeNull();
    expect(applyToolDemoAction(initialToolDemo(), { kind: 'change-count', count: 2.5 }).request).toBeNull();
  });

  it('shows a failure without inventing an answer, then retries with a new id', () => {
    const start = initialToolDemo();
    const running = applyToolDemoAction(start, { kind: 'begin', requestId: start.request!.id });
    const failed = applyToolDemoAction(running, { kind: 'resolve', response: { requestId: running.request!.id, status: 'error', message: 'Calculator unavailable.' } });
    expect(failed).toMatchObject({ phase: 'error', response: { status: 'error' } });

    const retry = replacementRequest(failed)!;
    const retrying = applyToolDemoAction(failed, { kind: 'replace-and-begin', request: retry });
    expect(retrying.request?.id).not.toBe(failed.request?.id);
    expect(retrying).toMatchObject({ phase: 'running', response: null });
    const recovered = applyToolDemoAction(retrying, { kind: 'resolve', response: handleCalculatorRequest(retry) });
    expect(recovered).toMatchObject({ phase: 'success', response: { value: 261 } });
  });

  it('ignores a delayed result from an older request', () => {
    const first = initialToolDemo();
    const firstRunning = applyToolDemoAction(first, { kind: 'begin', requestId: first.request!.id });
    const second = applyToolDemoAction(firstRunning, { kind: 'change-count', count: 6 });
    const secondRunning = applyToolDemoAction(second, { kind: 'begin', requestId: second.request!.id });
    const stale = handleCalculatorRequest(firstRunning.request!);
    expect(applyToolDemoAction(secondRunning, { kind: 'resolve', response: stale })).toBe(secondRunning);
  });

  it('makes rapid duplicate starts harmless and reset cancels the old request id', () => {
    const start = initialToolDemo();
    const once = applyToolDemoAction(start, { kind: 'begin', requestId: start.request!.id });
    expect(applyToolDemoAction(once, { kind: 'begin', requestId: start.request!.id })).toBe(once);

    const reset = applyToolDemoAction(once, { kind: 'reset' });
    expect(reset.request?.id).not.toBe(once.request?.id);
    expect(reset).toMatchObject({ boardCount: 3, phase: 'waiting', response: null, previousSuccess: null });
    const late = handleCalculatorRequest(once.request!);
    expect(applyToolDemoAction(reset, { kind: 'resolve', response: late })).toBe(reset);
  });
});
