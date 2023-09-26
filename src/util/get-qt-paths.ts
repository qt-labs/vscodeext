import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function matchesVersionPattern(path: string): boolean {
  // Check if the first character of the path is a digit (0-9)
  return /^([0-9]+\.)+/.test(path);
}

// Function to recursively search a directory for Qt installations
export function findQtInstallations(dir: string): string[] {
  const qtInstallations: string[] = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (matchesVersionPattern(item)) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory() && matchesVersionPattern(item)) {
        for (const subdir of fs.readdirSync(fullPath)) {
          const subdirFullPath = path.join(fullPath, subdir);
          const binPath = path.join(subdirFullPath, 'bin');
          const qtConfPath = path.join(binPath, 'qt.conf');
          if (fs.existsSync(qtConfPath) && fs.statSync(qtConfPath).isFile()) {
            qtInstallations.push(subdirFullPath);
          }
        }
      }
    }
  }
  return qtInstallations;
}

export function findFilesInDir(
  startPath: string,
  filterExtension: string
): string[] {
  if (!fs.existsSync(startPath)) {
    console.log('No directory:', startPath);
    return [];
  }

  const results: string[] = [];

  function walkDir(currentPath: string): void {
    const files = fs.readdirSync(currentPath);
    for (let i = 0; i < files.length; i++) {
      const curFile = path.join(currentPath, files[i]);
      if (fs.statSync(curFile).isDirectory()) {
        walkDir(curFile);
      } else if (path.extname(curFile) === filterExtension) {
        results.push(curFile);
      }
    }
  }

  walkDir(startPath);
  return results;
}

export async function findFilesInWorkspace(
  filterExtension: string
): Promise<string[]> {
  // Get list of all the files in the workspace folders recursively
  let files: string[] = [];
  // Create an array to hold the promises
  const promises = [];
  for (const workspaceFolder of vscode.workspace.workspaceFolders || []) {
    // Define the search pattern
    const pattern = new vscode.RelativePattern(
      workspaceFolder,
      filterExtension
    );

    // Use findFiles to search for .pro files
    promises.push(
      vscode.workspace.findFiles(pattern, null).then((matches) => {
        files = files.concat(
          matches.map((uri) => {
            return uri.path;
          })
        );
      })
    );
  }
  await Promise.all(promises);
  return files;
}
