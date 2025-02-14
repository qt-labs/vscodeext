{{ if .useQSharedData }}#include <utility>{{ end }}
#include "{{ .headerFileName }}"

{{ .namespaceOpening }}

{{ if .useQSharedData }}
class {{ .sharedDataClass }}: public QSharedData
{
public:
};
{{ end }}

{{- if .parentClass }}
{{ .className }}::{{ .className }}({{ .parentClass }} *parent)
    : {{ .baseClass }}{parent}{{ if .useQSharedData }}, data(new {{ .sharedDataClass }}){{ end }}
{{- else }}
{{ .className }}::{{ .className }}(){{ if .useQSharedData }}: data(new {{ .sharedDataClass }}){{ end }}
{{- end }}
{
}

{{ if .useQSharedData }}
{{ .className }}::{{ .className }}(const {{ .className }} &rhs)
    : data{rhs.data}
{
}

{{ .className }}::{{ .className }}({{ .className }} &&rhs)
    : data{std::move(rhs.data)}
{
}

{{ .className }} &{{ .className }}::operator=(const {{ .className }} &rhs)
{
    if (this != &rhs)
        data = rhs.data;

    return *this;
}

{{ .className }} &{{ .className }}::operator=({{ .className }} &&rhs)
{
    if (this != &rhs)
        data = std::move(rhs.data);

    return *this;
}

{{ .className }}::~{{ .className }}()
{
}
{{ end }}

{{ .namespaceClosing }}
