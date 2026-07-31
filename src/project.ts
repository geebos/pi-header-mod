import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";
import type { HeaderConfig } from "./config.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string | undefined> {
	try {
		const result = await execFileAsync("git", ["-C", cwd, ...args], {
			encoding: "utf8",
			maxBuffer: 64 * 1024,
		});
		const stdout = typeof result.stdout === "string" ? result.stdout : "";
		return stdout.trim() || undefined;
	} catch {
		return undefined;
	}
}

function normalizeRemotePath(value: string): string[] {
	return value
		.trim()
		.replace(/[?#].*$/u, "")
		.replace(/^\/+|\/+$/gu, "")
		.replace(/\.git$/iu, "")
		.split("/")
		.map((part) => part.trim())
		.filter(Boolean);
}

/** Convert common Git remote formats to domain/path, without userinfo. */
export function formatRepoIdentifier(remote: string): string | undefined {
	const value = remote.trim();
	if (!value) return undefined;

	let host: string | undefined;
	let remotePath: string | undefined;

	// SCP-like SSH URL: git@github.com:owner/repo.git
	const scpMatch = !value.includes("://")
		? value.match(/^(?:[^@/:]+@)?([^/:]+):(.+)$/u)
		: undefined;
	if (scpMatch) {
		host = scpMatch[1];
		remotePath = scpMatch[2];
	} else {
		try {
			const url = new URL(value);
			host = url.host;
			remotePath = url.pathname;
		} catch {
			return undefined;
		}
	}

	if (!host || !remotePath) return undefined;
	const pathParts = normalizeRemotePath(remotePath);
	if (pathParts.length === 0) return undefined;

	return [host.toLowerCase(), ...pathParts].join("/");
}

export async function getOriginRepoIdentifier(cwd: string): Promise<string | undefined> {
	const remote = await git(cwd, ["remote", "get-url", "origin"]);
	return remote ? formatRepoIdentifier(remote) : undefined;
}

export async function getWorktreeName(cwd: string): Promise<string | undefined> {
	const root = await git(cwd, ["rev-parse", "--show-toplevel"]);
	if (!root) return undefined;
	const name = basename(root).trim();
	return name || undefined;
}

/** Resolve the short project name used by the Pi-Project-Name header. */
export async function resolveProjectName(cwd: string): Promise<string> {
	const repo = await getOriginRepoIdentifier(cwd);
	if (repo) {
		const repoName = repo.split("/").filter(Boolean).at(-1);
		if (repoName) return repoName;
	}

	return (await getWorktreeName(cwd)) ?? (basename(cwd) || cwd);
}

/** Resolve one request-header value from the configured mode. */
export async function resolveProjectIdentifier(
	config: Pick<HeaderConfig, "mode" | "customValue">,
	cwd: string,
): Promise<string> {
	if (config.mode === "directory") return cwd;
	if (config.mode === "custom") return config.customValue;

	const repo = await getOriginRepoIdentifier(cwd);
	if (!repo) return cwd;
	if (config.mode === "repo") return repo;

	const worktree = await getWorktreeName(cwd);
	return worktree ? `${repo}/${worktree}` : cwd;
}
