#!/bin/bash

# Parse arguments -path or -p
while [[ "$#" -gt 0 ]]; do
  case $1 in
  -p | --path)
    custom_path="$2"
    shift
    ;;
  -s | --silent)
    silent=true
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
  "/Applications/Typora.app"
  "$HOME/Applications/Typora.app"
  "/usr/local/bin/Typora"
  "/opt/Typora"
)
if [[ -n "$custom_path" ]]; then
  paths=("$custom_path")
fi

script_to_remove_after_candidates=(
  '<script src="./app/main.js" defer></script>'
  '<script src="./app/main.js" aria-hidden="true" defer></script>'
  '<script src="./appsrc/main.js" defer></script>'
  '<script src="./appsrc/main.js" aria-hidden="true" defer></script>'
)
script_to_remove='<script src="./copilot/index.js" defer></script>'

escape_for_sed() {
  echo "$1" | sed -E 's/[]\/$*.^|[]/\\&/g'
}

# Find `index.html` in Typora installation path
path_found=false
success=false

for path in "${paths[@]}"; do
  index_html_path_candidates=(
    "$path/Contents/Resources/TypeMark/index.html"
    "$path/Contents/Resources/app/index.html"
    "$path/Contents/Resources/appsrc/index.html"
    "$path/resources/app/index.html"
    "$path/resources/appsrc/index.html"
    "$path/resources/TypeMark/index.html"
    "$path/resources/index.html"
  )

  for index_html_path in "${index_html_path_candidates[@]}"; do
    # If found, insert script
    if [[ -f "$index_html_path" ]]; then
      path_found=true
      echo "Found Typora \"index.html\" at \"$index_html_path\"."
      content=$(cat "$index_html_path")

      for script_to_remove_after in "${script_to_remove_after_candidates[@]}"; do
        if echo "$content" | grep -qF "$script_to_remove_after"; then
          if echo "$content" | grep -qF "$script_to_remove"; then
            echo "Removing Copilot plugin script after \"$script_to_remove_after\"..."

            escaped_script_to_remove=$(escape_for_sed "$script_to_remove")
            new_content=$(echo "$content" | sed -E "s/[[:space:]]*$escaped_script_to_remove//")

            # Remove script
            echo "$new_content" >"$index_html_path"

            # Remove `<path_of_index_html>/copilot/` directory
            copilot_dir=$(dirname "$index_html_path")/copilot
            if [[ -d "$copilot_dir" ]]; then
              echo "Removing Copilot plugin directory \"$copilot_dir\"..."
              rm -rf "$copilot_dir"
            fi

            echo "Successfully uninstalled Copilot plugin in Typora."

            success=true
            break
          else
            if ! $silent; then
              echo "Warning: Copilot plugin has not been installed in Typora."
            fi

            # Remove `<path_of_index_html>/copilot/` directory regardless of script presence
            copilot_dir=$(dirname "$index_html_path")/copilot
            if [[ -d "$copilot_dir" ]]; then
              echo "Detected Copilot plugin directory but no script reference. This might be leftover from a previous installation."
              echo "Removing Copilot plugin directory \"$copilot_dir\"..."
              rm -rf "$copilot_dir"
              echo "Uninstallation complete."
            fi

            success=true
            break
          fi
        fi

        if $success; then break; fi
      done
    fi

    if $success; then break; fi
  done

  if $success; then break; fi
done

# If not found, prompt user to check installation path
if ! $path_found; then
  echo "Error: Could not find Typora installation path. Please check if Typora is installed and try again." >&2
elif ! $success; then
  echo "Error: Uninstallation failed." >&2
fi
