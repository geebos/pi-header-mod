import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	formatConfigSummary,
	isProjectIdentifierMode,
	isValidHeaderName,
	isValidHeaderValue,
	loadFileConfig,
	PROJECT_IDENTIFIER_MODES,
	resetFileConfig,
	saveFileConfig,
	type HeaderConfig,
	type ProjectIdentifierMode,
} from "./config.js";

export interface HeaderConfigState {
	config: HeaderConfig;
	identifierCache: Map<string, Promise<string>>;
	projectNameCache: Map<string, Promise<string>>;
}

const MODE_DESCRIPTIONS: Record<ProjectIdentifierMode, string> = {
	directory: "Current directory path",
	repo: "Repository (domain/user/repo)",
	worktree: "Repository + worktree directory",
	custom: "User-defined value",
};

function currentLabel(mode: ProjectIdentifierMode, current: ProjectIdentifierMode): string {
	const suffix = mode === current ? " (current)" : "";
	return `${mode} — ${MODE_DESCRIPTIONS[mode]}${suffix}`;
}

function printHelp(ctx: ExtensionCommandContext): void {
	ctx.ui.notify(
		[
			"Usage:",
			"  /plugin:header                         Open settings",
			"  /plugin:header header                  Configure headerName fields",
			"  /plugin:header mod                     Configure projectIdentifier mode",
			"  /plugin:header projectidentifier       Open settings (alias)",
			"  /plugin:header show                    Show settings",
			"  /plugin:header reset                   Reset to defaults",
			"  /plugin:header set projectIdentifier.mode <mode>",
			"  /plugin:header set projectIdentifier.headerName <name>",
			"  /plugin:header set projectName.headerName <name>",
			"  /plugin:header set projectIdentifier.customValue <value>",
		].join("\n"),
		"info",
	);
}

async function configureProjectIdentifier(
	ctx: ExtensionCommandContext,
	state: HeaderConfigState,
): Promise<void> {
	if (ctx.mode !== "tui") {
		ctx.ui.notify(
			formatConfigSummary(state.config) +
				"\n\nInteractive settings require TUI mode. Use /plugin:header set ... instead.",
			"info",
		);
		return;
	}

	const setting = await ctx.ui.select("pi-header-mod settings", [
		"header — Request header names",
		"mod — Project identifier mode",
	]);
	if (setting === undefined) return;
	if (setting.startsWith("header ")) {
		await configureHeaders(ctx, state);
		return;
	}
	await configureMode(ctx, state);
}

async function configureHeaders(
	ctx: ExtensionCommandContext,
	state: HeaderConfigState,
): Promise<void> {
	const target = await ctx.ui.select("Request header to configure", [
		`Project identifier header (${state.config.header})`,
		`Project name header (${state.config.projectNameHeader})`,
	]);
	if (target === undefined) return;

	const isProjectName = target.startsWith("Project name header ");
	const current = isProjectName
		? state.config.projectNameHeader
		: state.config.header;
	const header = await ctx.ui.input(
		`${isProjectName ? "Project name" : "Project identifier"} request header name (current: ${current})`,
		current,
	);
	if (header === undefined) return;
	const normalizedHeader = header.trim();
	if (!isValidHeaderName(normalizedHeader)) {
		ctx.ui.notify("Header name is not a valid HTTP token", "error");
		return;
	}

	state.config = isProjectName
		? { ...state.config, projectNameHeader: normalizedHeader }
		: { ...state.config, header: normalizedHeader };
	saveFileConfig(state.config);
	state.identifierCache.clear();
	state.projectNameCache.clear();
	ctx.ui.notify("Header settings updated", "info");
}

async function configureMode(
	ctx: ExtensionCommandContext,
	state: HeaderConfigState,
): Promise<void> {
	const modeLabels = PROJECT_IDENTIFIER_MODES.map((mode) =>
		currentLabel(mode, state.config.mode),
	);
	const selectedMode = await ctx.ui.select(
		"Project identifier mode",
		modeLabels,
	);
	if (selectedMode === undefined) return;
	const mode = selectedMode.split(" ", 1)[0] as ProjectIdentifierMode;

	let customValue = state.config.customValue;
	if (mode === "custom") {
		const value = await ctx.ui.input(
			"Custom project identifier",
			state.config.customValue || "Enter a non-empty value",
		);
		if (value === undefined) return;
		customValue = value;
		if (!customValue || !isValidHeaderValue(customValue)) {
			ctx.ui.notify("Custom identifier cannot be empty or contain newlines", "error");
			return;
		}
	}

	state.config = {
		header: state.config.header,
		projectNameHeader: state.config.projectNameHeader,
		mode,
		customValue,
	};
	saveFileConfig(state.config);
	state.identifierCache.clear();
	state.projectNameCache.clear();
	ctx.ui.notify("Project identifier settings updated", "info");
}

function setConfigValue(
	ctx: ExtensionCommandContext,
	state: HeaderConfigState,
	key: string | undefined,
	value: string,
): void {
	if (!key) {
		ctx.ui.notify(
			"Usage: /plugin:header set <mode|header|name-header|custom> <value>",
			"error",
		);
		return;
	}

	const normalizedKey = key.toLowerCase();
	if (
		[
			"mode",
			"mod",
			"projectidentifier.mode",
			"projectidentifier.identifiermode",
			"project-identifier-mode",
		].includes(normalizedKey)
	) {
		if (!isProjectIdentifierMode(value)) {
			ctx.ui.notify(
				`Invalid mode '${value}'. Use: ${PROJECT_IDENTIFIER_MODES.join("|")}`,
				"error",
			);
			return;
		}
		state.config = { ...state.config, mode: value };
	} else if (
		[
			"header",
			"identifier-header",
			"projectidentifier.header",
			"projectidentifier.headername",
			"project-identifier-header",
			"project-identifier-header-name",
		].includes(normalizedKey)
	) {
		const header = value.trim();
		if (!isValidHeaderName(header)) {
			ctx.ui.notify("Header name is not a valid HTTP token", "error");
			return;
		}
		state.config = { ...state.config, header };
	} else if (
		[
			"name-header",
			"projectname",
			"projectname.header",
			"projectname.headername",
			"project-name-header",
			"project-name-header-name",
		].includes(normalizedKey)
	) {
		const header = value.trim();
		if (!isValidHeaderName(header)) {
			ctx.ui.notify("Header name is not a valid HTTP token", "error");
			return;
		}
		state.config = { ...state.config, projectNameHeader: header };
	} else if (
		[
			"custom",
			"custom-identifier",
			"projectidentifier.customvalue",
			"project-identifier-custom-value",
		].includes(normalizedKey)
	) {
		if (!value || !isValidHeaderValue(value)) {
			ctx.ui.notify("Custom identifier cannot be empty or contain newlines", "error");
			return;
		}
		state.config = { ...state.config, customValue: value };
	} else {
		ctx.ui.notify(`Unknown setting '${key}'`, "error");
		return;
	}

	saveFileConfig(state.config);
	state.identifierCache.clear();
	state.projectNameCache.clear();
	ctx.ui.notify(`${normalizedKey} updated`, "info");
}

export function createHeaderConfigState(): HeaderConfigState {
	return {
		config: loadFileConfig(),
		identifierCache: new Map(),
		projectNameCache: new Map(),
	};
}

export function registerHeaderCommand(
	pi: ExtensionAPI,
	state: HeaderConfigState,
): void {
	pi.registerCommand("plugin:header", {
		description: "Configure pi-header-mod project identifier headers",
		handler: async (args, ctx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const sub = parts[0]?.toLowerCase();

			if (!sub || sub === "projectidentifier") {
				await configureProjectIdentifier(ctx, state);
				return;
			}
			if (sub === "header") {
				await configureHeaders(ctx, state);
				return;
			}
			if (sub === "mod" || sub === "mode") {
				await configureMode(ctx, state);
				return;
			}

			switch (sub) {
				case "show":
				case "status":
					ctx.ui.notify(formatConfigSummary(state.config), "info");
					return;
				case "reset":
					state.config = resetFileConfig();
					state.identifierCache.clear();
					state.projectNameCache.clear();
					ctx.ui.notify("pi-header-mod settings reset to defaults", "info");
					return;
				case "set":
					setConfigValue(ctx, state, parts[1], parts.slice(2).join(" "));
					return;
				case "help":
				case "-h":
				case "--help":
					printHelp(ctx);
					return;
				default:
					ctx.ui.notify(`Unknown subcommand '${sub}'`, "error");
					printHelp(ctx);
			}
		},
	});
}
