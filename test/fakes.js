/**
 * A fake LLM client: returns the given outputs in order and records each call.
 * An output that is an Error is thrown instead of returned.
 *
 * @param {...unknown} outputs
 */
export function createFakeLlm(...outputs) {
  const calls = [];
  return {
    calls,
    async parse(request) {
      calls.push(request);
      if (outputs.length === 0) throw new Error("FakeLlm: no more outputs queued");
      const output = outputs.shift();
      if (output instanceof Error) throw output;
      return output;
    },
  };
}
