// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

import {
  isCourseLevel,
  type CourseData,
  type CourseLevel
} from '@shared/courses';

export type SortBy =
  | 'name'
  | 'newest'
  | 'shortest'
  | 'enrolled'
  | 'ratings'
  | 'reviews';

export type ActionTypes = 'open-course' | 'open-academy-home';

// wrapper classes
export class Course {
  private readonly _data: CourseData;
  private readonly _searchTarget: string;

  constructor(data: CourseData) {
    this._data = data;
    this._searchTarget = [
      this.name.toLowerCase(),
      this.keywords.toLowerCase(),
      this.descriptionHtml.toLowerCase(),
      this.objectivesHtml.toLowerCase()
    ].join(' ');
  }

  get id() {
    return this._data.id;
  }

  get name() {
    return this._data.name;
  }

  get type() {
    return this._data.type;
  }

  get keywords() {
    return this._getString('keywords');
  }

  get thumbnailUrl() {
    return this._getString('thumbnail_image_url');
  }

  get descriptionHtml() {
    return this._getString('description_html');
  }

  get objectivesHtml() {
    return this._getString('objectives_html');
  }

  get level(): CourseLevel {
    const s = this._getString('difficulty_level');
    return isCourseLevel(s) ? s : 'basic';
  }

  get duration() {
    const units =
      this._getString('course_length_unit') ||
      this._getString('path_length_unit');

    const value = this._getNumber('minute_length');
    const min = value * (units.toLocaleLowerCase() === 'hours' ? 60 : 1);

    return min;
  }

  get durationDisplay() {
    const min = this.duration;
    const hours = Math.round(min / 60);
    return min >= 60
      ? `${String(hours)} ${hours === 1 ? 'hour' : 'hours'}`
      : `${String(min)} ${min === 1 ? 'minute' : 'minutes'}`;
  }

  get publishedDate() {
    // expected format: "2024-07-09T05:39:19Z"
    return this._getString('date_published');
  }

  get publishedDateDisplay() {
    const date = new Date(this.publishedDate);

    const year = date.getUTCFullYear();
    const day = date.getUTCDate();
    const monthName = date.toLocaleString('en-US', {
      month: 'short',
      timeZone: 'UTC'
    });

    return `${String(day)} ${monthName} ${String(year)}`;
  }

  get publishedDateDisplayShort() {
    const date = new Date(this.publishedDate);

    const year = date.getUTCFullYear();
    const monthName = date.toLocaleString('en-US', {
      month: 'short',
      timeZone: 'UTC'
    });

    return `${monthName} ${String(year)}`;
  }

  get stats(): {
    stars: number;
    reviews: number;
    fiveStarRating: number;
    fiveStarRatingString: string;
    enrolled: number;
  } {
    const stars = this._getNumber('number_of_stars');
    const reviews = this._getNumber('number_of_reviews');
    const rating = reviews !== 0 ? stars / reviews : 0.0;

    return {
      stars,
      reviews,
      fiveStarRating: rating,
      fiveStarRatingString: (Math.floor(rating * 10.0) / 10.0).toFixed(1),
      enrolled: this._getNumber('num_enrolled')
    };
  }

  get searchTarget() {
    return this._searchTarget;
  }

  private _getString(key: string, defaultValue = '') {
    return String(_.get(this._data, key, defaultValue)).trim();
  }

  private _getNumber(key: string, defaultValue = 0) {
    return _.get(this._data, key, defaultValue) as number;
  }
}

// data example
// const data = {
//   courses: [
//     {
//       "id": 3953317,
//       "name": " QML入門",
//       "version": 1,
//       "source_id": 3953317,
//       "allow_users_rate_course": true,
//       "sellable": false,
//       "keywords": "QML, Into, Beginner, QtQuick, Qt Framework",
//       "cataloged": true,
//       "reference_code": "",
//       "manager_can_enroll": false,
//       "number_of_reviews": 10,
//       "number_of_stars": 49,
//       "num_not_started": 4,
//       "num_in_progress": 83,
//       "num_completed": 0,
//       "num_passed": 31,
//       "num_failed": 0,
//       "num_pending_review": 0,
//       "number_of_modules": 1,
//       "due_days_after_enrollment": null,
//       "send_due_date_reminders": false,
//       "due_date_reminder_days": null,
//       "due_date_reminder_days_2": null,
//       "num_enrolled": 118,
//       "owner_first_name": "Ashley",
//       "owner_last_name": "Walton",
//       "owner_email": "ashley.walton@qt.io",
//       "owner_id": 18649765,
//       "thumbnail_image_url": "https://learnupon.s3.eu-west-1.amazonaws.com/courseimages/1313731/large/d8a1d034-f969-444e-9d73-b09793909a06-Course-Intro-QML-JP.png",
//       "credits_to_be_awarded": "",
//       "created_at": "2024-07-08T07:59:10Z",
//       "date_published": "2024-07-09T05:39:19Z",
//       "description_html": "<p>このコースは、言語設定で日本語を選択した方のみ受講可能です。<br>\r\n<br>\r\nこのコースでは、QML の魅力的な世界を探求し、視覚的にリッチでインタラクティブなアプリケーションを作成するための多くの利点を学習します。</p>\r\n\r\n<p>このコースは、新しい Ul デザイン技術をツールキットに加えたい開発者や、Ulデザインのアイデアを実現したいデザイナーのためのコースです。</p>\r\n\r\n<p>このコースを受講する前に、<strong>Ready, Set, Qt！</strong>ラーニングパスでQtエンジンを起動することをお勧めします。</p>\r\n\r\n<p>このコースを修了すると、QML の構文、概要、機能を理解し、アプリケーションで QML を使用できるようになります。</p>\r\n",
//       "description_text": "このコースは、言語設定で日本語を選択した方のみ受講可能です。 \n \nこのコースでは、QML の魅力的な世界を探求し、視覚的にリッチでインタラクティブなアプリケーションを作成するための多くの利点を学習します。\n\nこのコースは、新しい Ul デザイン技術をツールキットに加えたい開発者や、Ulデザインのアイデアを実現したいデザイナーのためのコースです。\n\nこのコースを受講する前に、Ready, Set, Qt！ラーニングパスでQtエンジンを起動することをお勧めします。\n\nこのコースを修了すると、QML の構文、概要、機能を理解し、アプリケーションで QML を使用できるようになります。\n",
//       "objectives_html": "<p><strong><strong><strong><strong>何を学ぶか?</strong></strong></strong></strong></p>\r\n\r\n<ul>\r\n\t<li>QML とは？</li>\r\n\t<li>なぜ QML を使うのか？</li>\r\n\t<li>QML の構文</li>\r\n\t<li>QML の コンセプト</li>\r\n\t<li>QML はどのように構成するか？</li>\r\n\t<li>QML の UI はどのように構成するか？</li>\r\n</ul>\r\n",
//       "objectives_text": "何を学ぶか?\n\n\n\tQML とは？\n\tなぜ QML を使うのか？\n\tQML の構文\n\tQML の コンセプト\n\tQML はどのように構成するか？\n\tQML の UI はどのように構成するか？\n\n",
//       "price": 0,
//       "course_length_unit": "minutes",
//       "minute_length": 90,
//       "due_date_after_enrollment": null,
//       "published_status_id": "published",
//       "difficulty_level": "basic",
//       "customDataFieldValues": []
//     }
//   ],

//   learningPaths: [
//     {
//       "id": 75849,
//       "name": "Automated Testing with Squish",
//       "sellable": false,
//       "cataloged": true,
//       "keywords": "GUI Testing, Squish IDE, Automation Scripts, Object Identification, Verification Points, Test Suites, Script Languages (Python, JavaScript), Behavior-Driven Development (BDD), Cross-Platform Testing, Application Under Test (AUT), Object Maps, Test Results Analysis, Image-Based Object Recognition, Hybrid Object Recognition, Test Management Integration, Continuous Integration (CI), Debugging Tests, Data-Driven Testing, Custom Test Reports, Environmental Variables, Command Line Tools, User Interaction Simulation, Event Handlers, Test Refactoring, Best Practices in GUI Testing, Scripting Tips and Tricks, Advanced Object Identification Techniques, Testing Desktop Applications, Error Handling in Automated Tests, Squish for Qt, API Testing Integration, User Experience Testing, Test Case Prioritization, Automated Test Planning, Scalability in GUI Testing, Custom Squish Extensions, Troubleshooting Squish Tests.",
//       "due_days_after_enrollment": null,
//       "send_due_date_reminders": false,
//       "due_date_reminder_days": null,
//       "due_date_reminder_days_2": null,
//       "minute_length": 440,
//       "path_length_unit": "minutes",
//       "price": 0,
//       "published_status_id": "published",
//       "difficulty_level": "basic",
//       "description_html": "<p> </p>\n\n<p>Build a fundamental understanding of automated GUI testing with Squish. Create, manage, and execute automated tests for software applications with practical examples. Start with configuring the testing environment and understanding the role of the Squish IDE when creating tests. Explore the tools to record and verify tests. You will look at different ways to test applications, from using external data to building Behavior-Driven testing for agile development. By the end of the learning path, you will be well-equipped to utilize Squish for building your test suites; enhancing software quality and reliability through efficient automation strategies.</p>\n",
//       "description_text": "&nbsp;\n\nBuild a fundamental&nbsp;understanding of automated GUI testing with&nbsp;Squish. Create, manage, and execute&nbsp;automated tests for software applications with practical examples. Start&nbsp;with configuring the testing environment and understanding the role of the&nbsp;Squish IDE when creating tests. Explore the tools to record and verify tests.&nbsp;You will look at different ways to test applications, from using external data to building Behavior-Driven testing for agile development. By the end of the learning path, you will be well-equipped to utilize Squish for building your test suites;&nbsp;enhancing software quality and reliability through efficient automation strategies.\n",
//       "thumbnail_image_url": "https://learnupon.s3.eu-west-1.amazonaws.com/lpimages/38221/large/4b410b05-2ee5-4cf0-bde9-d1faa47ae0cb-Path-Testing-With-Squish.png",
//       "credits_to_be_awarded": "",
//       "created_at": "2024-03-20T06:24:02Z",
//       "date_published": "2024-03-22T09:47:09Z",
//       "due_date_after_enrollment": null
//     }
//   ]
// }
