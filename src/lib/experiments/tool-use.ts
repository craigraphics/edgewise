/**
 * A deliberately tiny tool boundary for the `tool-use` experiment.
 *
 * The request is data. `handleCalculatorRequest` is the named piece of app code
 * that validates and executes it. Keeping those separate is the lesson, not
 * just an implementation detail.
 */

export const BOARD_LENGTH_CM = 87;
export const MIN_BOARD_COUNT = 1;
export const MAX_BOARD_COUNT = 20;
export const MAX_OPERAND = 10_000;
export const MAX_RESULT = 100_000;

export type CalculatorRequest = {
  id: string;
  tool: 'calculator';
  operation: 'multiply';
  operands: readonly [number, number];
  unit: 'cm';
};

export type CalculatorSuccess = {
  requestId: string;
  status: 'success';
  value: number;
  unit: 'cm';
};

export type CalculatorFailure = {
  requestId: string;
  status: 'error';
  message: string;
};

export type CalculatorResponse = CalculatorSuccess | CalculatorFailure;

export function validateCalculatorRequest(request: CalculatorRequest): string | null {
  if (request.tool !== 'calculator') return 'This handler only accepts the calculator.';
  if (request.operation !== 'multiply') return 'This handler only accepts multiplication.';
  if (request.unit !== 'cm') return 'This handler only accepts centimetres.';
  if (request.operands.some(value => !Number.isFinite(value))) return 'Both numbers must be finite.';
  if (request.operands.some(value => value < 0 || value > MAX_OPERAND)) return `Each number must be between 0 and ${MAX_OPERAND}.`;
  return null;
}

/** No `eval` and no free-text expression: one allowlisted operation only. */
export function handleCalculatorRequest(request: CalculatorRequest): CalculatorResponse {
  const invalid = validateCalculatorRequest(request);
  if (invalid) return { requestId: request.id, status: 'error', message: invalid };
  const value = request.operands[0] * request.operands[1];
  if (!Number.isFinite(value) || value > MAX_RESULT) {
    return { requestId: request.id, status: 'error', message: `The result must be no more than ${MAX_RESULT}cm.` };
  }
  return { requestId: request.id, status: 'success', value, unit: request.unit };
}

export type ToolDemoPhase = 'waiting' | 'running' | 'success' | 'error';

export type ToolDemoState = {
  boardCount: number | null;
  request: CalculatorRequest | null;
  nextRequestNumber: number;
  phase: ToolDemoPhase;
  response: CalculatorResponse | null;
  hasRun: boolean;
  previousSuccess: { boardCount: number; response: CalculatorSuccess } | null;
};

export type ToolDemoAction =
  | { kind: 'change-count'; count: number | null }
  | { kind: 'begin'; requestId: string }
  | { kind: 'replace-and-begin'; request: CalculatorRequest }
  | { kind: 'resolve'; response: CalculatorResponse }
  | { kind: 'reset' };

export function makeCalculatorRequest(id: string, boardCount: number): CalculatorRequest {
  return {
    id,
    tool: 'calculator',
    operation: 'multiply',
    operands: [boardCount, BOARD_LENGTH_CM],
    unit: 'cm',
  };
}

function requestId(number: number) {
  return `shelf-${number}`;
}

function validBoardCount(count: number | null): count is number {
  return count !== null && Number.isInteger(count) && count >= MIN_BOARD_COUNT && count <= MAX_BOARD_COUNT;
}

export function initialToolDemo(): ToolDemoState {
  return {
    boardCount: 3,
    request: makeCalculatorRequest(requestId(1), 3),
    nextRequestNumber: 2,
    phase: 'waiting',
    response: null,
    hasRun: false,
    previousSuccess: null,
  };
}

export function replacementRequest(state: ToolDemoState): CalculatorRequest | null {
  if (!validBoardCount(state.boardCount)) return null;
  return makeCalculatorRequest(requestId(state.nextRequestNumber), state.boardCount);
}

/**
 * A reducer makes response ordering explicit. A late response for an older
 * request cannot complete the current answer, even if cancelling its timer did
 * not prevent the callback from arriving.
 */
export function applyToolDemoAction(state: ToolDemoState, action: ToolDemoAction): ToolDemoState {
  if (action.kind === 'reset') {
    const request = makeCalculatorRequest(requestId(state.nextRequestNumber), 3);
    return { boardCount: 3, request, nextRequestNumber: state.nextRequestNumber + 1, phase: 'waiting', response: null, hasRun: false, previousSuccess: null };
  }

  if (action.kind === 'change-count') {
    const previousSuccess = state.phase === 'success' && state.response?.status === 'success' && state.boardCount !== null
      ? { boardCount: state.boardCount, response: state.response }
      : state.previousSuccess;
    if (!validBoardCount(action.count)) {
      return { ...state, boardCount: action.count, request: null, phase: 'waiting', response: null, previousSuccess };
    }
    const request = makeCalculatorRequest(requestId(state.nextRequestNumber), action.count);
    return {
      boardCount: action.count,
      request,
      nextRequestNumber: state.nextRequestNumber + 1,
      phase: 'waiting',
      response: null,
      hasRun: state.hasRun,
      previousSuccess,
    };
  }

  if (action.kind === 'replace-and-begin') {
    const previousSuccess = state.phase === 'success' && state.response?.status === 'success' && state.boardCount !== null
      ? { boardCount: state.boardCount, response: state.response }
      : state.previousSuccess;
    return {
      ...state,
      request: action.request,
      nextRequestNumber: state.nextRequestNumber + 1,
      phase: 'running',
      response: null,
      previousSuccess,
    };
  }

  if (action.kind === 'begin') {
    if (!state.request || state.request.id !== action.requestId || state.phase === 'running') return state;
    return { ...state, phase: 'running', response: null, hasRun: true };
  }

  if (!state.request || action.response.requestId !== state.request.id || state.phase !== 'running') return state;
  return {
    ...state,
    phase: action.response.status === 'success' ? 'success' : 'error',
    response: action.response,
  };
}

export function finalShelfAnswer(response: CalculatorSuccess): string {
  return `You need ${response.value}${response.unit} of board, before allowing for cuts.`;
}
