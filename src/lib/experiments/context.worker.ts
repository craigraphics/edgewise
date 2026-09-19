import { countTokens } from './tokenizer-engine';

export type CountRequest = { requestId: number; texts: string[] };
export type CountSuccess = { requestId: number; counts: number[] };
export type CountFailure = { requestId: number; error: string };
export type CountResponse = CountSuccess | CountFailure;

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<CountRequest>) => void) | null;
  postMessage: (message: CountResponse) => void;
};

worker.onmessage = ({ data }) => {
  try {
    worker.postMessage({ requestId: data.requestId, counts: data.texts.map(countTokens) });
  } catch (error) {
    worker.postMessage({
      requestId: data.requestId,
      error: error instanceof Error ? error.message : 'The local token counter could not load.',
    });
  }
};
