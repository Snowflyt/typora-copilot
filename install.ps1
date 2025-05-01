#Requires -RunAsAdministrator
$latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/Snowflyt/typora-copilot/releases/latest"
Invoke-WebRequest -Uri $latestRelease.assets[0].browser_download_url -OutFile "typora-copilot-$($latestRelease.tag_name).zip"
If (Test-Path "typora-copilot-$($latestRelease.tag_name)") {
    Remove-Item "typora-copilot-$($latestRelease.tag_name)" -Recurse -Force
}
New-Item -ItemType Directory -Path "typora-copilot-$($latestRelease.tag_name)"
Expand-Archive -Path "typora-copilot-$($latestRelease.tag_name).zip" -DestinationPath "typora-copilot-$($latestRelease.tag_name)"
Remove-Item "typora-copilot-$($latestRelease.tag_name).zip"
Set-Location "typora-copilot-$($latestRelease.tag_name)"
Write-Host "Trying to uninstall the previous version (if any)..."
.\bin\uninstall_windows.ps1 --Silent
Write-Host "Trying to install the new version..."
.\bin\install_windows.ps1
Set-Location ..
Remove-Item "typora-copilot-$($latestRelease.tag_name)" -Recurse -Force
