// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as net from 'net';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { execSync, spawn } from 'child_process';
import { program, Command } from 'commander';

interface Configs {
  mode: string;
  host: string;
  port: string;
  workingDir: string;
  info: string;
}

async function main() {
  program
    .name(path.basename(__filename))
    .argument('<mode>', 'Mode to run: start|stop')
    .option('-d, --dir <string>', 'Root directory of the vite project')
    .showHelpAfterError()
    .parse(process.argv);

  const c = createConfigs(program);

  if (c.mode === 'start') {
    await start(c);
  } else if (c.mode === 'stop') {
    stop(c);
  } else {
    console.log(`[${c.info}] Invalid option`);
    program.outputHelp();
  }
}

main().catch((e) => {
  console.log('Fatal error:', e);
  process.exit(1);
});

// helpers
function createConfigs(prog: Command): Configs {
  interface CmdLineOptions {
    dir?: string;
  }

  const opts = prog.opts<CmdLineOptions>();
  const viteProjectRoot = path.resolve(__dirname, opts.dir ?? '.');

  dotenv.config({
    path: path.resolve(viteProjectRoot, '.env')
  });

  const mode = prog.args[0] ?? '.';
  const host = 'localhost';
  const port = process.env.VITE_DEV_PORT ?? '5173';
  const info = `${prog.name()}, ${host}:${port}`;
  const workingDir = viteProjectRoot;

  return { mode, host, port, workingDir, info };
}

async function start(c: Configs) {
  if (await isPortInUse(c)) {
    console.log(`[${c.info}] Already in use ${c.host}:${c.port}`);
    process.exit(0);
  }

  console.log(`[${c.info}] Starting ...`);

  const vite = path.resolve(c.workingDir, 'node_modules/.bin/vite');
  const p = spawn(vite, ['--port', c.port, '--host', c.host], {
    cwd: c.workingDir,
    stdio: 'ignore',
    detached: true,
    shell: true
  });

  if (!p.pid) {
    console.log(`[${c.info}] Failed to start`);
    process.exit(1);
  }

  console.log(`[${c.info}] Started on background, pid = ${p.pid}`);
  p.unref();
}

function stop(c: Configs) {
  console.log(`[${c.info}] Stopping ...`);
  execSync(`npx kill-port ${c.port}`, {
    stdio: 'inherit'
  });
}

async function isPortInUse(c: Configs): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: unknown) => {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === 'EADDRINUSE'
      ) {
        resolve(true);
      } else {
        console.error('Unexpected error:', err);
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(parseInt(c.port), c.host);
  });
}
