// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs';
import { program } from 'commander';
import { execSync } from 'child_process';

interface Sbom {
  metadata: {
    tools: {
      components: { name: string; group?: string }[];
    };
  };
}

// The npm version is the only part of the document that depends on the machine
// rather than on the committed lock file, so drop it to keep the SBOM diffable.
function removeNpmToolEntry(sbomFile: string) {
  const sbom = JSON.parse(fs.readFileSync(sbomFile, 'utf-8')) as Sbom;
  const tools = sbom.metadata.tools.components;
  sbom.metadata.tools.components = tools.filter(
    (tool) => tool.name !== 'npm' || tool.group !== undefined
  );
  fs.writeFileSync(sbomFile, JSON.stringify(sbom, null, 2));
}

function main() {
  program.option('-o, --output <string>', 'Path to output file');
  program.option('-d, --dir <string>', 'Path to target extension root');
  program.parse(process.argv);
  const options = program.opts();
  const outputFile = options.output as string;
  const targetExtensionRoot = options.dir as string;
  const sbomFile =
    outputFile && outputFile !== ''
      ? path.resolve(outputFile)
      : path.resolve(targetExtensionRoot, 'sbom.cdx.json');

  console.log('Generating SBOM...');
  const args = [
    '--package-lock-only',
    '--ignore-npm-errors',
    '--omit dev',
    '--output-reproducible',
    '--output-format JSON',
    `--output-file "${sbomFile}"`
  ];
  execSync(`npx --no -- cyclonedx-npm ${args.join(' ')}`, {
    cwd: targetExtensionRoot,
    stdio: 'inherit'
  });
  removeNpmToolEntry(sbomFile);
  console.log(`SBOM generated successfully: ${sbomFile}`);
}

main();
