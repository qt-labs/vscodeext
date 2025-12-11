// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';
import { QRCParser } from 'qt-lib';
import { createLogger } from 'qt-lib';

const logger = createLogger('qrc-resource-finder');

/**
 * Represents a resource in the QRC virtual file system.
 * Can be either a file or a directory.
 */
interface QrcResource {
  type: 'file' | 'directory';
  /** For files: the real file system path. For directories: undefined */
  realPath?: string;
  /** For directories: the child entries (file/dir names only, not full paths) */
  children?: string[];
}

/**
 * QrcResourceFinder builds a virtual directory structure from QRC files
 * and can resolve both file and directory requests.
 */
export class QrcResourceFinder {
  private readonly _qrcParser: QRCParser;
  private _buildDirs: string[] = [];
  /** Maps QRC virtual paths to resources */
  private readonly _resourceMap = new Map<string, QrcResource>();
  /** Tracks if we need to rebuild the resource map */
  private _isDirty = true;

  constructor() {
    this._qrcParser = new QRCParser();
  }

  set buildDirs(dirs: string[]) {
    this._buildDirs = dirs;
    this._isDirty = true;
  }

  get buildDirs() {
    return this._buildDirs;
  }

  /**
   * Finds a resource (file or directory) in the QRC virtual file system.
   * Returns the resource information including type and real path (for files).
   */
  async findResource(qrcPath: string) {
    // Ensure the resource map is up to date
    if (this._isDirty) {
      await this.buildResourceMap();
    }

    // Normalize the path (ensure it starts with /)
    const normalizedPath = qrcPath.startsWith(':')
      ? qrcPath.substring(1)
      : qrcPath;

    const resource = this._resourceMap.get(normalizedPath);

    if (resource) {
      logger.info(
        `QRC resource found for ${qrcPath}: type=${resource.type}, realPath=${resource.realPath ?? 'N/A'}, children=${resource.children?.length ?? 0}`
      );
    } else {
      logger.warn(
        `QRC resource not found for ${qrcPath} (normalized: ${normalizedPath})`
      );
    }

    return resource;
  }

  /**
   * Builds the complete resource map from all QRC files.
   * This creates both file entries and synthesized directory entries.
   */
  private async buildResourceMap() {
    logger.info('Building QRC resource map');
    this._resourceMap.clear();

    // Find all QRC files in workspace and build directories
    const allQrcFiles = await this.findAllQrcFiles();
    logger.info(`Found ${allQrcFiles.length} QRC files`);

    // Parse all QRC files
    for (const qrcFile of allQrcFiles) {
      this.processQrcFile(qrcFile.fsPath);
    }

    // Synthesize directory entries from file paths
    this.synthesizeDirectories();

    this._isDirty = false;
    logger.info(`Resource map built with ${this._resourceMap.size} entries`);
  }

  /**
   * Finds all QRC files in the workspace and build directories.
   */
  private async findAllQrcFiles() {
    const allQrcFiles = await vscode.workspace.findFiles('**/*.qrc');

    // Also search in build directories
    for (const buildDir of this._buildDirs) {
      const pattern = new vscode.RelativePattern(buildDir, '**/*.qrc');
      const additionalQrcFiles = await vscode.workspace.findFiles(pattern);
      allQrcFiles.push(...additionalQrcFiles);
    }

    return allQrcFiles;
  }

  /**
   * Processes a single QRC file and adds its entries to the resource map.
   */
  private processQrcFile(qrcFilePath: string) {
    try {
      // Parse with includeAllFiles=true to get all resources (images, conf files, etc.)
      const fileMapping: Map<string, string> | undefined =
        this._qrcParser.parseQRCFile(qrcFilePath, true);
      if (!fileMapping) {
        return;
      }

      // Add each file entry to the resource map
      for (const [qrcPath, realPath] of fileMapping.entries()) {
        // Skip if the real path is a directory - these will be synthesized later
        if (fs.existsSync(realPath) && fs.statSync(realPath).isDirectory()) {
          logger.info(
            `Skipping directory entry in QRC: ${qrcPath} -> ${realPath}`
          );
          continue;
        }

        // Normalize path (ensure it starts with /)
        const normalizedPath: string = qrcPath.startsWith('/')
          ? qrcPath
          : `/${qrcPath}`;

        this._resourceMap.set(normalizedPath, {
          type: 'file',
          realPath: realPath
        });
      }
    } catch (error) {
      logger.error(`Error processing QRC file ${qrcFilePath}:`, String(error));
    }
  }

  /**
   * Synthesizes directory entries from file paths.
   * For example, if we have files:
   *   /qt/qml/demos/calqlatr/content/Display.qml
   *   /qt/qml/demos/calqlatr/content/NumberPad.qml
   * We create directory entries for:
   *   /qt/qml/demos/calqlatr/content (containing: Display.qml, NumberPad.qml)
   *   /qt/qml/demos/calqlatr (containing: content, Main.qml)
   *   /qt/qml/demos (containing: calqlatr)
   *   etc.
   */
  private synthesizeDirectories() {
    // Map to collect children for each directory
    const directoryChildren = new Map<string, Set<string>>();

    // Process each file path to build directory structure
    for (const [qrcPath, resource] of this._resourceMap.entries()) {
      if (resource.type !== 'file') {
        continue;
      }

      // Split path into parts
      const parts = qrcPath.split('/').filter((p) => p);
      let currentPath = '';

      // Build directory hierarchy
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part) {
          continue;
        }

        const parentPath = currentPath;
        currentPath = currentPath + '/' + part;

        // Add this directory to its parent's children
        if (!directoryChildren.has(parentPath)) {
          directoryChildren.set(parentPath, new Set());
        }
        const parentChildren = directoryChildren.get(parentPath);
        if (parentChildren) {
          parentChildren.add(part);
        }
      }

      // Add the file to its parent directory's children
      const fileName = parts[parts.length - 1];
      const parentDir =
        parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '';
      if (!directoryChildren.has(parentDir)) {
        directoryChildren.set(parentDir, new Set());
      }
      const parentChildren = directoryChildren.get(parentDir);
      if (parentChildren && fileName) {
        parentChildren.add(fileName);
      }
    }

    // Create directory entries in the resource map
    for (const [dirPath, childrenSet] of directoryChildren.entries()) {
      const normalizedPath = dirPath || '/';
      // Only create directory entry if it doesn't already exist as a file
      if (!this._resourceMap.has(normalizedPath)) {
        this._resourceMap.set(normalizedPath, {
          type: 'directory',
          children: Array.from(childrenSet).sort()
        });
        logger.info(
          `Synthesized directory: ${normalizedPath} with children: ${Array.from(childrenSet).join(', ')}`
        );
      } else {
        // If it exists as a file, we still need to track its directory children
        // This happens if both a file and directory have the same path prefix
        const existing = this._resourceMap.get(normalizedPath);
        if (existing && existing.type === 'directory') {
          existing.children = Array.from(childrenSet).sort();
        }
      }
    }
  }

  /**
   * Marks the resource map as dirty, requiring a rebuild on next access.
   */
  invalidate() {
    this._isDirty = true;
  }

  /**
   * Gets all resources for debugging purposes.
   */
  getAllResources() {
    return new Map(this._resourceMap);
  }
}
