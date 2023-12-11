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

$scriptToInsertAfterCandidates = @(
    '<script src="./app/window/frame.js" defer="defer"></script>'
    '<script src="./appsrc/window/frame.js" defer="defer"></script>'
)
$scriptToInsert = '<script src="./copilot/index.cjs" defer="defer"></script>'

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
        # If found, insert script
        if (Test-Path $windowHtmlPath) {
            $pathFound = $true
            Write-Host "Found Typora ""window.html"" at ""$windowHtmlPath""."
            $content = Get-Content $windowHtmlPath -Raw

            if (!($content.Contains($scriptToInsert))) {
                Write-Host 'Installing Copilot plugin in Typora...'
                foreach ($scriptToInsertAfter in $scriptToInsertAfterCandidates) {
                    if ($content.Contains($scriptToInsertAfter)) {
                        Write-Host "Inserting Copilot plugin script after ""$scriptToInsertAfter""..."

                        # Calculate indent of the script to insert
                        $row = $content.Split("`n") | Where-Object { $_ -match $scriptToInsertAfter }
                        $rowContentBeforeScriptToInsertAfter = $row -replace "$scriptToInsertAfter(.*)", ''
                        $indent = $rowContentBeforeScriptToInsertAfter -replace $rowContentBeforeScriptToInsertAfter.TrimEnd(), ''

                        # Insert script
                        $newContent = $content -replace $scriptToInsertAfter, (
                            $scriptToInsertAfter +
                            $(If (($rowContentBeforeScriptToInsertAfter -ne '') -and ($indent -eq '')) { '' } Else { "`n" + $indent }) +
                            $scriptToInsert
                        )
                        Set-Content -Path $windowHtmlPath -Value $newContent

                        # Copy `<cwd>\..\` to `<path_of_window_html>\copilot\` directory
                        $copilotPath = Join-Path -Path (Split-Path -Path $windowHtmlPath -Parent) -ChildPath 'copilot'
                        if (-not (Test-Path $copilotPath)) {
                            Write-Host "Copying Copilot plugin files to ""$copilotPath""..."
                            Copy-Item -Path (Join-Path -Path $PSScriptRoot -ChildPath '..\') -Destination $copilotPath -Recurse
                        }

                        Write-Host "Successfully installed Copilot plugin in Typora."

                        $success = $true
                        break
                    }
                }

                if ($success) { break }
            }
            else {
                Write-Warning "Copilot plugin has already been installed in Typora."
                $success = $true
                break
            }
        }
    }
}

# If not found, prompt user to check installation path
if (-not $pathFound) {
    Write-Error "Could not find Typora installation path. Please check if Typora is installed and try again."
}
elseif (-not $success) {
    Write-Error "Installation failed."
}
