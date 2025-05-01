# Allow custom path (-Path or -p) and silence warning (-Silent or -s)
param (
    [Parameter(Mandatory = $false)]
    [Alias('p')]
    [string] $Path = '',

    [Parameter(Mandatory = $false)]
    [Alias('s')]
    [switch] $Silent = $false
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
                        if (-not $Silent) {
                            Write-Warning "Copilot plugin script has not been found in Typora."
                        }

                        # Remove `<path_of_window_html>\copilot\` directory regardless of script presence
                        $copilotPath = Join-Path -Path (Split-Path -Path $windowHtmlPath -Parent) -ChildPath 'copilot'
                        if (Test-Path $copilotPath) {
                            Write-Host "Detected Copilot plugin directory but no script reference. This might be leftover from a previous installation."
                            Write-Host "Removing Copilot plugin directory ""$copilotPath""..."
                            Remove-Item -Path $copilotPath -Recurse -Force
                            Write-Host "Uninstallation complete."
                            $success = $true
                        }

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
