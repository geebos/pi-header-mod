# pi-header-mod

`pi-header-mod` adds a project identifier request header to model requests made by the [pi coding agent](https://pi.dev).

## Install

### npm (recommended)

```bash
pi install npm:pi-header-mod
```

### Git

```bash
pi install git:github.com/geebos/pi-header-mod
pi install git:github.com/geebos/pi-header-mod@v0.1.0
```

### GitHub Packages (optional)

Published as `@geebos/pi-header-mod`:

```bash
# ~/.npmrc
# @geebos:registry=https://npm.pkg.github.com
# //npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN

pi install npm:@geebos/pi-header-mod
```

## Configuration

After installation, start pi normally and run:

```text
/plugin:header
```

The extension is loaded automatically in subsequent pi sessions. Use `/plugin:header` to open the configuration UI, or use the command-line forms below for scripted configuration.

The default configuration is:

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

Configuration is stored in `~/.pi/agent/extensions/pi-header-mod/config.json`.

In TUI, `/plugin:header` presents two parallel options: `header — Request header names` and `mod — Project identifier mode`. Selecting `header` configures the Project identifier header and Project name header separately; selecting `mod` configures the identifier mode and custom value. The value resolution mode for `Pi-Project-Name` is fixed and is not configurable.

Modes:

- `directory`: the current pi working directory (`cwd`)
- `repo`: `domain/user/repo` from the `origin` Git remote
- `worktree`: `domain/user/repo/<worktree-directory-name>`
- `custom`: the configured custom value

The extension also sends `Pi-Project-Name`, whose value is the repository name from the remote (for example `app`). If no repository remote is available, it falls back to the Git project directory name or the current directory name. Its naming mode is not configurable; only its header name can be changed.

Remote URLs are normalized by removing credentials and the trailing `.git`. If the origin remote or worktree cannot be resolved, the identifier falls back to the directory value.

CLI alternatives:

```text
/plugin:header show
/plugin:header reset
/plugin:header set projectIdentifier.mode repo
/plugin:header set projectIdentifier.headerName Pi-Project-Identifier
/plugin:header set projectName.headerName Pi-Project-Name
/plugin:header set projectIdentifier.customValue my-project
```

The older `set mode`, `set header`, `set name-header`, and `set custom` forms remain supported.

The extension requires pi `0.80.4` or newer for the `before_provider_headers` hook.
