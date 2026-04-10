// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export function countCompact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }

  return String(n);
}

export function countAsLocaleString(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

export function dateAsLocaleString(
  date: Date,
  format: 'DMY' | 'MY' = 'DMY'
) {
  const year = date.getUTCFullYear();
  const day = date.getUTCDate();
  const monthName = date.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC'
  });

  if (format === 'MY') {
    return `${monthName} ${String(year)}`;
  } else {
    return `${String(day)} ${monthName} ${String(year)}`;
  }
}

export function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) {
    return 'just now';
  }

  if (mins < 60) {
    return `${mins} min${mins === 1 ? '' : 's'} ago`;
  }

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  return `${days} day${days === 1 ? '' : 's'} ago`;
}
