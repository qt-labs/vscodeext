#include "{{ .fileNameBase }}.h"
{{- if .useForm }}
#include "ui_{{ .fileNameBase }}.h"
{{- end }}

{{ .className }}::{{ .className }}(QWidget *parent)
    : {{ .baseClass }}(parent)
    , ui(new Ui::{{ .className }})
{
{{- if .useForm }}
    ui->setupUi(this);
{{- end }}
}

{{ .className }}::~{{ .className }}()
{
{{- if .useForm }}
    delete ui;
{{- end }}
}
