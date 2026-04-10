// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as vscode from 'vscode';
import Parser from 'rss-parser';

import {
  ExtInfo,
  DataType,
  VideoEntry,
  BlogArticle
} from '@/webview/shared/welcome';
import * as consts from './constants';

interface RssCache {
  text: string;
  timestamp: number;
}

interface RssLoadOptions {
  forceRefresh: boolean;
}

export class WelcomePageDataManager {
  private readonly _extInfoList: ExtInfo[] = [];
  private readonly _blogArticles: BlogArticle[] = [];
  private readonly _videoEntries: VideoEntry[] = [];
  private readonly _timestamps = { blog: 0, video: 0 };

  private readonly _blogParser: Parser;
  private readonly _videoParser: Parser;

  constructor(
    private readonly _webview: vscode.Webview,
    private readonly _context: vscode.ExtensionContext
  ) {
    this._blogParser = new Parser({
      customFields: {
        item: [
          ['dc:date', 'dcDate'],
          ['content:encoded', 'contentEncoded']
        ]
      }
    });

    this._videoParser = new Parser({
      customFields: {
        item: [['media:group', 'mediaGroup']]
      }
    });
  }

  get extInfo() {
    return this._extInfoList;
  }

  get blogArticles() {
    return this._blogArticles;
  }

  get videoEntries() {
    return this._videoEntries;
  }

  get timestamps() {
    return this._timestamps;
  }

  public async refresh(type: DataType) {
    switch (type) {
      case 'ext-info':
        this._extInfoList.length = 0;
        this.ensureExtInfoLoaded();
        break;

      case 'blog':
        this._blogArticles.length = 0;
        await this.ensureBlogLoaded({ forceRefresh: true });
        break;

      case 'video':
        this._videoEntries.length = 0;
        await this.ensureVideoLoaded({ forceRefresh: true });
        break;
    }
  }

  public ensureExtInfoLoaded() {
    if (this._extInfoList.length !== 0) {
      return;
    }

    const extensions = [
      { name: 'Qt Core', id: 'theqtcompany.qt-core' },
      { name: 'Qt UI', id: 'theqtcompany.qt-ui' },
      { name: 'Qt Qml', id: 'theqtcompany.qt-qml' },
      { name: 'Qt C++', id: 'theqtcompany.qt-cpp' },
      { name: 'Qt Python', id: 'theqtcompany.qt-python' }
    ];

    for (const ext of extensions) {
      this._extInfoList.push(readExtInfo(ext.id, ext.name));
    }
  }

  public async ensureBlogLoaded(options = { forceRefresh: false }) {
    if (this._blogArticles.length !== 0) {
      return;
    }

    try {
      const rss = await this._fetchRss(consts.QT_BLOG_RSS, options);
      if (!rss) {
        return;
      }

      const rssFeed = await this._blogParser.parseString(rss.text);
      this._timestamps.blog = rss.timestamp;
      rssFeed.items.forEach((item) => {
        const content = String(_.get(item, 'contentEncoded', ''));
        const thumbnail = this._findBlogImgSrc(content);

        this._blogArticles.push({
          title: item.title ?? '',
          link: item.link ?? '',
          thumbnail,
          description: item.contentSnippet ?? '',
          author: item.creator ?? '',
          publishedDate: String(_.get(item, 'dcDate', ''))
        });
      });
    } catch (e) {
      void e;
    }

    // <item>
    //   <title>Qt 6.10.3 Released</title>
    //   <link>https://www.qt.io/blog/qt-6.10.3-released</link>
    //   <description><p style="line-height: 1.44; color: #4d4d4d; background-color: #ffffff;">The final release of the Qt 6.10 series, Qt 6.10.3, is now available for download. As a patch release, Qt 6.10.3 does not introduce new features; however, it includes more than 250 bug fixes, security updates, and quality improvements compared to Qt 6.10.2. For a comprehensive overview of the most notable changes, please refer to the&nbsp;<span> <a href="https://code.qt.io/cgit/qt/qtreleasenotes.git/about/qt/6.10.3/release-note.md">Qt 6.10.3 release notes</a>.</span>&nbsp;</p></description>
    //   <content:encoded><p style="line-height: 1.44; color: #4d4d4d; background-color: #ffffff;">The final release of the Qt 6.10 series, Qt 6.10.3, is now available for download. As a patch release, Qt 6.10.3 does not introduce new features; however, it includes more than 250 bug fixes, security updates, and quality improvements compared to Qt 6.10.2. For a comprehensive overview of the most notable changes, please refer to the&nbsp;<span> <a href="https://code.qt.io/cgit/qt/qtreleasenotes.git/about/qt/6.10.3/release-note.md">Qt 6.10.3 release notes</a>.</span>&nbsp;</p> <img src="https://track-eu1.hubspot.com/__ptq.gif?a=149513&amp;k=14&amp;r=https%3A%2F%2Fwww.qt.io%2Fblog%2Fqt-6.10.3-released&amp;bu=https%253A%252F%252Fwww.qt.io%252Fblog&amp;bvt=rss" alt="" width="1" height="1" style="min-height:1px!important;width:1px!important;border-width:0!important;margin-top:0!important;margin-bottom:0!important;margin-right:0!important;margin-left:0!important;padding-top:0!important;padding-bottom:0!important;padding-right:0!important;padding-left:0!important; "></content:encoded>
    //   <category>Releases</category>
    //   <category>Biz Circuit & Dev Loop</category>
    //   <category>Qt 6.10</category>
    //   <pubDate>Thu, 02 Apr 2026 09:15:19 GMT</pubDate>
    //   <author>jani.heikkinen@qt.io (Jani Heikkinen)</author>
    //   <guid>https://www.qt.io/blog/qt-6.10.3-released</guid>
    //   <dc:date>2026-04-02T09:15:19Z</dc:date>
    // </item>
  }

  public async ensureVideoLoaded(options = { forceRefresh: false }) {
    if (this._videoEntries.length !== 0) {
      return;
    }

    try {
      const rss = await this._fetchRss(consts.QT_VIDEO_RSS, options);
      if (!rss) {
        return;
      }

      const rssFeed = await this._videoParser.parseString(rss.text);
      const locThumbnail = 'mediaGroup.media:thumbnail.0.$.url';
      const locDescription = 'mediaGroup.media:description';

      this._timestamps.video = rss.timestamp;
      rssFeed.items.forEach((item) => {
        this._videoEntries.push({
          title: item.title ?? '',
          link: item.link ?? '',
          thumbnail: String(_.get(item, locThumbnail, '')),
          description: String(_.get(item, locDescription, '')),
          publishedDate: item.pubDate ?? ''
        });
      });
    } catch (e) {
      void e;
    }

    // <entry>
    //   <id>yt:video:uoGoTGiDBGg</id>
    //   <yt:videoId>uoGoTGiDBGg</yt:videoId>
    //   <yt:channelId>UCsyT1C1M-QoHQREjsixgayQ</yt:channelId>
    //   <title>Qt 6.11 - CanvasPainter</title>
    //   <link rel="alternate" href="https://www.youtube.com/shorts/uoGoTGiDBGg"/>
    //   <author>
    //     <name>Qt Group</name>
    //     <uri>https://www.youtube.com/channel/UCsyT1C1M-QoHQREjsixgayQ</uri>
    //   </author>
    //   <published>2026-03-23T10:30:08+00:00</published>
    //   <updated>2026-03-27T09:25:51+00:00</updated>
    //   <media:group>
    //     <media:title>Qt 6.11 - CanvasPainter</media:title>
    //     <media:content url="https://www.youtube.com/v/uoGoTGiDBGg?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
    //     <media:thumbnail url="https://i2.ytimg.com/vi/uoGoTGiDBGg/hqdefault.jpg" width="480" height="360"/>
    //     <media:description>The 6.11 release for Qt Framework improves performance, brings new techniques and capabilities on graphics, connectivity and languages, and a whole new approach to asynchronous C++ coding. See the release blog for more on each highlight: https://www.qt.io/blog/qt-6.11-released Try it out yourself! Download Qt from https://www.qt.io/development/download</media:description>
    //     <media:community>
    //       <media:starRating count="21" average="5.00" min="1" max="5"/>
    //       <media:statistics views="24053"/>
    //     </media:community>
    //   </media:group>
    // </entry>
  }

  private _findBlogImgSrc(html: string) {
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    const imgTag = imgMatch?.[0] ?? '';

    const widthMatch = imgTag.match(/width=["']?(\d+)["']?/i);
    const heightMatch = imgTag.match(/height=["']?(\d+)["']?/i);

    const src = imgMatch?.[1] ?? '';
    const w = widthMatch ? Number(widthMatch[1]) : 0;
    const h = heightMatch ? Number(heightMatch[1]) : 0;

    if (src.length > 0 && !src.includes('track')) {
      if ((!widthMatch && !heightMatch) || (w >= 10 && h >= 10)) {
        return src;
      }
    }

    const fallback = vscode.Uri.joinPath(
      vscode.Uri.joinPath(this._context.extensionUri, 'res', 'icons'),
      consts.FALLBACK_IMAGE_FILE_IN_RES
    );

    return this._webview.asWebviewUri(fallback).toString();
  }

  private async _fetchRss(url: string, option: RssLoadOptions, ttlHours = 12) {
    const now = Date.now();
    const storage = this._context.globalState;
    const cacheKey = `${consts.EXTENSION_ID}.welcomePage.rssCache.${url}`;
    const cache = storage.get<RssCache>(cacheKey);

    if (!option.forceRefresh) {
      if (ttlHours > 0 && cache && cache.text.length !== 0) {
        const maxCacheAge = 1000 * 60 * 60 * ttlHours;
        if (now - cache.timestamp < maxCacheAge) {
          return cache;
        }
      }
    }

    const res = await fetch(url);
    if (!res.ok) {
      return cache;
    }

    const text = await res.text();
    const rssCache = { text, timestamp: now };
    await storage.update(cacheKey, rssCache);
    return rssCache;
  }
}

// helpers
function readExtInfo(id: string, fallbackName: string): ExtInfo {
  const ext = vscode.extensions.getExtension(id);
  if (ext) {
    const json: unknown = ext.packageJSON;
    return {
      id,
      name: String(_.get(json, 'displayName', '')),
      version: String(_.get(json, 'version', '')),
      active: ext.isActive,
      preRelease: Boolean(_.get(json, 'preRelease', false))
    };
  }

  return {
    id,
    name: fallbackName,
    version: '',
    active: false,
    preRelease: false
  };
}
