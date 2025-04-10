{{- if .usePragmaOnce }}
#pragma once
{{- else }}
#ifndef {{ .includeGuard }}
#define {{ .includeGuard }}
{{- end }}
{{ if and .useForm (not (eq .uiUsage "pointer" )) }}
#include "{{ .uiHeaderFile }}"
{{- end }}
#include <QWidget>

{{- if and .useForm (eq .uiUsage "pointer") }}

QT_BEGIN_NAMESPACE
namespace Ui { class {{ .className }}; }
QT_END_NAMESPACE
{{- end }}

{{- $anotherBase := ""}}
{{- if and .useForm (eq .uiUsage "inherit") }}
{{- $anotherBase = printf ", private Ui::%s" .className }}
{{- end }}

class {{ .className }} : public {{ .baseClass }}{{ $anotherBase }}
{
    Q_OBJECT

public:
    explicit {{ .className }}(QWidget *parent = nullptr);
    ~{{ .className }}();

{{- if .useForm }}

private:

{{- if eq .uiUsage "pointer" }}
    Ui::{{ .className }} *ui;
{{- else if eq .uiUsage "member" }}
    Ui::{{ .className }} ui;
{{- end }}
{{- end }}
};
{{ if not .usePragmaOnce }}
#endif // {{ .includeGuard }}
{{- end }}
