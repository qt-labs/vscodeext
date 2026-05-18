cmake_minimum_required(VERSION 3.16)

project(projects_cpp_qtquick VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS Quick)

qt_standard_project_setup(REQUIRES 6.8)

# Content of downloaded design from Figma to Qt or similar
if (EXISTS "${CMAKE_CURRENT_LIST_DIR}/importedcontent/CMakeLists.txt")
    add_subdirectory(${CMAKE_CURRENT_LIST_DIR}/importedcontent)
endif()

qt_add_executable(appprojects_cpp_qtquick
    main.cpp
)

qt_add_qml_module(appprojects_cpp_qtquick
    URI projects_cpp_qtquick
    VERSION 1.0
    QML_FILES
        Main.qml
)

set_target_properties(appprojects_cpp_qtquick PROPERTIES
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)

target_link_libraries(appprojects_cpp_qtquick
    PRIVATE Qt6::Quick
)

include(GNUInstallDirs)
install(TARGETS appprojects_cpp_qtquick
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
