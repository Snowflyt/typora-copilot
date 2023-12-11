#!/bin/bash

# Parse arguments -path or -p
while [[ "$#" -gt 0 ]]; do
    case $1 in
    -p | --path)
        custom_path="$2"
        shift
        ;;
    *)
        echo "Unknown parameter passed: $1"
        exit 1
        ;;
    esac
    shift
done

# Possible Typora installation paths
paths=(
    "/usr/share/typora"
    "/usr/local/share/typora"
    "/opt/typora"
    "/opt/Typora"
    "$HOME/.local/share/Typora"
    "$HOME/.local/share/typora"
)
if [[ -n "$custom_path" ]]; then
    paths=("$custom_path")
fi

script_to_insert_after_candidates=(
    '<script src="./app/window/frame.js" defer="defer"></script>'
    '<script src="./appsrc/window/frame.js" defer="defer"></script>'
)
script_to_insert='<script src="./copilot/index.cjs" defer="defer"></script>'

escape_for_sed() {
    echo "$1" | sed -E 's/[]\/$*.^|[]/\\&/g'
}

# Find `window.html` in Typora installation path
path_found=false
success=false

for path in "${paths[@]}"; do
    window_html_path_candidates=(
        "$path/resources/app/window.html"
        "$path/resources/appsrc/window.html"
        "$path/resources/window.html"
    )

    for window_html_path in "${window_html_path_candidates[@]}"; do
        # If found, insert script
        if [[ -f "$window_html_path" ]]; then
            path_found=true
            echo "Found Typora \"index.html\" at \"$window_html_path\"."
            content=$(cat "$window_html_path")

            if [[ "$content" != *"$script_to_insert"* ]]; then
                echo 'Installing Copilot plugin in Typora...'
                for script_to_insert_after in "${script_to_insert_after_candidates[@]}"; do
                    if echo "$content" | grep -qF "$script_to_insert_after"; then
                        echo "Inserting Copilot plugin script after \"$script_to_insert_after\"..."

                        # Calculate indent of the script to insert
                        escaped_script_to_insert_after=$(escape_for_sed "$script_to_insert_after")
                        escaped_script_to_insert=$(escape_for_sed "$script_to_insert")
                        indent=$(echo "$content" | while IFS= read -r line; do
                            if [[ "$line" == *"$script_to_insert_after"* ]]; then
                                echo "$line" | sed -E 's/^([[:space:]]*).*/\1/'
                                break
                            fi
                        done)
                        if [[ -z "$indent" ]]; then
                            replacement="$escaped_script_to_insert_after$escaped_script_to_insert"
                        else
                            replacement="$escaped_script_to_insert_after\n$indent$escaped_script_to_insert"
                        fi
                        new_content=$(echo "$content" | sed "s|$escaped_script_to_insert_after|$replacement|")

                        # Insert script
                        echo "$new_content" >"$window_html_path"

                        # Copy `<cwd>/../` to `<path_of_window_html>/copilot/` directory
                        copilot_path=$(dirname "$window_html_path")/copilot
                        if [[ ! -d "$copilot_path" ]]; then
                            echo "Copying Copilot plugin files to \"$copilot_path\"..."
                            mkdir -p "$copilot_path"
                            cp -r "$(dirname "$0")/../" "$copilot_path"
                        fi

                        echo "Successfully installed Copilot plugin in Typora."

                        success=true
                        break
                    fi
                done

                if $success; then break; fi
            else
                echo "Warning: Copilot plugin has already been installed in Typora."
                success=true
                break
            fi
        fi
    done

    if $success; then break; fi
done

# If not found, prompt user to check installation path
if ! $path_found; then
    echo "Error: Could not find Typora installation path. Please check if Typora is installed and try again." >&2
elif ! $success; then
    echo "Error: Installation failed." >&2
fi
