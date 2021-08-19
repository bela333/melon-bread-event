import Discord, { Intents } from "discord.js";
import settings from "./settings.js";
import { setResetInterval } from "./utils/resets.js";
import handleInteraction, { activeUsers } from "./interaction-handler.js";
import { dbLoaded } from "./db.js";

const client = new Discord.Client({
	intents: [
		Intents.FLAGS.GUILD_MEMBERS,
		Intents.FLAGS.GUILD_MESSAGES
	],
});

let announcementChannel: Discord.TextChannel;

async function announceReset(): Promise<Discord.Message | undefined> {
	console.log("Announcing reset…");

	if (typeof announcementChannel === "object") {
		return announcementChannel.send(
			"**Stealing pairs have been reset!** Everyone can now steal with anyone again!"
		);
	}
}


client.on("messageCreate", message => {
	if (message.channel?.id === settings.commandChannel) {
		activeUsers.add(message.author.id);
	}
});

client.on('interactionCreate', handleInteraction);

console.log("Loading database and logging in…")

await Promise.all([
	client.login(settings.token),
	dbLoaded
]);

console.log("Loading users…");


const guild = await client.guilds.fetch(settings.guild);

await guild.members.fetch();
await guild.channels.fetch();
await guild.roles.fetch();

console.log("Ready!");

if (settings.announcementChannel) {
	const channel = await client.channels.fetch(settings.announcementChannel);

	if (channel instanceof Discord.TextChannel) {
		announcementChannel = channel;
	} else {
		console.warn("Warning: Announcement channel isn't a text channel. No announcements will be made.")
	}
}

setResetInterval(announceReset);
