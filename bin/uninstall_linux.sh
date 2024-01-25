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

# Possible Typora installation paths on Linux
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

script_to_remove_after_candidates=(
  '<script src="./app/window/frame.js" defer="defer"></script>'
  '<script src="./appsrc/window/frame.js" defer="defer"></script>'
)
script_to_remove='<script src="./copilot/index.js" defer="defer"></script>'

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

      for script_to_remove_after in "${script_to_remove_after_candidates[@]}"; do
        if echo "$content" | grep -qF "$script_to_remove_after"; then
          if echo "$content" | grep -qF "$script_to_remove"; then
            echo "Removing Copilot plugin script after \"$script_to_remove_after\"..."

            escaped_script_to_remove=$(escape_for_sed "$script_to_remove")
            new_content=$(echo "$content" | sed -E "/[[:space:]]*$escaped_script_to_remove/d")

            # Remove script
            echo "$new_content" >"$window_html_path"

            # Remove `<path_of_window_html>/copilot/` directory
            copilot_dir=$(dirname "$window_html_path")/copilot
            if [[ -d "$copilot_dir" ]]; then
              echo "Removing Copilot plugin directory \"$copilot_dir\"..."
              rm -rf "$copilot_dir"
            fi

            echo "Successfully uninstalled Copilot plugin in Typora."

            success=true
            break
          else
            echo "Warning: Copilot plugin has not been installed in Typora."
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
