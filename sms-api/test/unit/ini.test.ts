/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  IniDocument,
  decodeIniKey,
  decodeIniValue,
  encodeIniKey,
  encodeIniValue
} from '../../src/ini';

const EOL = process.platform === 'win32' ? '\r\n' : '\n';

// Exactly what QSettings writes for the Qt.ini groups of the service.
const FIXTURE = [
  '[auth]',
  'oidc_pkce\\access_token=at-1',
  'oidc_pkce\\expires_at=2026-09-24T12:00:00Z',
  'oidc_pkce\\issuer=https://login.qt.io/v1/oidc',
  'pat\\access_token=pat-1',
  'qtaccount\\email=user@example.com',
  '',
  '[telemetry]',
  'organization\\enabled=yes',
  ''
].join(EOL);

describe('IniDocument', () => {
  it('parses the QSettings fixture into slash separated keys', () => {
    const doc = IniDocument.parse(FIXTURE);
    assert.equal(doc.get('auth/oidc_pkce/access_token'), 'at-1');
    assert.equal(doc.get('auth/oidc_pkce/expires_at'), '2026-09-24T12:00:00Z');
    assert.equal(
      doc.get('auth/oidc_pkce/issuer'),
      'https://login.qt.io/v1/oidc'
    );
    assert.equal(doc.get('auth/pat/access_token'), 'pat-1');
    assert.equal(doc.get('auth/qtaccount/email'), 'user@example.com');
    assert.equal(doc.get('telemetry/organization/enabled'), 'yes');
    assert.equal(doc.get('auth/missing'), undefined);
  });

  it('round-trips the fixture byte for byte', () => {
    assert.equal(IniDocument.parse(FIXTURE).serialize(), FIXTURE);
  });

  it('maps [General], [%General] and header-less keys like QSettings', () => {
    const doc = IniDocument.parse(
      ['top=1', '[General]', 'g=2', '[%General]', 'h=3'].join('\n')
    );
    assert.equal(doc.get('top'), '1');
    assert.equal(doc.get('g'), '2');
    assert.equal(doc.get('General/h'), '3');
    const out = new IniDocument();
    out.set('plain', 'x');
    out.set('General/real', 'y');
    assert.equal(
      out.serialize(),
      `[General]${EOL}plain=x${EOL}${EOL}[%General]${EOL}real=y${EOL}`
    );
  });

  it('decodes quoted and escaped values and tolerates spaces around =', () => {
    const doc = IniDocument.parse(
      [
        '[s]',
        'quoted="a, b"',
        'backslash=a\\\\b',
        'quote="x\\"y"',
        'hex=\\x41',
        'trailing=abc   ',
        'spaced = value',
        'at=@@x',
        'str=@String(v)'
      ].join('\n')
    );
    assert.equal(doc.get('s/quoted'), 'a, b');
    assert.equal(doc.get('s/backslash'), 'a\\b');
    assert.equal(doc.get('s/quote'), 'x"y');
    assert.equal(doc.get('s/hex'), 'A');
    assert.equal(doc.get('s/trailing'), 'abc');
    assert.equal(doc.get('s/spaced'), 'value');
    assert.equal(doc.get('s/at'), '@x');
    assert.equal(doc.get('s/str'), 'v');
  });

  it('encodes values and keys like QSettings', () => {
    assert.equal(encodeIniValue('a,b'), '"a,b"');
    assert.equal(encodeIniValue('a;b'), '"a;b"');
    assert.equal(encodeIniValue('a=b'), '"a=b"');
    assert.equal(encodeIniValue(' x'), '" x"');
    assert.equal(encodeIniValue('x '), '"x "');
    assert.equal(encodeIniValue('a"b'), 'a\\"b');
    assert.equal(encodeIniValue('a\\b'), 'a\\\\b');
    assert.equal(encodeIniValue('a\nb'), 'a\\nb');
    assert.equal(encodeIniValue('@x'), '@@x');
    assert.equal(encodeIniValue(''), '');
    assert.equal(
      encodeIniKey('oidc_pkce/access_token'),
      'oidc_pkce\\access_token'
    );
    assert.equal(encodeIniKey('a b'), 'a%20b');
    assert.equal(encodeIniKey('ä'), '%E4');
    assert.equal(encodeIniKey('€'), '%U20AC');
    assert.equal(decodeIniKey('a%20b'), 'a b');
    assert.equal(decodeIniKey('%U20AC'), '€');
    assert.equal(decodeIniKey('x\\y'), 'x/y');
    assert.equal(decodeIniKey('100%'), '100%');
  });

  it('round-trips arbitrary values through encode and decode', () => {
    for (const v of [
      'plain',
      'with space inside',
      ' leading',
      'trailing ',
      'a,b;c=d',
      'quote"and\\slash',
      'tab\tnl\nret\r',
      '@at',
      'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.sig-_',
      'https://login.qt.io/v1/oidc',
      'user+tag@example.com'
    ]) {
      assert.equal(decodeIniValue(encodeIniValue(v)), v, JSON.stringify(v));
    }
  });

  it('appends new keys sorted after the existing ones and keeps positions', () => {
    const doc = IniDocument.parse(
      ['[auth]', 'zeta\\k=1', 'alpha\\k=2', ''].join(EOL)
    );
    doc.set('auth/beta/k', '3');
    doc.set('auth/alpha/k', '2b');
    assert.equal(
      doc.serialize(),
      ['[auth]', 'zeta\\k=1', 'alpha\\k=2b', 'beta\\k=3', ''].join(EOL)
    );
  });

  it('orders new sections after existing ones', () => {
    const doc = IniDocument.parse(['[zzz]', 'k=1', ''].join(EOL));
    doc.set('auth/pat/access_token', 'p');
    assert.equal(
      doc.serialize(),
      ['[zzz]', 'k=1', '', '[auth]', 'pat\\access_token=p', ''].join(EOL)
    );
  });

  it('removeGroup removes only the group and drops empty sections', () => {
    const doc = IniDocument.parse(FIXTURE);
    doc.removeGroup('auth/oidc_pkce');
    assert.deepEqual(doc.keys().sort(), [
      'auth/pat/access_token',
      'auth/qtaccount/email',
      'telemetry/organization/enabled'
    ]);
    doc.removeGroup('telemetry/organization');
    assert.ok(!doc.serialize().includes('[telemetry]'));
    doc.remove('auth/pat/access_token');
    doc.remove('auth/qtaccount/email');
    assert.equal(doc.serialize(), '');
  });

  it('writes back raw values of foreign keys unchanged', () => {
    const text = ['[other]', 'k=weird\\qvalue , x', ''].join(EOL);
    const doc = IniDocument.parse(text);
    doc.set('auth/pat/access_token', 'p');
    doc.remove('auth/pat/access_token');
    assert.equal(doc.serialize(), text);
  });
});
