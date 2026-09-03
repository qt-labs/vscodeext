cmake_minimum_required(VERSION 3.16)
project(HelloQt LANGUAGES CXX)
set(CMAKE_AUTOMOC ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
find_package(Qt6 REQUIRED COMPONENTS Core Network Gui Widgets Quick Qml Quick)
add_executable(hello natvis_main.cpp)
# Copy pass1.json next to the generated executable; use the target's output
# directory so this also works with multi-config generators (e.g. Visual
# Studio), where the binary lands in a per-configuration subdirectory.
add_custom_command(TARGET hello POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
          ${CMAKE_CURRENT_SOURCE_DIR}/pass1.json
          $<TARGET_FILE_DIR:hello>/pass1.json)
target_link_libraries(hello PRIVATE Qt6::Core Qt6::Network Qt6::Gui Qt6::Widgets Qt6::Qml Qt6::Quick)
# natvis_main.cpp creates a QGuiApplication, which needs a platform plugin. The
# tests run headless and ask for "offscreen". A shared Qt loads it at run time,
# but a static Qt only links the plugins that are imported here, and by default
# that is the native one (cocoa/windows/xcb) — so without this the static build
# has no offscreen plugin to offer. No-op for shared builds.
if(TARGET Qt6::QOffscreenIntegrationPlugin)
  qt_import_plugins(hello INCLUDE Qt6::QOffscreenIntegrationPlugin)
else()
  message(STATUS "Qt offscreen platform plugin not available; the debug "
                 "configuration falls back to the native platform plugin.")
endif()
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
