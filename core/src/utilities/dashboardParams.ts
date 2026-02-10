export function parseSiteIdParam(siteId: unknown): number | null {
	if (typeof siteId === "number" && Number.isFinite(siteId)) return siteId;
	if (typeof siteId === "string") {
		const trimmed = siteId.trim();
		if (trimmed.length === 0) return null;
		const parsed = Number(trimmed);
		if (Number.isFinite(parsed) && !Number.isNaN(parsed)) return parsed;
	}
	return null;
}

/** Returns true when value is a date-only string like "2026-02-08" (no time component). */
export function isDateOnly(value: unknown): boolean {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
	if (typeof timeZone !== "string" || timeZone.trim().length === 0) return false;
	try {
		Intl.DateTimeFormat(undefined, { timeZone: timeZone.trim() });
		return true;
	} catch {
		return false;
	}
}

type DateBoundary = "start" | "end";

function getTimeZoneDateParts(date: Date, timeZone: string): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
} | null {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	});

	const parts = formatter.formatToParts(date);
	const year = Number(parts.find((part) => part.type === "year")?.value);
	const month = Number(parts.find((part) => part.type === "month")?.value);
	const day = Number(parts.find((part) => part.type === "day")?.value);
	const hour = Number(parts.find((part) => part.type === "hour")?.value);
	const minute = Number(parts.find((part) => part.type === "minute")?.value);
	const second = Number(parts.find((part) => part.type === "second")?.value);

	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day) ||
		!Number.isFinite(hour) ||
		!Number.isFinite(minute) ||
		!Number.isFinite(second)
	) {
		return null;
	}

	return {
		year,
		month,
		day,
		hour,
		minute,
		second,
	};
}

function toUtcDateFromTimeZoneLocal(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	second: number,
	millisecond: number,
	timeZone: string,
): Date | null {
	const targetWithoutMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
	let guess = targetWithoutMs;

	for (let i = 0; i < 4; i++) {
		const parts = getTimeZoneDateParts(new Date(guess), timeZone);
		if (!parts) return null;

		const representedWithoutMs = Date.UTC(
			parts.year,
			parts.month - 1,
			parts.day,
			parts.hour,
			parts.minute,
			parts.second,
			0,
		);

		const delta = targetWithoutMs - representedWithoutMs;
		guess += delta;
		if (delta === 0) break;
	}

	const parsed = new Date(guess + millisecond);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed;
}

function parseDateOnlyInTimeZone(value: string, timeZone: string, boundary: DateBoundary): Date | null {
	const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!dateOnlyMatch) return null;

	const year = Number(dateOnlyMatch[1]);
	const month = Number(dateOnlyMatch[2]);
	const day = Number(dateOnlyMatch[3]);

	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
		return null;
	}

	if (boundary === "end") {
		return toUtcDateFromTimeZoneLocal(year, month, day, 23, 59, 59, 999, timeZone);
	}

	return toUtcDateFromTimeZoneLocal(year, month, day, 0, 0, 0, 0, timeZone);
}

export function parseDateParam(
	value: unknown,
	options: { timeZone?: string | null; boundary?: DateBoundary } = {},
): Date | null {
	if (!value) return null;
	if (typeof value !== "string") return null;
	const boundary = options.boundary ?? "start";
	const timeZone = isValidTimeZone(options.timeZone) ? options.timeZone : null;
	const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (dateOnlyMatch) {
		if (timeZone) {
			return parseDateOnlyInTimeZone(value, timeZone, boundary);
		}
		// Use UTC so date boundaries align with how events are stored (unix epoch / UTC)
		const year = Number(dateOnlyMatch[1]);
		const month = Number(dateOnlyMatch[2]);
		const day = Number(dateOnlyMatch[3]);
		const utcDate = new Date(Date.UTC(year, month - 1, day));
		if (boundary === "end") {
			utcDate.setUTCHours(23, 59, 59, 999);
		}
		if (Number.isNaN(utcDate.getTime())) return null;
		return utcDate;
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed;
}

export function matchesSourceFilter(
	referer: unknown,
	sourceFilter: string,
): boolean {
	if (sourceFilter.length === 0) return true;

	if (!referer) {
		return sourceFilter.toLowerCase() === "direct";
	}

	const refererString = String(referer);
	if (refererString.length === 0 || refererString === "null") {
		return sourceFilter.toLowerCase() === "direct";
	}

	const filterLower = sourceFilter.toLowerCase();
	if (filterLower === "direct") {
		return false;
	}

	try {
		const refererUrl = new URL(refererString);
		return refererUrl.hostname.toLowerCase().includes(filterLower);
	} catch {
		return refererString.toLowerCase().includes(filterLower);
	}
}
