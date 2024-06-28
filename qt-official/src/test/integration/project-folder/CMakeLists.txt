# Copyright (C) 2023 The Qt Company Ltd.
# SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

cmake_minimum_required(VERSION 3.15)
project(example)

set(CMAKE_AUTOMOC ON)
find_package(Qt6 COMPONENTS Core Gui Widgets REQUIRED)

add_executable(example main.cpp)

target_link_libraries(example PRIVATE Qt6::Core Qt6::Gui Qt6::Widgets)

