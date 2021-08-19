import { DateTime } from "luxon";
import humanize from "humanize-duration";
import settings from "../settings.js";

const start = DateTime.fromJSDate(settings.reset.start);
const interval = settings.reset.interval;

export function nextReset(): DateTime {
	const timeSinceStart = start.until(DateTime.now());
	const currentCycleNumber = timeSinceStart.length("seconds") / interval;
	const nextCycleNumber = Math.ceil(currentCycleNumber);
	const timeSinceStartAtNextCycle = nextCycleNumber * interval;
	const nextCycle = start.plus({ seconds: timeSinceStartAtNextCycle });

	return nextCycle;
}

export function timeUntilNextReset() {
	return DateTime.now().until(nextReset());
}

export function humanTimeUntilReset(): string {
	return humanize(timeUntilNextReset().length("milliseconds"), {
		round: true,
		largest: 2,
		spacer: "\u00A0" // NBSP
	});
}

const resetIntervalIDs: Map<number, NodeJS.Timeout> = new Map();
let intervalCounter = 0;

export function setResetInterval(func: () => void): number {
	const intervalID = intervalCounter;
	intervalCounter++;

	function recursion() {
		resetIntervalIDs.set(intervalID,
			setTimeout(() => {
				func();
				recursion();
			}, timeUntilNextReset().length("milliseconds"))
		);
	}

	recursion();

	return intervalID;
}

export function clearResetInterval(intervalID: number) {
	const timeoutID = resetIntervalIDs.get(intervalID);

	if (timeoutID) {
		clearTimeout(timeoutID);
	}
}
