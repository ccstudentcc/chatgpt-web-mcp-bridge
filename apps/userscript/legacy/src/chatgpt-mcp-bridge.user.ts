import { startExtensionRuntimeWhenReady } from '../../extension/src/main/index.js';

startExtensionRuntimeWhenReady({
  installRequestHook: true
});
