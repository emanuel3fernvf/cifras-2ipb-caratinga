$ErrorActionPreference = "Stop"

$desktop = [Environment]::GetFolderPath("Desktop")
if ([string]::IsNullOrWhiteSpace($desktop)) {
    throw "Área de Trabalho não encontrada."
}

$shortcutPath = Join-Path $desktop "Cifras 2IPB Caratinga.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $env:CIFRAS_PYTHON
$shortcut.Arguments = $env:CIFRAS_ARGUMENTS
$shortcut.WorkingDirectory = $env:CIFRAS_ROOT
$shortcut.Description = "Abrir o editor local de cifras"
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
$shortcut.Save()

[Console]::OutputEncoding = [Text.Encoding]::UTF8
Write-Output $shortcutPath
