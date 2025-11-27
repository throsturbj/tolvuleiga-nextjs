export const DEBUG: boolean = String(process.env.NEXT_PUBLIC_DEBUG).toLowerCase() === 'true';

export function debug(tag: string, ...args: unknown[]) {
	if (!DEBUG) return;
	try {
		// eslint-disable-next-line no-console
		console.log(`[${tag}]`, ...args);
	} catch {
		// no-op
	}
}


