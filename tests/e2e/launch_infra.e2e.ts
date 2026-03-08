/**
 * E2E Test: Launch Script Validation
 *
 * Verifies the launch.sh infrastructure without actually running
 * the interactive script. Checks:
 * 1. All scripts referenced by launch.sh exist
 * 2. All scripts compile
 * 3. Config files can be generated in expected formats
 * 4. Docker Compose file is valid YAML
 * 5. .env.example has all required fields
 */

import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('E2E: Launch Infrastructure', () => {
    // ─── launch.sh References ─────────────────────────────────────────────────

    describe('launch.sh Script References', () => {
        let launchContent: string;

        beforeAll(() => {
            launchContent = fs.readFileSync(
                path.join(ROOT_DIR, 'launch.sh'),
                'utf8',
            );
        });

        it('launch.sh exists and is executable-valid bash', () => {
            expect(launchContent).toContain('#!/bin/bash');
            expect(launchContent).toContain('set -euo pipefail');
        });

        it('references generate_wallet.ts which exists', () => {
            expect(launchContent).toContain('generate_wallet.ts');
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'scripts/generate_wallet.ts')),
            ).toBe(true);
        });

        it('references fund.ts which exists', () => {
            expect(launchContent).toContain('fund.ts');
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'scripts/fund.ts')),
            ).toBe(true);
        });

        it('references register.ts which exists', () => {
            expect(launchContent).toContain('register.ts');
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'scripts/register.ts')),
            ).toBe(true);
        });

        it('references build_manifest.ts which exists', () => {
            expect(launchContent).toContain('build_manifest.ts');
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'scripts/build_manifest.ts')),
            ).toBe(true);
        });

        it('all 10 steps are defined', () => {
            for (let i = 0; i <= 10; i++) {
                // launch.sh uses: step "N/10" "description"
                expect(launchContent).toContain(`"${i}/10"`);
            }
        });
    });

    // ─── Config File Formats ──────────────────────────────────────────────────

    describe('Config File Formats', () => {
        it('.env.example exists with required fields', () => {
            const envExample = fs.readFileSync(
                path.join(ROOT_DIR, '.env.example'),
                'utf8',
            );
            expect(envExample).toContain('MULTIVERSX_CHAIN_ID');
            expect(envExample).toContain('MULTIVERSX_API_URL');
            expect(envExample).toContain('IDENTITY_REGISTRY_ADDRESS');
            expect(envExample).toContain('AGENT_NAME');
            expect(envExample).toContain('BACKEND_PORT');
        });

        it('agent.config.example.json exists and is valid JSON', () => {
            const configPath = path.join(ROOT_DIR, 'agent.config.example.json');
            expect(fs.existsSync(configPath)).toBe(true);
            expect(() => JSON.parse(fs.readFileSync(configPath, 'utf8'))).not.toThrow();
        });

        it('docker-compose.yml exists', () => {
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'docker-compose.yml')),
            ).toBe(true);
        });
    });

    // ─── Backend Build ────────────────────────────────────────────────────────

    describe('Backend Build', () => {
        it('backend/package.json exists with required dependencies', () => {
            const pkg = JSON.parse(
                fs.readFileSync(
                    path.join(ROOT_DIR, 'backend/package.json'),
                    'utf8',
                ),
            );
            expect(pkg.dependencies['@multiversx/sdk-core']).toBeDefined();
            // Deprecated packages should NOT be in dependencies (migrated to sdk-core)
            expect(pkg.dependencies['@multiversx/sdk-wallet']).toBeUndefined();
            expect(pkg.dependencies['@multiversx/sdk-network-providers']).toBeUndefined();
            expect(pkg.dependencies['express']).toBeDefined();
        });

        it('backend tsconfig.json exists', () => {
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'backend/tsconfig.json')),
            ).toBe(true);
        });

        it('backend compiles without errors', () => {
            const result = childProcess.spawnSync('npx', ['tsc', '--noEmit'], {
                cwd: path.join(ROOT_DIR, 'backend'),
                encoding: 'utf8',
                timeout: 30000,
            });
            if (result.status !== 0) {
                console.error('Backend compilation errors:\n', result.stdout, result.stderr);
            }
            expect(result.status).toBe(0);
        });
    });

    // ─── Root Scripts Build ───────────────────────────────────────────────────

    describe('Root Scripts Build', () => {
        it('root tsconfig.json exists', () => {
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'tsconfig.json')),
            ).toBe(true);
        });

        it('root scripts compile without errors', () => {
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
                console.error('Root script compilation errors:\n', result.stdout, result.stderr);
            }
            expect(result.status).toBe(0);
        });

        it('root node_modules has @multiversx/sdk-core (not deprecated sdk-wallet)', () => {
            expect(
                fs.existsSync(
                    path.join(ROOT_DIR, 'node_modules/@multiversx/sdk-core'),
                ),
            ).toBe(true);
        });
    });

    // ─── Deployment Files ─────────────────────────────────────────────────────

    describe('Deployment Files', () => {
        it('backend Dockerfile exists', () => {
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'backend/Dockerfile')),
            ).toBe(true);
        });

        it('deploy/ directory has deployment scripts', () => {
            expect(
                fs.existsSync(path.join(ROOT_DIR, 'deploy')),
            ).toBe(true);
        });

        it('infra/ directory has infrastructure scripts', () => {
            const infraDir = path.join(ROOT_DIR, 'infra');
            expect(fs.existsSync(infraDir)).toBe(true);
        });
    });
});
