{{/* variables */}}
{{ $macros := Qt.NewArray }}
{{ $macros = (Qt.Append $macros "Q_OBJECT") }}
{{ $macros = (Qt.AppendIf $macros "QML_ELEMENT" (eq .baseClass "QQuickItem")) }}

{{ $includes := Qt.NewArray }}
{{ $includes = (Qt.AppendIf $includes (printf "<%s>" .baseClass) (not (eq .baseClass ""))) }}

{{/* contents */}}
#pragma once

{{ range $includes }}#include {{ . }}
{{ end }}

class {{ .name }}{{ if .baseClass }}: public {{ .baseClass }}{{ end }}
{
{{ range $macros }}    {{ . }}
{{ end }}
{{- if $macros }}{{ printf "\n" }}{{ end -}}

public:
    explicit {{ .name }}({{ .parentClass }} *parent = nullptr);

Q_SIGALS:
};
