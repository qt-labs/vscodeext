// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';

import {
  QmlDebugConnection,
  QmlDebugConnectionManager
} from '@debug/debug-connection.mjs';
import { QmlPreviewClient, FpsInfo } from './preview-client.mts';
import { QrcResourceFinder } from './qrc-resource-finder.mts';
import { createLogger, delay, IsWindows } from 'qt-lib';

const logger = createLogger('qml-preview-manager');

/**
 * File loader function type
 * Returns file contents or failure status
 */
type FileLoader = (filename: string) => {
  success: boolean;
  contents: Buffer;
};

/**
 * File classifier function type
 * Returns true if file can be hot-reloaded, false if requires restart
 */
type FileClassifier = (filename: string) => boolean;

/**
 * FPS handler function type
 */
type FpsHandler = (fps: FpsInfo) => void;

/**
 * Settings for QML Preview
 */
interface QmlPreviewSettings {
  fileLoader?: FileLoader;
  fileClassifier?: FileClassifier;
  fpsHandler?: FpsHandler;
}

/**
 * QML Preview Connection Manager
 * TypeScript implementation following the patterns from QML Debug Connection Manager
 * Manages the connection to the QML Preview service and handles file watching
 *
 * Architecture:
 * - Extends QmlDebugConnectionManager (inherits connection lifecycle)
 * - Creates and manages QmlPreviewClient instance
 * - Handles file system watching and change notifications
 * - Maps local file paths to QRC resources
 */
export class QmlPreviewConnectionManager extends QmlDebugConnectionManager {
  private _previewClient?: QmlPreviewClient;
  private readonly _qrcFinder: QrcResourceFinder;
  private _fileSystemWatcher?: vscode.FileSystemWatcher;
  private _lastLoadedUrl?: URL;
  private readonly _settings: QmlPreviewSettings = {};
  private _buildDirs: string[] = [];
  // Map from local file paths to QRC paths (for file change handling)
  private readonly _pathMap = new Map<string, string>();
  // Set of files being actively watched (Qt Creator pattern)
  private readonly _watchedFiles = new Set<string>();
  // Signals (Qt Creator pattern: signals for communication with external components)
  // Maps to: signals in QmlPreviewConnectionManager
  private readonly _onRestart = new vscode.EventEmitter<void>();
  private readonly _onLanguageChange = new vscode.EventEmitter<string>();
  private readonly _onDebugServiceUnavailable = new vscode.EventEmitter<void>();
  constructor() {
    super();
    this._qrcFinder = new QrcResourceFinder();
    logger.info('QmlPreviewConnectionManager created');
  }

  /**
   * Normalize a file path for consistent comparisons across platforms
   * - Converts backslashes to forward slashes
   * - Lowercases the path on Windows (since Windows paths are case-insensitive)
   */
  private static normalizePath(filePath: string): string {
    let normalized = filePath.replace(/\\/g, '/');
    // On Windows, paths are case-insensitive, so normalize to lowercase
    if (IsWindows) {
      normalized = normalized.toLowerCase();
    }
    return normalized;
  }

  // Signal accessors (public event properties)
  // Maps to: Qt signals that can be connected to
  get onRestart() {
    return this._onRestart.event;
  }

  get onLanguageChange() {
    return this._onLanguageChange.event;
  }

  get onDebugServiceUnavailable() {
    return this._onDebugServiceUnavailable.event;
  }

  /**
   * Set build directories for QRC resource finding
   */
  set buildDirs(dirs: string[]) {
    this._buildDirs = dirs;
    this._qrcFinder.buildDirs = dirs;
    logger.info('Build directories set:', JSON.stringify(dirs));
  }

  get buildDirs() {
    return this._buildDirs;
  }

  /**
   * Set custom file loader
   */
  setFileLoader(loader: FileLoader) {
    this._settings.fileLoader = loader;
    logger.info('Custom file loader set');
  }

  /**
   * Set custom file classifier
   */
  setFileClassifier(classifier: FileClassifier) {
    this._settings.fileClassifier = classifier;
    logger.info('Custom file classifier set');
  }

  /**
   * Set custom FPS handler
   */
  setFpsHandler(handler: FpsHandler) {
    this._settings.fpsHandler = handler;
    logger.info('Custom FPS handler set');
  }

  /**
   * Override to create QML Preview client when connection is established
   * Maps to QmlDebugConnectionManager::createClients()
   */
  override createConnection() {
    logger.info('Creating connection and preview client');
    super.createConnection();
    if (this.connection) {
      this.createPreviewClient(this.connection);
    }
  }

  /**
   * Create and configure the QML Preview client
   * Connects all signal handlers following the signal/slot pattern
   * Maps to Qt Creator's QmlPreviewConnectionManager::createPreviewClient()
   */
  private createPreviewClient(connection: QmlDebugConnection) {
    logger.info('Creating QmlPreviewClient');
    this._previewClient = new QmlPreviewClient(connection);

    // Connect to connection's onConnected event (fires after hello message)
    connection.onConnected(() => {
      logger.info('QML Preview connection established (got hello)');
      this._connectionOpened.fire();
    });

    // Connect signals to slots (using event pattern)
    // Maps to Qt's connect() calls

    // Signal: pathRequested -> Slot: handlePathRequest
    // This is called when the QML app requests a file or directory
    this._previewClient.onPathRequested(async (requestPath) => {
      logger.info('===> Processing path request:', `"${requestPath}"`);
      await this.handlePathRequest(requestPath);
    });

    // Signal: errorReported -> Slot: log and show error
    this._previewClient.onErrorReported((error) => {
      logger.info('<=== Error received from Qt:', `"${error}"`);
      logger.error('QML Preview error:', error);
      void vscode.window.showErrorMessage(`QML Preview: ${error}`);
    });

    // Signal: fpsReported -> Slot: handle FPS or log
    this._previewClient.onFpsReported((fps) => {
      if (this._settings.fpsHandler) {
        this._settings.fpsHandler(fps);
      } else {
        logger.info(`QML Preview FPS: ${fps.numSyncs.toString()}`);
      }
    });

    // Signal: debugServiceUnavailable -> Slot: show warning
    this._previewClient.onDebugServiceUnavailable(() => {
      logger.info('QmlPreviewClient reported Debug Service Unavailable');
      this._onDebugServiceUnavailable.fire();
    });

    logger.info('QmlPreviewClient created and connected');
  }

  /**
   * Load a QML URL in the preview
   * Maps to Qt Creator's loadUrl functionality
   */
  loadUrl(url: string) {
    logger.info('Loading URL:', url);
    const parsedUrl = QmlPreviewConnectionManager.createUrlFromPath(url);
    if (parsedUrl) {
      this._lastLoadedUrl = parsedUrl;
    } else {
      delete this._lastLoadedUrl;
    }
    this._previewClient?.loadUrl(url);
  }

  /**
   * Register a file that the target application already loaded itself.
   *
   * Qt Bridge applications load their root QML during normal startup, so the
   * extension must not send an initial loadUrl command. Still, hot reload needs
   * the same local-file to target-url mapping that loadUrl/path requests create
   * for CMake and PySide previews.
   */
  registerLoadedFile(localPath: string, targetUrl: string) {
    const parsedUrl = QmlPreviewConnectionManager.createUrlFromPath(targetUrl);
    if (!parsedUrl) {
      logger.warn('Failed to register loaded file target URL:', targetUrl);
      return;
    }

    const normalizedLocalPath = QmlPreviewConnectionManager.normalizePath(localPath);
    this._lastLoadedUrl = parsedUrl;
    this._pathMap.set(normalizedLocalPath, targetUrl);
    this.addFileToWatcher(localPath);
    logger.info('Registered loaded file:', `"${normalizedLocalPath}"`, '->', `"${targetUrl}"`);
  }

  /**
   * Rerun the QML application
   */
  rerun() {
    logger.info('Rerunning application');
    this._previewClient?.rerun();
  }

  /**
   * Set animation speed factor
   * Maps to Qt Creator's QmlPreviewClient::setAnimationSpeed()
   */
  setAnimationSpeed(factor: number) {
    logger.info('Setting animation speed:', String(factor));
    this._previewClient?.setAnimationSpeed(factor);
  }

  /**
   * Change language for QML translation preview
   * Maps to Qt Creator's language signal
   * @param locale - Language locale (e.g., "en_US", "de_DE")
   */
  changeLanguage(locale: string) {
    logger.info('Changing language to:', locale);
    this._onLanguageChange.fire(locale);
    // Note: Full i18n support would require QmlDebugTranslationClient
    // which is not yet implemented
  }

  /**
   * Create URL from QML path string
   * Converts local file paths, QRC paths, or existing URLs to proper URL objects
   * Maps to Qt Creator's QmlPreviewFileOnTargetFinder::findUrl()
   * @param path - Path string (may be URL, QRC path, or filesystem path)
   * @returns URL object or undefined if parsing fails
   */
  private static createUrlFromPath(path: string) {
    try {
      if (path.startsWith('qrc:')) {
        // Already has qrc: protocol, use as-is
        return new URL(path);
      } else if (path.startsWith(':')) {
        // QRC resource path without protocol (e.g., ":/path")
        // Remove leading ':' to avoid double colon (qrc::)
        return new URL('qrc:' + path.substring(1));
      } else if (path.startsWith('file://')) {
        // Already a file URL
        return new URL(path);
      } else if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
        // Local filesystem path (Unix absolute path or Windows drive path)
        // Convert to file:// URL, similar to Qt's QUrl::fromLocalFile()
        return new URL('file://' + path);
      } else {
        // Try to parse as standard URL
        return new URL(path);
      }
    } catch {
      logger.warn('Failed to create URL from:', path);
      return undefined;
    }
  }

  /**
   * Handle path request from the QML application
   * This is the main slot that handles file/directory requests
   * Maps to the pathRequested signal handler
   */
  private async handlePathRequest(requestedPath: string) {
    logger.info('<=== Path requested:', `"${requestedPath}"`);

    if (!this._previewClient) {
      logger.warn('Preview client not available');
      return;
    }

    // Check if this is a QRC path (starts with : or qrc:)
    const isQrcPath =
      requestedPath.startsWith(':') || requestedPath.startsWith('qrc:');

    if (isQrcPath) {
      await this.handleQrcPathRequest(requestedPath);
    } else {
      this.handleFileSystemPathRequest(requestedPath);
    }
  }

  /**
   * Handle QRC resource path request
   * Maps to Qt Creator's pathRequested handler for QRC paths
   */
  private async handleQrcPathRequest(requestedPath: string) {
    if (!this._previewClient) {
      return;
    }

    // Find the QRC resource
    const resource = await this._qrcFinder.findResource(requestedPath);

    if (resource) {
      if (resource.type === 'directory') {
        // Virtual directory - return synthesized directory listing
        logger.info(
          'Announcing directory:',
          `"${requestedPath}"`,
          'with',
          String(resource.children?.length ?? 0),
          'entries'
        );
        this._previewClient.announceDirectory(
          requestedPath,
          resource.children ?? []
        );
        return;
      } else if (resource.realPath) {
        // File - map it and load contents
        // This is key: map the real filesystem path to the QRC path
        // so we can find it later during file change events
        const normalizedRealPath = QmlPreviewConnectionManager.normalizePath(
          resource.realPath
        );
        this._pathMap.set(normalizedRealPath, requestedPath);
        logger.info('Mapped QRC:', normalizedRealPath, '->', requestedPath);

        const loader =
          this._settings.fileLoader ??
          ((f: string) => QmlPreviewConnectionManager.defaultFileLoader(f));
        const { success, contents } = loader(resource.realPath);

        if (success) {
          // Add file to watcher (Qt Creator pattern: add files when requested)
          this.addFileToWatcher(resource.realPath);

          logger.info(
            'Announcing file:',
            `"${requestedPath}"`,
            'size:',
            String(contents.length),
            'bytes'
          );
          this._previewClient.announceFile(requestedPath, contents);

          // Track main QML file
          if (!this._lastLoadedUrl && requestedPath.endsWith('.qml')) {
            const parsedUrl =
              QmlPreviewConnectionManager.createUrlFromPath(requestedPath);
            if (parsedUrl) {
              this._lastLoadedUrl = parsedUrl;
              logger.info('Set main URL to:', this._lastLoadedUrl.toString());
            }
          }
          return;
        }
      }
    }

    // QRC path not found
    logger.info('Path not found, sending error:', `"${requestedPath}"`);
    this._previewClient.announceError(requestedPath);
  }

  /**
   * Handle file system path request
   * Maps to Qt Creator's pathRequested handler for filesystem paths
   */
  private handleFileSystemPathRequest(requestedPath: string) {
    if (!this._previewClient) {
      return;
    }

    const fsPath = requestedPath;
    if (fs.existsSync(fsPath)) {
      const stats = fs.statSync(fsPath);

      if (stats.isDirectory()) {
        // Directory - read contents
        const entries = fs.readdirSync(fsPath);
        logger.info(
          'Announcing directory:',
          `"${requestedPath}"`,
          'with',
          String(entries.length),
          'entries'
        );
        this._previewClient.announceDirectory(requestedPath, entries);
        return;
      } else if (stats.isFile()) {
        // File - load contents
        const loader =
          this._settings.fileLoader ??
          ((f: string) => QmlPreviewConnectionManager.defaultFileLoader(f));
        const { success, contents } = loader(fsPath);

        if (success) {
          // Add file to watcher (Qt Creator pattern: dynamically add files)
          this.addFileToWatcher(fsPath);

          // Store the path mapping (identity mapping for filesystem paths)
          // Normalize path for consistent lookups
          const normalizedFsPath =
            QmlPreviewConnectionManager.normalizePath(fsPath);
          this._pathMap.set(normalizedFsPath, requestedPath);
          logger.info(
            'Mapped filesystem:',
            normalizedFsPath,
            '->',
            requestedPath
          );

          logger.info(
            'Announcing file:',
            `"${requestedPath}"`,
            'size:',
            String(contents.length),
            'bytes'
          );
          this._previewClient.announceFile(requestedPath, contents);

          // Set as main URL if this is a QML file and we haven't set one yet
          // This mirrors the QRC handler behavior
          if (!this._lastLoadedUrl && requestedPath.endsWith('.qml')) {
            const parsedUrl =
              QmlPreviewConnectionManager.createUrlFromPath(requestedPath);
            if (parsedUrl) {
              this._lastLoadedUrl = parsedUrl;
              logger.info('Set main URL to:', this._lastLoadedUrl.toString());
            }
          }
          return;
        }
      }
    }

    // Path not found
    logger.info('Path not found, sending error:', `"${requestedPath}"`);
    this._previewClient.announceError(requestedPath);
  }

  /**
   * Add a file to the file system watcher
   * Qt Creator pattern: Files are added dynamically when requested
   * Maps to: m_fileSystemWatcher.addFile() in Qt Creator
   */
  private addFileToWatcher(filePath: string) {
    // Normalize path for consistent comparisons (Windows uses backslashes)
    const normalizedPath = QmlPreviewConnectionManager.normalizePath(filePath);

    // Check if already watching
    if (this._watchedFiles.has(normalizedPath)) {
      return;
    }

    // Mark as watched
    this._watchedFiles.add(normalizedPath);
    logger.info('Added file to watcher:', `"${normalizedPath}"`);
  }

  /**
   * Default file loader implementation
   * Tries to read from open editor first (for unsaved changes), then from disk
   */
  private static defaultFileLoader(filename: string) {
    try {
      // Try to get from open editor first (unsaved changes)
      const uri = vscode.Uri.file(filename);
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uri.toString()
      );

      if (doc && !doc.isClosed) {
        const contents = Buffer.from(doc.getText(), 'utf8');
        logger.info(
          '===> Reading from open document:',
          `"${filename}"`,
          'bytes:',
          String(contents.length)
        );
        return { success: true, contents };
      }

      // Fallback to reading from disk
      const contents = fs.readFileSync(filename);
      logger.info(
        '===> Reading from disk:',
        `"${filename}"`,
        'bytes:',
        String(contents.length)
      );
      return { success: true, contents };
    } catch (error) {
      logger.error('Error loading file:', `"${filename}"`, String(error));
      return { success: false, contents: Buffer.alloc(0) };
    }
  }

  /**
   * Default file classifier implementation
   * Returns false for files that require full restart (like qtquickcontrols2.conf)
   */
  private static defaultFileClassifier(filename: string) {
    // qtquickcontrols2.conf changes require full restart
    if (filename.endsWith('qtquickcontrols2.conf')) {
      return false;
    }
    // Most QML files can be hot-reloaded
    return true;
  }

  /**
   * Setup file system watcher for dynamically watched files
   * Qt Creator uses Utils::FileSystemWatcher with dynamic file additions
   * We use VSCode's FileSystemWatcher but track files manually
   */
  setupFileWatcher() {
    logger.info('Setting up file system watcher');

    // Watch for QML and JS file changes across workspace
    this._fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{qml,js}',
      false, // ignoreCreateEvents
      false, // ignoreChangeEvents
      true // ignoreDeleteEvents
    );

    // Connect file change signal to handler (for saved file changes on disk)
    // Maps to: connect(&m_fileSystemWatcher, &FileSystemWatcher::fileChanged, ...)
    this._fileSystemWatcher.onDidChange(async (uri) => {
      // Normalize path for consistent comparisons (Windows uses backslashes)
      const changedFile = QmlPreviewConnectionManager.normalizePath(uri.fsPath);

      // Only process files we're actively watching (Qt Creator pattern)
      if (!this._watchedFiles.has(changedFile)) {
        logger.info(
          'File changed but not in watched list:',
          `"${changedFile}"`
        );
        return;
      }

      logger.info('===> File changed (disk):', `"${changedFile}"`);
      await this.handleFileChange(changedFile);
    });

    // Connect file creation signal to cache clear
    this._fileSystemWatcher.onDidCreate((uri) => {
      logger.info('File created event:', uri.fsPath);
      // Clear cache when new files are added
      this._previewClient?.clearCache();
    });

    logger.info('File system watcher configured');
  }

  /**
   * Handle file change event
   * Implements hot-reload logic matching Qt Creator's implementation
   * Maps to: connect(&m_fileSystemWatcher, &FileSystemWatcher::fileChanged, ...)
   */
  private async handleFileChange(changedFile: string) {
    if (!this._previewClient) {
      logger.info('Skipping: preview client not available');
      return;
    }

    if (!this._lastLoadedUrl) {
      logger.info('Skipping: no lastLoadedUrl');
      return;
    }

    // Load the changed file
    const loader =
      this._settings.fileLoader ??
      ((f: string) => QmlPreviewConnectionManager.defaultFileLoader(f));
    const { success, contents } = loader(changedFile);

    if (!success) {
      logger.info('Failed to load file content');
      return;
    }

    // Log content info (matching Qt Creator's detailed logging)
    logger.info('Loaded content:', String(contents.length), 'bytes');

    // Check if file can be hot-reloaded or requires restart
    const classifier =
      this._settings.fileClassifier ??
      ((f: string) => QmlPreviewConnectionManager.defaultFileClassifier(f));

    if (!classifier(changedFile)) {
      logger.info('File requires full restart (classifier check failed)');
      // Emit restart signal (Qt Creator pattern)
      // External components can listen to this and decide how to restart
      this._onRestart.fire();
      // Also trigger rerun directly as fallback
      this._previewClient.rerun();
      return;
    }

    // Use the path mapping to find the remote/QRC path
    // This is the "target file finder" equivalent
    const remotePath = this._pathMap.get(changedFile);

    logger.info(
      'Path mapping result:',
      'found=',
      remotePath ? 'yes' : 'no',
      remotePath ? `remote="${remotePath}"` : ''
    );

    if (remotePath) {
      logger.info(
        '===> Announcing file update:',
        `"${remotePath}"`,
        'for local file:',
        `"${changedFile}"`,
        'bytes:',
        String(contents.length)
      );
      this._previewClient.announceFile(remotePath, contents);
    } else {
      logger.info('Clearing cache (path mapping failed)');
      this._previewClient.clearCache();
    }

    logger.info(
      '===> Reloading with URL:',
      `"${this._lastLoadedUrl.toString()}"`,
      'scheme:',
      `"${this._lastLoadedUrl.protocol}"`,
      'path:',
      `"${this._lastLoadedUrl.pathname}"`
    );

    // Small delay to ensure file announcement is processed first
    await delay(100);
    this._previewClient.loadUrl(this._lastLoadedUrl.toString());
  }

  /**
   * Clear the preview cache
   */
  clearCache() {
    logger.info('Clearing cache');
    this._previewClient?.clearCache();
  }

  /**
   * Check if preview is connected
   */
  override isConnected() {
    const connected = this._previewClient !== undefined && super.isConnected();
    // logger.info('Is connected:', String(connected));
    return connected;
  }

  /**
   * Clean up resources
   * Dispose of file watcher and preview client
   * Maps to: destroyClients() in Qt Creator
   */
  override dispose() {
    logger.info('Disposing QmlPreviewConnectionManager');

    // Call base class dispose first to close connection
    super.dispose();

    // Then clean up our own resources
    this._fileSystemWatcher?.dispose();
    this._previewClient?.dispose();

    // Dispose event emitters
    this._onRestart.dispose();
    this._onLanguageChange.dispose();
    this._onDebugServiceUnavailable.dispose();

    // Clear tracked data structures
    this._watchedFiles.clear();
    this._pathMap.clear();
  }
}
