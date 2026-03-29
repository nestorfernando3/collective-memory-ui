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
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await page.getByTestId('guide-panel').waitFor({ state: 'visible' });
    await page.getByTestId('core-node').dispatchEvent('click');
    await page.getByTestId('drawer').waitFor({ state: 'visible' });

    const profileMode = await page.getByTestId('drawer').getAttribute('data-drawer-mode');
    if (profileMode !== 'profile') {
      throw new Error(`Expected profile drawer mode, received ${profileMode || 'none'}`);
    }

    await page.getByTestId('drawer-close-btn').click({ force: true });
    await delay(200);

    await page.getByTestId('project-node-paideia').dispatchEvent('click');
    const projectMode = await page.getByTestId('drawer').getAttribute('data-drawer-mode');
    if (projectMode !== 'project') {
      throw new Error(`Expected project drawer mode, received ${projectMode || 'none'}`);
    }

    await page.getByTestId('exclude-project-btn').click();
    await page.getByTestId('excluded-projects-list').waitFor({ state: 'visible' });
    await delay(250);

    const hiddenProjectCount = await page.getByTestId('restore-project-btn-paideia').count();
    if (hiddenProjectCount === 0) {
      throw new Error('Expected the excluded project to appear in the restore list');
    }

    const nodeCount = await page.getByTestId('project-node-paideia').count();
    if (nodeCount !== 0) {
      throw new Error('Expected the excluded project to disappear from the graph');
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
