/**
 * Re-export RelayerAddressCache from backend/src/mx/utils/
 *
 * Root-level scripts (scripts/register.ts) import from '../src/utils/RelayerAddressCache'.
 * This shim resolves that path when scripts are run from the project root.
 */
export { RelayerAddressCache } from '../../backend/src/mx/utils/RelayerAddressCache';
