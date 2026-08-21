using Qt.Quick;
{{ if .SampleCode }}

using System.ComponentModel;
using System.Runtime.CompilerServices;
{{ end }}

namespace {{ .namespace }};
{{ if .SampleCode }}

[QmlElement(Name = "Counter", Singleton = true)]
public class CounterService : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    private int _clicks = 0;
    public int Clicks
    {
        get => _clicks;
        set
        {
            if (_clicks == value)
                return;
            _clicks = value;
            OnPropertyChanged();
        }
    }

    protected virtual void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
{{ end }}

public class Program
{
    internal static void Main(string[] args)
    {
        Qml.LoadFromRootModule("Main");
        Qml.WaitForExit();
    }
}
