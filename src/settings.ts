import fs from "fs/promises";
import { z, ZodError } from "zod";
import TOML from "@ltd/j-toml";

const schema = z.object({
	token: z.string(),
	guild: z.string(),
	command: z.string(),
	reset: z.object({
		start: z.date(),
		interval: z.number(),
	}),
	commandChannel: z.string(),
	announcementChannel: z.union([z.literal(false), z.string()]).optional(),
	rewardRole: z.union([z.literal(false), z.string()]).optional(),
	registerCommand: z.object({
		name: z.string(),
		description: z.string()
	}),
	interactions: z.object({
		currency: z.record(z.string()),
		embedFooter: z.record(z.string()),
		successThumbnail: z.string(),
		buttonEmoji: z.union([z.literal(false), z.string()]).optional(),
	}),
	milestones: z.record(z.union([z.literal(false), z.string()])),
});

export type Settings = z.infer<typeof schema>;

const content = await fs.readFile("./settings.toml", "utf8");

const SETTINGS_ERROR_TEXT = `
---------------------------------------

This error occured while trying to validate the settings.
Your \`settings.toml\` file may be invalid, be sure to double-check it.`;

let data: unknown;

try {
	data = TOML.parse(content, 1.0, "\n", false);
} catch (err) {
	console.error(err);
	console.error(SETTINGS_ERROR_TEXT);
	if (err instanceof RangeError) {
		console.error("\nHelp: This kind of error probably means that you forgot the quotes (\") around an ID.");
		process.exit(1);
	} else if (err instanceof SyntaxError || err instanceof Error) {
		console.error("\nHelp: This kind of error means the syntax of your `settings.toml` file is invalid.");

		const lineMatch = /line (\d+)/.exec(err.message);

		if (lineMatch) {
			const line = parseFloat(lineMatch[1]);
			console.error(`This error occured around line ${line.toLocaleString()}.`);
		}

		if (err.message.includes("Bad basic string")) {
			console.error("You may have forgotten to end a string with a quote (\").");
		}

		if (err.message.includes("Invalid Float") || err.message.includes("Invalid Integer")) {
			console.error("You may have forgotten to put quotes (\") around a string");
			console.error("or there might be an extra character.")
		}

		if (err.message.includes("Table header is not closed")) {
			console.error("You may have forgotten to end a section header with a closing bracket (]).");
		}

		if (err.message.includes("Keys must equal something")) {
			console.error("You may have forgotten an equal sign (=)");
			console.error("or to start a section header with an opening bracket ([).");
		}

		if (err.message.includes("Value can not be missing after euqal sign")) {
			console.error("You may have forgotten to write a value after the equal sign (=)");
			console.error("If you want to disable an option, you must set it to false (no quotes), or remove it entirely.")
		}

		if (err.message.includes("Duplicate property definition")) {
			console.error("The same property was defined twice. Look for duplicates.");
		}

		if (err.message.includes("Unexpect charachtor")) {
			console.error("You may have an extra character at the end of the line.");
		}

		if (err.message.includes("Invalid Local Date-Time") || err.message.includes("Invalid Offset Date-Time")) {
			console.error("The date wasn't formatted correctly.")
			console.error("You may format it like 2021-12-31T23:59:59Z, check https://en.wikipedia.org/wiki/ISO_8601 for other possible formats.");
		}

		if (err.message.includes("Bad bare key")) {
			console.error("You may have forgotten to write the key name before the equal sign (=).");
		}
	}

	process.exit(1);
}

let settings: Settings;

try {
	settings = schema.parse(data);
} catch (err) {
	console.error(err);

	if (err instanceof ZodError) {
		console.error(SETTINGS_ERROR_TEXT);

		if (err.errors.length > 0) {
			console.log("\nErrors found:\n");
		}

		for (const validationError of err.errors) {
			console.error(validationError.path.join(" → ") + ":\n  ⤷ " + validationError.message);

			if (validationError.code === "invalid_type") {
				if (validationError.received === "undefined") {
					console.error("    Help: This value is required but wasn't found in your file.")
					console.error("          If you see it, make sure it's in the right section.")
				} else if (validationError.received === "string") {
					console.error("    Help: Maybe you used quotes (\") when you shouldn't have.")
				} else if (validationError.expected === "string") {
					console.error("    Help: Maybe you forgot to put quotes (\").")
				} else if (validationError.expected === "date") {
					console.error("    Help: Dates must be written with no quotes in the ISO 8601 format. https://en.wikipedia.org/wiki/ISO_8601")
				}

			}
		}
	}

	process.exit(1);
}


export default settings;