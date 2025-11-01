// Minimal canvas mock for jsdom compatibility
// This runs before Jest environment initialization
const Module = require('module')
const originalRequire = Module.prototype.require

Module.prototype.require = function (id) {
    if (id === 'canvas') {
        return {}
    }
    return originalRequire.apply(this, arguments)
}
