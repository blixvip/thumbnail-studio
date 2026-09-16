$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$desktopFolder = [Environment]::GetFolderPath('DesktopDirectory')
$shortcutPath = Join-Path $desktopFolder 'Thumbnail Studio.lnk'
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + (Join-Path $projectRoot 'Start Thumbnail Studio.vbs') + '"'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = (Join-Path $projectRoot 'desktop\thumbnail.ico') + ',0'
$shortcut.Description = 'Thumbnail references, design skills, and ChatGPT'
$shortcut.Save()
Write-Output $shortcutPath
