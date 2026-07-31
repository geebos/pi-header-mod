# pi-header-mod

`pi-header-mod` 为 [pi coding agent](https://pi.dev) 发起的模型请求添加项目标识请求头。

## 安装

```bash
pi install ./
```

本地直接测试：

```bash
pi -e ./extensions/index.ts
```

## 配置

运行：

```text
/plugin:header
```

默认配置：

```json
{
  "projectIdentifier": {
    "headerName": "Pi-Project-Identifier",
    "mode": "repo",
    "customValue": ""
  },
  "projectName": {
    "headerName": "Pi-Project-Name"
  }
}
```

配置保存于 `~/.pi/agent/extensions/pi-header-mod/config.json`。

在 TUI 中，`/plugin:header` 会显示并列的 `header — Request header names` 和 `mod — Project identifier mode` 两个选项。选择 `header` 后可分别配置 Project identifier header 和 Project name header；选择 `mod` 后可配置项目标识模式和自定义值。`Pi-Project-Name` 的取值方式固定，不在 UI 中配置。

支持四种模式：

- `directory`：当前 pi 工作目录（`cwd`）
- `repo`：根据 Git `origin` remote 生成 `domain/user/repo`
- `worktree`：生成 `domain/user/repo/<当前 worktree 目录名>`
- `custom`：使用用户配置的自定义值

插件还会发送 `Pi-Project-Name`，值为 remote 中的 repo 名（例如 `app`）。没有 repo 时回退到 Git 项目目录名或当前目录名。它不支持配置命名方式，只支持配置 Header 名称。

Remote URL 会移除认证信息和末尾 `.git`。如果无法读取 origin 或 worktree，则回退为目录值。

也可以使用命令行配置：

```text
/plugin:header show
/plugin:header reset
/plugin:header set projectIdentifier.mode repo
/plugin:header set projectIdentifier.headerName Pi-Project-Identifier
/plugin:header set projectName.headerName Pi-Project-Name
/plugin:header set projectIdentifier.customValue my-project
```

旧的 `set mode`、`set header`、`set name-header` 和 `set custom` 写法仍然兼容。

插件要求 pi `0.80.4` 或更高版本，以使用 `before_provider_headers` Hook。
