import Discord, { Intents } from "discord.js";
import { users, dbLoaded, totalBaked, updateTotal, db } from "./db.js";
import settings from "./settings.js";
import { formatCurrency } from "./utils/text.js";

function escape(str: string): string {
	return str.replace(/([\\`*{}[\]()|#+\-.!_>])/g, "\\$1");
}

const client = new Discord.Client({
	intents: [
		Intents.FLAGS.GUILD_MEMBERS,
	],
});

process.stderr.write("Loading database and logging in…\n")

await client.login(settings.token);

process.stderr.write("Loading users…\n");


const guild = await client.guilds.fetch(settings.guild);
await guild.members.fetch();

await dbLoaded;

interface LeaderboardEntry {
	name: string;
	points: number;
}

const leaderboard: LeaderboardEntry[] = await Promise.all(
	[...users].map(async ([id, user]) => {
		const member = await guild.members.fetch(id).catch(err => {
			if (err instanceof Discord.DiscordAPIError && err.httpStatus === 404) {
				return null;
			}

			throw err;
		});

		let name;

		if (member) {
			if (member.nickname) {
				name = `**${escape(member.displayName)}**\u2002${escape(member.user.tag)}`;
			} else {
				name = `**${escape(member.user.tag)}**`;
			}
		} else {
			name = `User left server (#${id})`;
		}

		return {
			points: user.points,
			name,
		}
	})
);


leaderboard.sort((a, b) => {
	if (a.points > b.points) {
		return -1;
	}

	if (a.points < b.points) {
		return 1;
	}

	return a.name.localeCompare(b.name, 'en', {
		ignorePunctuation: true,
		sensitivity: 'base',
		numeric: true
	})
});

updateTotal();

process.stdout.write(`## ${formatCurrency(totalBaked)} were baked by ${leaderboard.length.toLocaleString()} users\n\n`);

process.stdout.write(` |     # | Member Name                                              | ${settings.interactions.currency.other} Baked | \n`);
process.stdout.write(" | ----: | -------------------------------------------------------- | -----------------: | \n");

let rank = 0;

for (const [i, user] of leaderboard.entries()) {
	if (i === 0 || user.points !== leaderboard[i - 1].points) {
		rank = i + 1;
	}

	process.stdout.write([
		"",
		rank.toLocaleString().padStart(5),
		user.name.padEnd(56),
		("**" + user.points.toLocaleString() + "**").padStart(18),
		""
	].join(" | ") + "\n");
}

await client.destroy();
await db.close();