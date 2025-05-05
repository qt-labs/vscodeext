#include "{{ .headerFileName }}"

{{ .name }}::{{ .name }}({{ .parentClass }} *parent)
    : {{ .baseClass }}{parent}
{
}
