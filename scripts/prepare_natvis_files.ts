// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

const sourceDir = path.resolve('debugging_helpers/natvis');
const destDir = path.resolve('qt-cpp/res/natvis');
const timestampFilePath = path.resolve('.natvis-copy-timestamp');
const scriptPath = __filename;

function processNatvisFiles(): boolean {
  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory ${sourceDir} does not exist.`);
    console.log(`Try to run 'git submodule update --init'.`);
    return false;
  }

  // Ensure destination directory exists
  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
  } catch (error) {
    console.error(
      `Error: Failed to create destination directory ${destDir}:`,
      error
    );
    return false;
  }

  // Get all .natvis files from source directory
  let files: string[];
  try {
    files = fs
      .readdirSync(sourceDir)
      .filter((file) => file.endsWith('.natvis'));
  } catch (error) {
    console.error(
      `Error: Failed to read source directory ${sourceDir}:`,
      error
    );
    return false;
  }

  if (files.length === 0) {
    console.error('Error: No .natvis files found in source directory.');
    console.log('Check the state of the git submodule.');
    return false;
  }

  // Get the last run timestamp if it exists
  let lastRunTime = 0;
  if (fs.existsSync(timestampFilePath)) {
    try {
      lastRunTime = parseInt(fs.readFileSync(timestampFilePath, 'utf8'));
    } catch (_) {
      // This is fine. The script probably runs for the first time.
    }
  }

  // Check if the script itself has been modified
  let scriptChanged = false;
  try {
    const scriptStats = fs.statSync(scriptPath);
    const scriptModTime = scriptStats.mtimeMs;
    scriptChanged = scriptModTime > lastRunTime;

    if (scriptChanged && lastRunTime > 0) {
      console.log(
        'Script has been modified since last run. Processing all files.'
      );
    }
  } catch (error) {
    console.error('Error: Failed to check script modification time:', error);
    return false;
  }

  let filesChanged = false;
  let hasErrors = false;

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);

    try {
      const stats = fs.statSync(sourcePath);
      const fileModTime = stats.mtimeMs;

      if (
        fileModTime > lastRunTime ||
        scriptChanged ||
        !fs.existsSync(destPath)
      ) {
        let content = fs.readFileSync(sourcePath, 'utf8');
        content = content.replace(/##NAMESPACE##::/g, '');
        fs.writeFileSync(destPath, content);
        filesChanged = true;
        console.log(`Copied and processed: ${file}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
      hasErrors = true;
    }
  }

  // Update timestamp file with current time if no errors occurred
  if (
    !hasErrors &&
    (filesChanged || scriptChanged || !fs.existsSync(timestampFilePath))
  ) {
    try {
      fs.writeFileSync(timestampFilePath, Date.now().toString());
    } catch (error) {
      console.error('Error: Failed to update timestamp file:', error);
      return false;
    }
  }

  return !hasErrors;
}

try {
  const success = processNatvisFiles();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('Unhandled error:', error);
  process.exit(1);
}
