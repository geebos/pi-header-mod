import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHeaderConfigState, registerHeaderCommand } from "../src/command.js";
import { isValidHeaderValue } from "../src/config.js";
import { resolveProjectIdentifier, resolveProjectName } from "../src/project.js";

function setHeader(
	headers: Record<string, string | null>,
	name: string,
	value: string,
): void {
	const lowerName = name.toLowerCase();
	for (const existingName of Object.keys(headers)) {
		if (existingName.toLowerCase() === lowerName) delete headers[existingName];
	}
	headers[name] = value;
}

export default function (pi: ExtensionAPI): void {
	const state = createHeaderConfigState();
	registerHeaderCommand(pi, state);

	pi.on("before_provider_headers", async (event, ctx) => {
		const config = state.config;
		const cacheKey = `${ctx.cwd}\u0000${config.mode}\u0000${config.customValue}`;
		let identifierPromise = state.identifierCache.get(cacheKey);
		if (!identifierPromise) {
			identifierPromise = resolveProjectIdentifier(config, ctx.cwd);
			state.identifierCache.set(cacheKey, identifierPromise);
		}

		const identifier = await identifierPromise;
		if (identifier && isValidHeaderValue(identifier)) {
			setHeader(event.headers, config.header, identifier);
		}

		let projectNamePromise = state.projectNameCache.get(ctx.cwd);
		if (!projectNamePromise) {
			projectNamePromise = resolveProjectName(ctx.cwd);
			state.projectNameCache.set(ctx.cwd, projectNamePromise);
		}
		const projectName = await projectNamePromise;
		if (projectName && isValidHeaderValue(projectName)) {
			setHeader(event.headers, config.projectNameHeader, projectName);
		}
	});
}
