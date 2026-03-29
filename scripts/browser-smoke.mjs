#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const PORT = new URL(BASE_URL).port || '4173';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT_DIR,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  await run('npm', ['run', 'build'], { cwd: ROOT_DIR });

  const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', PORT], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      CI: 'true',
    },
    stdio: 'inherit',
  });

  let browser;

  try {
    await waitForServer(BASE_URL);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await page.getByTestId('guide-panel').waitFor({ state: 'visible' });
    await page.getByTestId('core-node').dispatchEvent('click');
    await page.getByTestId('drawer').waitFor({ state: 'visible' });

    const profileMode = await page.getByTestId('drawer').getAttribute('data-drawer-mode');
    if (profileMode !== 'profile') {
      throw new Error(`Expected profile drawer mode, received ${profileMode || 'none'}`);
    }

    await page.keyboard.press('Escape');
    await delay(150);

    const emptyDrawerMode = await page.getByTestId('drawer').getAttribute('data-drawer-mode');
    if (emptyDrawerMode !== 'empty') {
      throw new Error(`Expected drawer to close with Escape, received ${emptyDrawerMode || 'none'}`);
    }

    await page.getByTestId('lens-btn-Tooling').click();
    await page.getByTestId('project-node-collective-memory').waitFor({ state: 'visible' });

    const toolingProjectCount = await page.locator('[data-testid^="project-node-"]').count();
    if (toolingProjectCount !== 1) {
      throw new Error(`Expected one tooling project, received ${toolingProjectCount}`);
    }

    await page.getByTestId('project-node-collective-memory').dispatchEvent('click');
    const projectMode = await page.getByTestId('drawer').getAttribute('data-drawer-mode');
    if (projectMode !== 'project') {
      throw new Error(`Expected project drawer mode, received ${projectMode || 'none'}`);
    }

    await page.getByTestId('exclude-project-btn').click();
    await page.getByTestId('graph-empty-state').waitFor({ state: 'visible' });

    const hiddenProjectCount = await page.getByTestId('restore-hidden-projects-btn').count();
    if (hiddenProjectCount !== 1) {
      throw new Error('Expected the empty-state recovery button to be visible');
    }

    const nodeCount = await page.locator('[data-testid^="project-node-"]').count();
    if (nodeCount !== 0) {
      throw new Error('Expected the excluded project to disappear from the graph');
    }

    await page.getByTestId('restore-hidden-projects-btn').click();
    await page.getByTestId('graph-empty-state').waitFor({ state: 'hidden' });
    await page.getByTestId('project-node-collective-memory').waitFor({ state: 'visible' });

    await page.getByTestId('project-node-collective-memory').dispatchEvent('click');
    await page.getByTestId('exclude-project-btn').click();
    await page.getByTestId('graph-empty-state').waitFor({ state: 'visible' });

    await page.getByTestId('reset-lens-btn').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="project-node-"]').length > 1, null, {
      timeout: 5000,
    });
    await page.getByTestId('graph-empty-state').waitFor({ state: 'hidden' });

    const recoveredNodeCount = await page.locator('[data-testid^="project-node-"]').count();
    if (recoveredNodeCount <= 1) {
      throw new Error('Expected reset lens to restore the graph beyond the empty state');
    }

    await browser.close();
    browser = null;
    console.log('Browser smoke passed');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }

    preview.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
