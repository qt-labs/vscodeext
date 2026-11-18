/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Manual integration test for the OIDC login against a real Qt account login
 * server. It opens the system browser, so it is not part of the automated
 * tests.
 *
 *   npm run test:integration:auth -- [options]
 *
 * Options (the environment overrides of sms-api apply as well):
 *   --issuer <url>       issuer URL           (QT_ACCOUNT_OIDC_ISSUER_URL)
 *   --client-id <id>     client id            (QT_ACCOUNT_OIDC_CLIENT_ID)
 *   --scopes "<a b c>"   scopes               (QT_ACCOUNT_OIDC_SCOPES)
 *   --port <n>           loopback redirect port (QT_ACCOUNT_OIDC_REDIRECT_PORT)
 *   --no-resource        omit the resource parameter
 *   --settings <path>    Qt.ini to use; default is a temporary file that is
 *                        deleted afterwards
 *   --keep               keep the temporary Qt.ini
 *   --no-browser         only print the URL instead of opening the browser
 *
 * The script logs in, prints the account email and the token expiry, then
 * forces the access token to count as expired and renews it, and finally
 * acquires a bearer token through BearerTokenProvider. Token values are
 * never printed.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  BearerTokenProvider,
  OidcAuthenticator,
  QtCredentialStorage,
  defaultOidcClientConfig,
  type OidcClientConfig
} from '../src';

interface Options {
  config: OidcClientConfig;
  settingsPath: string | undefined;
  keep: boolean;
  browser: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const config = defaultOidcClientConfig();
  const options: Options = {
    config,
    settingsPath: undefined,
    keep: false,
    browser: true
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case '--issuer':
        config.issuerUrl = next ?? config.issuerUrl;
        i++;
        break;
      case '--client-id':
        config.clientId = next ?? config.clientId;
        i++;
        break;
      case '--scopes':
        config.scopes = next ?? config.scopes;
        i++;
        break;
      case '--port':
        config.redirectPort = Number.parseInt(next ?? '0', 10);
        i++;
        break;
      case '--no-resource':
        config.resource = '';
        break;
      case '--settings':
        options.settingsPath = next;
        i++;
        break;
      case '--keep':
        options.keep = true;
        break;
      case '--no-browser':
        options.browser = false;
        break;
      default:
        break;
    }
  }
  return options;
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
}

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.on('error', (err) => {
    log(`Cannot open the browser (${err.message}), open the URL by hand.`);
  });
  child.unref();
}

async function main(): Promise<void> {
  const options = parseArgs();
  const tempDir = options.settingsPath
    ? undefined
    : fs.mkdtempSync(path.join(os.tmpdir(), 'sms-oidc-integ-'));
  const settingsPath =
    options.settingsPath ?? path.join(tempDir ?? '', 'Qt.ini');

  const storage = new QtCredentialStorage(settingsPath);
  storage.onLog = (level, message) => {
    log(`[storage:${level}] ${message}`);
  };
  const auth = new OidcAuthenticator(storage, {
    config: options.config,
    onLog: (level, message) => {
      log(`[oidc:${level}] ${message}`);
    }
  });
  auth.onAuthorizationUrl = (url) => {
    log(
      'Log in to your Qt Account in the browser. If it does not open, open this URL:'
    );
    console.log(url);
    if (options.browser) {
      openBrowser(url);
    }
  };

  log(`Issuer:    ${options.config.issuerUrl}`);
  log(`Client id: ${options.config.clientId}`);
  log(`Scopes:    ${options.config.scopes}`);
  log(`Settings:  ${settingsPath}`);

  let failed = false;
  try {
    log('TEST: login');
    await auth.login();
    const tokens = storage.oidcTokens();
    log(
      `  PASS. email=${storage.accountEmail || '(unknown)'} sub=${tokens.sub}`
    );
    log(
      `  access token length ${String(tokens.accessToken.length)}, refresh token ${tokens.refreshToken ? 'present' : 'MISSING'}, id token ${tokens.idToken ? 'present' : 'MISSING'}, expires ${tokens.expiresAt?.toISOString() ?? '(unknown)'}`
    );

    log('TEST: refresh (access token forced to expired)');
    storage.storeRenewedOidcTokens(
      { ...tokens, expiresAt: new Date(Date.now() - 1000) },
      tokens.refreshToken
    );
    await auth.refresh();
    const renewed = storage.oidcTokens();
    log(
      `  PASS. access token ${renewed.accessToken === tokens.accessToken ? 'unchanged' : 'replaced'}, refresh token ${renewed.refreshToken === tokens.refreshToken ? 'unchanged' : 'rotated'}, expires ${renewed.expiresAt?.toISOString() ?? '(unknown)'}`
    );

    log('TEST: BearerTokenProvider.acquire()');
    const bearer = new BearerTokenProvider(storage, auth);
    const token = await bearer.acquire();
    log(`  PASS. bearer token length ${String(token.length)}`);
  } catch (err) {
    failed = true;
    log(`  FAIL: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (tempDir && !options.keep) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } else {
      log(`Settings kept at ${settingsPath}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

void main();
