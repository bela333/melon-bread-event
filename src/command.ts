import got from "got";
import settings from "./settings.js";

const action = process.argv[2];

if (action !== "register" && action !== "delete" && action !== "list") {
	console.error("Error: Unknown command.")
	console.info("You can use \"command register\", \"command delete\", or \"command list\".");
	process.exit(1);
}

const headers = {
	"Authorization": "Bot " + settings.token,
	"User-Agent": "DiscordBot (https://satania.moe, 1.0.0)",
	"Accept": "application/json"
};

const user: any = await got.get("https://discord.com/api/v9/oauth2/applications/@me", {
	headers,
}).json();

const id: string = user.id;

if (typeof id !== "string") {
	throw new Error("Expected ID to be a string");
}

if (action === "register") {
	const res = await got.post(`https://discord.com/api/v9/applications/${id}/guilds/${settings.guild}/commands`, {
		headers,
		json: {
			name: settings.registerCommand.name,
			description: settings.registerCommand.description,
			type: 1,
		},
		responseType: "json"
	});

	const data: any = res.body;

	console.log("Success! The command has been registered.");
	console.log("Its ID is the following: " + data.id);
	console.log("Be sure to add it to your settings under \"command\"");
} else if (action === "delete") {
	const res = await got.delete(`https://discord.com/api/v9/applications/${id}/guilds/${settings.guild}/commands/${settings.command}`, {
		headers
	});

	console.log("Success! The command has been deleted.")
} else if (action === "list") {
	const res = await got.get(`https://discord.com/api/v9/applications/${id}/guilds/${settings.guild}/commands`, {
		headers,
		responseType: "json"
	});

	const data: any = res.body;

	console.log("Commands on " + settings.guild + ":")

	const longest = Math.max(...data.map((command: any) => command.name.length));

	for (const command of data) {
		console.log(" - " + command.name.padStart(longest) + ": " + command.id);
	}
}
