cmake_minimum_required(VERSION 3.16)
project(HelloQt LANGUAGES CXX)
set(CMAKE_AUTOMOC ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
find_package(Qt6 REQUIRED COMPONENTS Core Network Gui Widgets Quick Qml Quick)
add_executable(hello main.cpp)
# Copy pass1.json next to the generated executable; use the target's output
# directory so this also works with multi-config generators (e.g. Visual
# Studio), where the binary lands in a per-configuration subdirectory.
add_custom_command(TARGET hello POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
          ${CMAKE_CURRENT_SOURCE_DIR}/pass1.json
          $<TARGET_FILE_DIR:hello>/pass1.json)
target_link_libraries(hello PRIVATE Qt6::Core Qt6::Network Qt6::Gui Qt6::Widgets Qt6::Qml Qt6::Quick)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
