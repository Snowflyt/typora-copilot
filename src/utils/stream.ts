/**
 * Parse an SSE (Server-Sent Events) stream and handle messages.
 * @param stream The ReadableStream to read from.
 * @param onMessage The callback to handle each message.
 * @param onError The callback to handle errors for each message (optional).
 */
export async function parseSSEStream<T>(
  stream: ReadableStream,
  onMessage: (data: T) => void,
  onError?: (error: Error, rawData?: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Stream reading was aborted", "AbortError");
    }

    const abortController = new AbortController();
    const localSignal = abortController.signal;

    if (signal) {
      const abortListener = () => {
        abortController.abort();
        void reader.cancel();
      };

      signal.addEventListener("abort", abortListener, { once: true });

      localSignal.addEventListener(
        "abort",
        () => {
          signal.removeEventListener("abort", abortListener);
        },
        { once: true },
      );
    }

    while (!localSignal.aborted) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let processBuffer = true;
      while (processBuffer) {
        const messageEnd = buffer.indexOf("\n\n");
        if (messageEnd === -1) {
          processBuffer = false;
          continue;
        }

        const message = buffer.substring(0, messageEnd).trim();
        buffer = buffer.substring(messageEnd + 2);

        if (message && !message.includes("[DONE]")) {
          const dataPrefix = "data: ";
          if (message.startsWith(dataPrefix)) {
            const jsonStr = message.substring(dataPrefix.length).trim();
            try {
              const data = JSON.parse(jsonStr) as T;
              onMessage(data);
            } catch (e) {
              onError?.(e instanceof Error ? e : new Error(String(e)), jsonStr);
            }
          }
        }
      }

      if (!signal?.aborted && buffer.trim() && buffer.trim() !== "[DONE]") {
        try {
          const data = JSON.parse(buffer.trim()) as T;
          onMessage(data);
        } catch (e) {
          onError?.(e instanceof Error ? e : new Error(String(e)), buffer.trim());
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim() && buffer.trim() !== "[DONE]")
      try {
        const data = JSON.parse(buffer.trim()) as T;
        onMessage(data);
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error(String(e)), buffer.trim());
      }
  } catch (error) {
    if (signal?.aborted && error instanceof DOMException && error.name === "AbortError") return;

    if (onError) onError(error instanceof Error ? error : new Error(String(error)));
    else throw error;
  } finally {
    decoder.decode();

    try {
      await reader.cancel();
    } catch (e) {
      // Ignore
    }
  }
}
