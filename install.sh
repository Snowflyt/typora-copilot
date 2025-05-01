#!/usr/bin/env bash

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

latest_release=$(curl -s https://api.github.com/repos/Snowflyt/typora-copilot/releases/latest)
download_url=$(echo "$latest_release" | grep '"browser_download_url"' | head -n 1 | sed -E 's/.*"browser_download_url": "(.*)".*/\1/')
tag_name=$(echo "$latest_release" | grep '"tag_name"' | head -n 1 | sed -E 's/.*"tag_name": "(.*)".*/\1/')
curl -L "$download_url" -o "typora-copilot-$tag_name.zip"
if [ -d "typora-copilot-$tag_name" ]; then
  rm -rf "typora-copilot-$tag_name"
fi
mkdir "typora-copilot-$tag_name"
unzip "typora-copilot-$tag_name.zip" -d "typora-copilot-$tag_name"
rm "typora-copilot-$tag_name.zip"
cd "typora-copilot-$tag_name" || exit
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Trying to uninstall the previous version (if any)..."
  chmod +x ./bin/uninstall_macos.sh
  ./bin/uninstall_macos.sh --silent
  echo "Trying to install the new version..."
  chmod +x ./bin/install_macos.sh
  ./bin/install_macos.sh
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "Trying to uninstall the previous version (if any)..."
  chmod +x ./bin/uninstall_linux.sh
  ./bin/uninstall_linux.sh --silent
  echo "Trying to install the new version..."
  chmod +x ./bin/install_linux.sh
  ./bin/install_linux.sh
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi
cd ..
rm -rf "typora-copilot-$tag_name"
