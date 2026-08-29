/** Keep user-entered text byte-for-byte while retaining the empty-message placeholder. */
export function payloadForEmbedding(payload: string): string {
  return payload || ' '
}
