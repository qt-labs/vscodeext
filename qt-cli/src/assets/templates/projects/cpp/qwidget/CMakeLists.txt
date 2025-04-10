cmake_minimum_required(VERSION 3.16)

project({{ .name }} VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
{{ if .useTranslation }}
find_package(Qt6 REQUIRED COMPONENTS Widgets LinguistTools)
{{ else }}
find_package(Qt6 REQUIRED COMPONENTS Widgets)
{{- end }}

{{- if .useTranslation }}
qt_standard_project_setup(I18N_TRANSLATED_LANGUAGES {{ .language }})
{{- else }}
qt_standard_project_setup()
{{- end }}

qt_add_executable({{ .name }}
        main.cpp
        mainwindow.cpp
        mainwindow.h
    {{- if .useForm }}
        mainwindow.ui
    {{- end }}
    {{- if .useTranslation }}
        ${TS_FILES}
    {{- end }}
)
target_link_libraries({{ .name }} PRIVATE Qt${QT_VERSION_MAJOR}::Widgets)

set_target_properties({{ .name }} PROPERTIES
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)
{{ if .useTranslation }}
qt_add_translations({{ .name }})
{{ end }}
include(GNUInstallDirs)
install(TARGETS {{ .name }}
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
