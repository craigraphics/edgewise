import { tokenizeText } from './tokenizer-engine';
import type { TokenizeRequest, TokenizeResponse } from './tokenizer';

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<TokenizeRequest>) => void) | null;
  postMessage: (message: TokenizeResponse) => void;
};

worker.onmessage = ({ data }) => {
  try {
    worker.postMessage({ requestId: data.requestId, tokens: tokenizeText(data.text) });
  } catch (error) {
    worker.postMessage({
      requestId: data.requestId,
      error: error instanceof Error ? error.message : 'The tokenizer could not load.',
    });
  }
};
