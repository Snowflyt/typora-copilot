# Allow custom path (-Path or -p)
param (
    [Parameter(Mandatory = $false)]
    [Alias('p')]
    [string] $Path = ''
)

# Possible Typora installation paths
$paths = @(
    'C:\Program Files\Typora'
    'C:\Program Files (x86)\Typora'
    "$env:LOCALAPPDATA\Programs\Typora"
)
if ($Path -ne '') { $paths = @($Path) }

$scriptToRemoveAfterCandidates = @(
    '<script src="./app/window/frame.js" defer="defer"></script>'
    '<script src="./appsrc/window/frame.js" defer="defer"></script>'
)
$scriptToRemove = '<script src="./copilot/index.js" defer="defer"></script>'

# Find `window.html` in Typora installation path
$pathFound = $false
$success = $false

foreach ($path in $paths) {
    $windowHtmlPathCandiates = @(
        Join-Path -Path $path -ChildPath 'resources\app\window.html'
        Join-Path -Path $path -ChildPath 'resources\appsrc\window.html'
        Join-Path -Path $path -ChildPath 'resources\window.html'
    )

    foreach ($windowHtmlPath in $windowHtmlPathCandiates) {
        # If found, remove script
        if (Test-Path $windowHtmlPath) {
            $pathFound = $true
            Write-Host "Found Typora ""window.html"" at ""$windowHtmlPath""."
            $content = Get-Content $windowHtmlPath -Raw -Encoding UTF8

            foreach ($scriptToRemoveAfter in $scriptToRemoveAfterCandidates) {
                if ($content.Contains($scriptToRemoveAfter)) {
                    if ($content.Contains($scriptToRemove)) {
                        Write-Host "Removing Copilot plugin script after ""$scriptToRemoveAfter""..."

                        # Calculate indent of the script to remove
                        $row = $content.Split("`n") | Where-Object { $_ -match $scriptToRemove }
                        $rowContentBeforeScriptToRemove = $row -replace "$scriptToRemoveAfter(.*)", ''
                        $indent = $rowContentBeforeScriptToRemove -replace $rowContentBeforeScriptToRemove.TrimEnd(), ''

                        # Remove script
                        $newContent = $content -replace ($indent + $scriptToRemove), ''
                        Set-Content -Path $windowHtmlPath -Value $newContent -Encoding UTF8

                        # Remove `<path_of_window_html>\copilot\` directory
                        $copilotPath = Join-Path -Path (Split-Path -Path $windowHtmlPath -Parent) -ChildPath 'copilot'
                        if (Test-Path $copilotPath) {
                            Write-Host "Removing Copilot plugin directory ""$copilotPath""..."
                            Remove-Item -Path $copilotPath -Recurse -Force
                        }

                        Write-Host "Successfully uninstalled Copilot plugin in Typora."

                        $success = $true
                        break
                    }
                    else {
                        Write-Warning "Copilot plugin has not been installed in Typora."
                        $success = $true
                        break
                    }
                }

                if ($success) { break }
            }
        }

        if ($success) { break }
    }
}

# If not found, prompt user to check installation path
if (-not $pathFound) {
    Write-Error "Could not find Typora installation path. Please check if Typora is installed and try again."
}
elseif (-not $success) {
    Write-Error "Uninstallation failed."
}
