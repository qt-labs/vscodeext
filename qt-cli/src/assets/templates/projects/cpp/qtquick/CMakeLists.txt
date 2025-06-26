{{- $target := printf "app%s" .name }}
{{- $mininumQtVersionFloat := (.minimumQtVersion | Qt.ParseFloat) }}
cmake_minimum_required(VERSION 3.16)

project({{ .name }} VERSION 0.1 LANGUAGES CXX)
{{ if lt $mininumQtVersionFloat 6.5 }}
set(CMAKE_AUTOMOC ON)
{{- end }}
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 {{ .minimumQtVersion }} REQUIRED COMPONENTS Quick)
{{ if ge $mininumQtVersionFloat 6.5 }}
qt_standard_project_setup(REQUIRES {{ .minimumQtVersion }})
{{ end }}
qt_add_executable({{ $target }}
    main.cpp
)

qt_add_qml_module({{ $target }}
    URI {{ .name }}
    VERSION 1.0
    QML_FILES
        Main.qml
)

set_target_properties({{ $target }} PROPERTIES
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)

target_link_libraries({{ $target }}
    PRIVATE Qt6::Quick
)

include(GNUInstallDirs)
install(TARGETS {{ $target }}
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
