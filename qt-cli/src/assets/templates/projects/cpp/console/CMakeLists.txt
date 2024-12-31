cmake_minimum_required(VERSION 3.16)

project({{ .name }} LANGUAGES CXX)

set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

{{- if .useTranslation }}
find_package(QT NAMES Qt6 Qt5 REQUIRED COMPONENTS Core LinguistTools)
find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Core LinguistTools)

set(TS_FILES {{ .name }}_{{ .language }}.ts)
{{- else }}
find_package(QT NAMES Qt6 Qt5 REQUIRED COMPONENTS Core)
find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Core)
{{- end }}

add_executable({{ .name }}
  main.cpp
{{- if .useTranslation }}
  ${TS_FILES}
{{- end }}
)
target_link_libraries({{ .name }} Qt${QT_VERSION_MAJOR}::Core)
{{- if .useTranslation }}

if(COMMAND qt_create_translation)
    qt_create_translation(QM_FILES ${CMAKE_SOURCE_DIR} ${TS_FILES})
else()
    qt5_create_translation(QM_FILES ${CMAKE_SOURCE_DIR} ${TS_FILES})
endif()
{{- end }}

include(GNUInstallDirs)
install(TARGETS {{ .name }}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
