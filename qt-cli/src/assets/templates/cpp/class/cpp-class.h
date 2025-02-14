{{/* variables */}}
{{ $macros := Qt.NewArray }}
{{ $macros = (Qt.AppendIf $macros "Q_OBJECT" (or .isQObject (not (eq .qtBaseClass "")))) }}
{{ $macros = (Qt.AppendIf $macros "QML_ELEMENT" (eq .qtBaseClass "QQuickItem")) }}

{{ $includes := Qt.NewArray }}
{{ $includes = (Qt.AppendIf $includes (printf "<%s>" .qtBaseClass) (not (eq .qtBaseClass ""))) }}
{{ $includes = (Qt.AppendIf $includes "<QSharedDataPointer>" .useQSharedData) }}
{{ $includes = (Qt.AppendIf $includes (printf "\"%s.h\"" .customBaseClass) (not (eq .customBaseClass ""))) }}

{{/* contents */}}
{{ if .usePragmaOnce }}
#pragma once
{{ else }}
#ifndef {{ .includeGuardName }}
#define {{ .includeGuardName }}
{{ end }}

{{ range $includes }}#include {{ . }}
{{ end }}

{{ .namespaceOpening }}

{{ if .useQSharedData }}class {{ .sharedDataClass }};{{ end }}

class {{ .className }}{{ if .baseClass }}: public {{ .baseClass }}{{ end }}
{
{{ range $macros }}    {{ . }}
{{ end }}
{{- if $macros }}{{ printf "\n" }}{{ end -}}

public:
{{- if .parentClass }}
    explicit {{ .className }}({{ .parentClass }} *parent = nullptr);
{{- else }}
    {{ .className }}();
{{ end }}

{{ if .useQSharedData }}
    {{ .className }}(const {{ .className }} &);
    {{ .className }}({{ .className }} &&);
    {{ .className }} &operator=(const {{ .className }} &);
    {{ .className }} &operator=({{ .className }} &&);
    ~{{ .className }}();
{{ end }}

{{ if .isQObject }}
Q_SIGALS:
{{ end }}

{{ if .useQSharedData }}
private:
    QSharedDataPointer<{{ .sharedDataClass }}> data;
{{ end }}
};

{{ .namespaceClosing }}

{{ if not .usePragmaOnce }}
#endif // {{ .includeGuardName }}
{{ end }}
