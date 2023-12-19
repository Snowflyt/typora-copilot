# Typora Copilot

[English](./README.md) | 简体中文

![Copilot 建议截图](./docs/screenshot.zh-CN.png)

[Typora](https://typora.io/) 的 [GitHub Copilot](https://github.com/features/copilot) 插件，由 [Copilot.vim](https://github.com/github/copilot.vim) 提供支持。

该插件使用从 Copilot.vim 提取的 LSP 服务器，以在编辑器中实时提供建议。

**⚠️ 警告：**该插件仍在开发中，可能无法正常工作。请谨慎使用。

_暂不支持 macOS. 此外该插件在 Linux 上的使用尚未经过充分测试，但应该可以正常工作。_

## 兼容性

_\*注：`/` 表示未经过测试。_

**⚠️ 警告：**对于使用 Typora < 1.6 的用户，你需要安装 [Node.js](https://nodejs.org/en/download/) ≥ 18.

| Typora Version | Windows 11 | Ubuntu 22.04 | macOS 14.2 |
| -------------- | ---------- | ------------ | ---------- |
| 1.7.6          | √          | /            | ×          |
| 1.6.7          | √          | /            | ×          |
| 1.6.4-dev      | √          | /            | ×          |
| 1.5.12         | √          | /            | ×          |
| 1.4.8          | √          | /            | ×          |
| 1.3.8          | √          | /            | ×          |
| 1.2.5          | √          | /            | ×          |
| 1.2.3          | √          | /            | ×          |
| 1.0.3          | √          | /            | ×          |
| 0.11.18-beta   | √          | /            | ×          |

## 前置条件

- 公网连接（对于中国大陆用户，你还需要确保你的网络可以正常访问 GitHub Copilot 服务）。
- 已激活的 GitHub Copilot 订阅。

## 安装

### 脚本安装（推荐）

对于所有平台的用户，首先从[发布页面](https://github.com/Snowfly-T/typora-copilot/releases)下载最新版本并解压。

然后，对于 Windows 用户，定位到你解压的文件夹并在 PowerShell 中**以管理员身份**运行以下命令：

```powershell
.\bin\install_windows.ps1
```

如果脚本无法找到 Typora，你可以手动指定 Typora 的路径：

```powershell
.\bin\install_windows.ps1 -Path "C:\Program Files\Typora\" # 替换为你的 Typora 路径
# 或使用别名
# .\bin\install_windows.ps1 -p "C:\Program Files\Typora\" # 替换为你的 Typora 路径
```

安装过程中，你会看到一条消息记录插件的安装目录。_记住它，在卸载插件时你会需要它。_ 安装完成后，你可以安全地删除刚才解压的文件夹。

对于 Linux 用户，定位到你解压的文件夹并在终端中运行以下命令：

```bash
sudo bash ./bin/install_linux.sh
```

如果脚本无法找到 Typora，你可以手动指定 Typora 的路径：

```bash
sudo bash ./bin/install_linux.sh --path "/usr/share/typora/" # 替换为你的 Typora 路径
# 或使用别名
# sudo bash ./bin/install_linux.sh -p "/usr/share/typora/" # 替换为你的 Typora 路径
```

安装过程中，你会看到一条消息记录插件的安装目录。_记住它，在卸载插件时你会需要它。_ 安装完成后，你可以安全地删除刚才解压的文件夹。

### 手动安装

_以下对 macOS 用户的说明仅供参考，本插件暂不支持 macOS._

1. 从[发布页面](https://github.com/Snowfly-T/typora-copilot/releases)下载最新版本并解压。
2. 找到 Typora 安装目录下的 `window.html` 文件，通常位于 `<typora_root_path>/resources/`；对于 macOS 用户，找到 Typora 安装目录下的 `index.html` 文件，通常位于 `<typora_root_path>/Contents/Resources/TypeMark/`。`<typora_root_path>` 是 Typora 的安装路径，替换为你的实际 Typora 安装路径（注意尖括号 `<` 和 `>` 也要删除）。这个文件夹在下面的步骤中被称为 Typora 资源文件夹。
3. 在 Typora 资源文件夹中创建一个名为 `copilot` 的文件夹。
4. 将解压出的文件全局复制到 `copilot` 文件夹中。
5. 对于 Windows / Linux 用户，在 Typora 资源文件夹中用文本编辑器打开 `window.html`，在类似 `<script src="./appsrc/window/frame.js" defer="defer"></script>` 或 `<script src="./app/window/frame.js" defer="defer"></script>` 的代码之后添加 `<script src="./copilot/index.js" defer="defer"></script>`；对于 macOS 用户，在 Typora 资源文件夹中用文本编辑器打开 `index.html`，在类似 `<script src="./appsrc/main.js" aria-hidden="true" defer></script>` 或 `<script src="./app/main.js" aria-hidden="true" defer></script>` 的代码之后添加 `<script src="./copilot/index.js" defer></script>`。
6. 重启 Typora。
7. 对于 macOS 用户，如果你在打开 Typora 时被提示“文件已损坏”，你可以按住 Ctrl 点击 Typora，并选择“打开”来打开 Typora.

## 初始化

完成安装后，你会在 Typora 工具栏中找到一个 Copilot 图标。点击它打开 Copilot 面板，然后点击“Sign in to authenticate Copilot”。

![Copilot 图标](./docs/toolbar-icon.zh-CN.png)

按照提示进行身份验证：

1. 用户代码会自动复制到你的剪贴板。
2. 遵照弹出提示上的说明，打开 GitHub 身份验证页面。
3. 将用户代码粘贴到 GitHub 身份验证页面中。
4. 返回 Typora 并在对话框中按 OK。
5. 如果你在**几秒钟后**看到一个“Copilot Signed In”对话框，Copilot 插件应该就可以正常工作了（在中国大陆，你可能需要等待更长的时间）。

## 卸载

### 脚本卸载（推荐）

对于 Windows 用户，定位到插件安装目录并在 PowerShell 中**以管理员身份**运行以下命令：

```powershell
.\bin\uninstall_windows.ps1
```

和安装时一样，如果脚本无法找到 Typora，你可以手动通过 `-Path` 或 `-p` 参数指定 Typora 的路径。

对于 Linux 用户，定位到插件安装目录并在终端中运行以下命令：

```bash
sudo bash ./bin/uninstall_linux.sh
```

和安装时一样，如果脚本无法找到 Typora，你可以手动通过 `--path` 或 `-p` 参数指定 Typora 的路径。

### 手动卸载

_以下对 macOS 用户的说明仅供参考，本插件暂不支持 macOS._

1. 找到 Typora 安装目录下的 `window.html` 文件，通常位于 `<typora_root_path>/resources/`；对于 macOS 用户，找到 Typora 安装目录下的 `index.html` 文件，通常位于 `<typora_root_path>/Contents/Resources/TypeMark/`. `<typora_root_path>` 是 Typora 的安装路径，替换为你的实际 Typora 安装路径（注意尖括号 `<` 和 `>` 也要删除）。这个文件夹在下面的步骤中被称为 Typora 资源文件夹。
2. 删除 Typora 资源文件夹中的 `copilot` 文件夹。
3. 对于 Windows / Linux 用户，在 Typora 资源文件夹中用文本编辑器打开 `window.html`，删除 `<script src="./copilot/index.js" defer="defer"></script>`；对于 macOS 用户，在 Typora 资源文件夹中用文本编辑器打开 `index.html`，删除 `<script src="./copilot/index.js" defer></script>`.
4. 重启 Typora。

## 已知问题

1. 在实时预览模式（正常模式）下，代码块中的补全可能无法正常工作，并可能破坏编辑器内容或历史记录。
2. 有时接受建议可能会导致编辑器重新渲染（即代码块、数学块等将重新渲染）。这是由于 Typora API 的限制，我必须有时强制编辑器重新渲染以接受建议，目前我找不到更安全和更高效的方法来解决这个问题。

## 常见问题

### 为什么在实时预览模式（正常模式）下使用建议面板，在源代码模式下使用补全文本？我可以在实时预览模式下也使用补全文本，或者在源代码模式下也使用建议面板吗？

在实时预览模式下使用建议面板是有意的。Typora 在实时预览模式下的渲染机制很复杂，很难使补全文本在实时预览模式下正常工作。

在源代码模式下也使用建议面板是技术上可行的，但目前我没什么时间也没打算实现它。也许我将来会实现它。

### 我可以使用除 `Tab` 键以外的按键来接受建议吗？

目前不行。技术上也是可行的，但目前我没什么时间实现它。也许我将来会实现它。
