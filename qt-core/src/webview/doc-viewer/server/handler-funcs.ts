// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';

import { getScriptToInject } from './script-to-inject';
import { type HttpContext, sendData, sendNotFound } from './common';

export type HandlerFunc = (c: HttpContext) => boolean;

export function replaceCss(c: HttpContext, css: string) {
  // <head>
  //   ...
  //   <link rel="stylesheet" type="text/css" href="style/offline-simple.css" />
  //   <script type="text/javascript">
  //     document.getElementsByTagName("link").item(0).setAttribute("href", "style/offline.css");
  //     // loading style sheet breaks anchors that were jumped to before
  //     // so force jumping to anchor again
  //     setTimeout(function() {
  //         var anchor = location.hash;
  //         // need to jump to different anchor first (e.g. none)
  //         location.hash = "#";
  //         setTimeout(function() {
  //             location.hash = anchor;
  //         }, 0);
  //     }, 0);
  //   </script>
  // </head>

  const skip = c.req.fileName === 'offline-simple.css';
  const replace = c.req.fileName === 'offline.css';

  if (skip || replace) {
    sendData(c, skip ? '' : css);
    return true;
  }

  return false;
}

export function injectScriptToHtml(c: HttpContext) {
  if (!c.req.fileName.endsWith('.html')) {
    return false;
  }

  fs.readFile(c.req.filePath, (err, data) => {
    if (err) {
      sendNotFound(c);
      return;
    }

    sendData(
      c,
      String(data).replace('</body>', `${getScriptToInject()}</body>`)
    );
  });

  return true;
}

export function handleFallback(c: HttpContext) {
  fs.readFile(c.req.filePath, (err, data) => {
    if (err) {
      sendNotFound(c);
      return;
    }

    sendData(c, data);
  });

  return true;
}
