cmake_minimum_required(VERSION 3.16)

project(QmlDebugTest VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.4 REQUIRED COMPONENTS Quick)

qt_standard_project_setup()

qt_add_executable(qml-debug-app
    main.cpp
)

# Enable QML debugging
target_compile_definitions(qml-debug-app PRIVATE QT_QML_DEBUG)

qt_add_qml_module(qml-debug-app
    URI QmlDebugTest
    VERSION 1.0
    QML_FILES Main.qml
)

target_link_libraries(qml-debug-app
    PRIVATE Qt6::Quick
)
