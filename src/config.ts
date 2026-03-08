/**
 * Re-export CONFIG from backend/src/mx/config.ts
 *
 * Root-level scripts (scripts/*.ts) import from '../src/config'.
 * This shim resolves that path when scripts are run from the project root
 * via `npx ts-node scripts/generate_wallet.ts` (as launch.sh does).
 */
export { CONFIG } from '../backend/src/mx/config';
