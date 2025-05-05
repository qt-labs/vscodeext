#pragma once

#include <{{ .baseClass }}>

{{- if .useForm }}

QT_BEGIN_NAMESPACE
namespace Ui {
    class {{ .className }};
}
QT_END_NAMESPACE
{{- end }}

class {{ .className }} : public {{ .baseClass }}
{
    Q_OBJECT

public:
    explicit {{ .className }}(QWidget *parent = nullptr);
    ~{{ .className }}();

{{- if .useForm }}

private:
    Ui::{{ .className }} *ui;
{{- end }}
};
