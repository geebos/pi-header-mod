import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const PROJECT_IDENTIFIER_MODES = [
	"directory",
	"repo",
	"worktree",
	"custom",
] as const;

export type ProjectIdentifierMode = (typeof PROJECT_IDENTIFIER_MODES)[number];

export interface HeaderConfig {
	header: string;
	projectNameHeader: string;
	mode: ProjectIdentifierMode;
	customValue: string;
}

export const DEFAULT_CONFIG: Readonly<HeaderConfig> = {
	header: "Pi-Project-Identifier",
	projectNameHeader: "Pi-Project-Name",
	mode: "repo",
	customValue: "",
};

function expandHome(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/") || path.startsWith("~\\")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}

function resolvePiAgentDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR;
	if (configured) return expandHome(configured);
	return join(homedir(), ".pi", "agent");
}

export function getConfigPath(): string {
	return join(resolvePiAgentDir(), "extensions", "pi-header-mod", "config.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isProjectIdentifierMode(value: unknown): value is ProjectIdentifierMode {
	return (
		typeof value === "string" &&
		(PROJECT_IDENTIFIER_MODES as readonly string[]).includes(value)
	);
}

/** HTTP token validation for a configurable request header name. */
export function isValidHeaderName(value: string): boolean {
	return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value);
}

export function isValidHeaderValue(value: string): boolean {
	return !/[\r\n]/.test(value);
}

function normalizeHeader(value: unknown): string {
	if (typeof value !== "string") return DEFAULT_CONFIG.header;
	const header = value.trim();
	return isValidHeaderName(header) ? header : DEFAULT_CONFIG.header;
}

function normalizeMode(value: unknown): ProjectIdentifierMode {
	return isProjectIdentifierMode(value) ? value : DEFAULT_CONFIG.mode;
}

function normalizeCustomValue(value: unknown): string {
	if (typeof value !== "string") return DEFAULT_CONFIG.customValue;
	return isValidHeaderValue(value) ? value : DEFAULT_CONFIG.customValue;
}

/** Load the persisted file config. Invalid or missing values fall back safely. */
export function loadFileConfig(): HeaderConfig {
	const path = getConfigPath();
	if (!existsSync(path)) return { ...DEFAULT_CONFIG };

	try {
		const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
		if (!isRecord(raw)) return { ...DEFAULT_CONFIG };
		const section = isRecord(raw.projectIdentifier)
			? raw.projectIdentifier
			: raw;
		const projectName = isRecord(raw.projectName) ? raw.projectName : undefined;

		return {
			header: normalizeHeader(section.headerName ?? section.header),
			projectNameHeader: normalizeHeader(
				projectName?.headerName ??
					projectName?.header ??
					raw.projectNameHeader,
			),
			mode: normalizeMode(section.mode),
			customValue: normalizeCustomValue(section.customValue),
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

/** Save config atomically so an interrupted write cannot leave invalid JSON. */
export function saveFileConfig(config: HeaderConfig): void {
	const path = getConfigPath();
	const dir = dirname(path);
	mkdirSync(dir, { recursive: true });

	const tmp = `${path}.${process.pid}.tmp`;
	const body = JSON.stringify(
		{
			projectIdentifier: {
				headerName: config.header,
				mode: config.mode,
				customValue: config.customValue,
			},
			projectName: {
				headerName: config.projectNameHeader,
			},
		},
		null,
		2,
	);

	writeFileSync(tmp, body + "\n", { encoding: "utf8", mode: 0o600 });
	try {
		renameSync(tmp, path);
	} catch {
		writeFileSync(path, body + "\n", { encoding: "utf8", mode: 0o600 });
		try {
			unlinkSync(tmp);
		} catch {
			// Ignore cleanup failure after the fallback write.
		}
	}
}

export function resetFileConfig(): HeaderConfig {
	const config = { ...DEFAULT_CONFIG };
	saveFileConfig(config);
	return config;
}

export function formatConfigSummary(config: HeaderConfig): string {
	const customValue = config.mode === "custom"
		? config.customValue || "(empty)"
		: "(not used)";
	return [
		"pi-header-mod settings:",
		`  projectIdentifier.headerName  ${config.header}`,
		`  projectName.headerName        ${config.projectNameHeader}`,
		`  projectIdentifier.mode        ${config.mode}`,
		`  projectIdentifier.customValue ${customValue}`,
		`  Config file                   ${getConfigPath()}`,
	].join("\n");
}
