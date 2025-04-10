cmake_minimum_required(VERSION 3.16)

project({{ .name }} LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
{{ if .useTranslation }}
find_package(Qt6 REQUIRED COMPONENTS Core LinguistTools)
{{ else }}
find_package(Qt6 REQUIRED COMPONENTS Core)
{{- end }}

{{- if .useTranslation }}
qt_standard_project_setup(I18N_TRANSLATED_LANGUAGES {{ .language }})
{{- else }}
qt_standard_project_setup()
{{- end }}

qt_add_executable({{ .name }}
  main.cpp
)
{{- if .useTranslation }}
qt_add_translations({{ .name }})
{{- end }}

install(TARGETS {{ .name }}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
