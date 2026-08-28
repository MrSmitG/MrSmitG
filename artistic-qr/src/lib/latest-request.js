export function createLatestRequest() {
  let latest = 0

  return {
    begin() {
      latest += 1
      return latest
    },
    /** @param {number} request */
    isCurrent(request) {
      return request === latest
    },
  }
}
