// CommonJS stub of the ESM-only `hexy` package. Only needed so Jest can load
// node-opcua transitively; the actual hex-dump output is never asserted.
'use strict';
module.exports = {
  hexy: (buf) => (Buffer.isBuffer(buf) ? buf.toString('hex') : String(buf)),
  Hexy: class Hexy {},
  maxnumberlen: 8
};
