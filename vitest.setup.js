/* vitest (jsdom) setup — stub the browser APIs the app touches defensively */
if (!window.matchMedia) {
  window.matchMedia = q => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false },
  })
}
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock'
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {}
if (!window.scrollTo) window.scrollTo = () => {}
if (!window.ResizeObserver) {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
}
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true })
}
/* File/Blob conveniences jsdom may lack */
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = () => reject(fr.error)
      fr.readAsArrayBuffer(this)
    })
  }
}
