/**
 * Script Compilation & Validation Tests
 *
 * These tests verify that every root-level TypeScript script:
 * 1. Exists on disk
 * 2. Compiles without TypeScript errors (imports resolve)
 * 3. Has valid structure (exports a main or is self-executing)
 *
 * These tests would have caught the original TS2307 error:
 *   "Cannot find module '@multiversx/sdk-wallet'"
 */

import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';

const ROOT_DIR = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.resolve(ROOT_DIR, 'scripts');

// All scripts referenced by launch.sh and package.json
const EXPECTED_SCRIPTS = [
    'generate_wallet.ts',
    'register.ts',
    'check_balance.ts',
    'fund.ts',
    'build_manifest.ts',
    'update_manifest.ts',
    'sign_x402.ts',
    'sign_x402_relayed.ts',
];

describe('Script Files Exist', () => {
    for (const script of EXPECTED_SCRIPTS) {
        it(`${script} exists`, () => {
            const fullPath = path.join(SCRIPTS_DIR, script);
            expect(fs.existsSync(fullPath)).toBe(true);
        });
    }
});

describe('Script TypeScript Compilation', () => {
    it('all scripts compile without errors via tsc --noEmit', () => {
        const result = childProcess.spawnSync(
            'npx',
            ['tsc', '--project', 'tsconfig.json', '--noEmit'],
            {
                cwd: ROOT_DIR,
                encoding: 'utf8',
                timeout: 30000,
            },
        );
        if (result.status !== 0) {
            console.error('TypeScript compilation errors:\n', result.stdout, result.stderr);
        }
        expect(result.status).toBe(0);
    });
});

describe('Script Import Validation', () => {
    // All SDK functionality now comes from @multiversx/sdk-core v15
    // (sdk-wallet and sdk-network-providers were deprecated and removed)
    const SDK_MODULES = [
        '@multiversx/sdk-core',
    ];

    for (const mod of SDK_MODULES) {
        it(`${mod} is resolvable`, () => {
            expect(() => require.resolve(mod, { paths: [ROOT_DIR] })).not.toThrow();
        });
    }

    it('dotenv is resolvable', () => {
        expect(() => require.resolve('dotenv', { paths: [ROOT_DIR] })).not.toThrow();
    });

    it('axios is resolvable', () => {
        expect(() => require.resolve('axios', { paths: [ROOT_DIR] })).not.toThrow();
    });
});

describe('Script Content Validation', () => {
    for (const script of EXPECTED_SCRIPTS) {
        it(`${script} has valid structure`, () => {
            const fullPath = path.join(SCRIPTS_DIR, script);
            const content = fs.readFileSync(fullPath, 'utf8');

            // Every script should have imports
            expect(content).toMatch(/^import\s/m);

            // Every script should have a main function or top-level execution
            expect(content).toMatch(/async\s+function\s+main|main\(\)/);
        });
    }
});

describe('Package.json Script Commands', () => {
    it('package.json has all expected npm script commands', () => {
        const pkgPath = path.join(ROOT_DIR, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts['generate-wallet']).toContain('generate_wallet.ts');
        expect(pkg.scripts['register']).toContain('register.ts');
        expect(pkg.scripts['balance']).toContain('check_balance.ts');
        expect(pkg.scripts['fund']).toContain('fund.ts');
        expect(pkg.scripts['update-manifest']).toContain('update_manifest.ts');
    });

    it('deprecated sdk-wallet is NOT in root dependencies (migrated to sdk-core)', () => {
        const pkgPath = path.join(ROOT_DIR, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        expect(pkg.dependencies['@multiversx/sdk-wallet']).toBeUndefined();
        expect(pkg.dependencies['@multiversx/sdk-network-providers']).toBeUndefined();
    });

    it('root dependencies include @multiversx/sdk-core', () => {
        const pkgPath = path.join(ROOT_DIR, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        expect(pkg.dependencies['@multiversx/sdk-core']).toBeDefined();
    });
});

describe('Config Re-export Shim', () => {
    it('src/config.ts exists and re-exports CONFIG', () => {
        const shimPath = path.join(ROOT_DIR, 'src', 'config.ts');
        expect(fs.existsSync(shimPath)).toBe(true);
        const content = fs.readFileSync(shimPath, 'utf8');
        expect(content).toContain('CONFIG');
        expect(content).toContain('backend/src/mx/config');
    });

    it('src/utils/RelayerAddressCache.ts exists', () => {
        const shimPath = path.join(ROOT_DIR, 'src', 'utils', 'RelayerAddressCache.ts');
        expect(fs.existsSync(shimPath)).toBe(true);
        const content = fs.readFileSync(shimPath, 'utf8');
        expect(content).toContain('RelayerAddressCache');
    });
});
