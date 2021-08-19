import Discord, { DiscordAPIError } from "discord.js";
import settings from "./settings.js";
import { formatCurrency, formatPair, pluralCurrency, pluralFooter } from "./utils/text.js";
import { humanTimeUntilReset, nextReset } from "./utils/resets.js"
import { TemporarySet } from "./utils/temporary-set.js";
import { getAccount, saveUser, totalBaked, updateTotal } from "./db.js";

export const activeUsers: TemporarySet<string> = new TemporarySet(60000);
const cooldowns: TemporarySet<string> = new TemporarySet(15000);

async function checkMilestone(inviter: Discord.GuildMember, partner: Discord.GuildMember) {
	const milestone = settings.milestones[totalBaked.toString()];

	if (milestone != null && typeof settings.announcementChannel === "string") {
		const announcementChannel = await inviter.client.channels.fetch(settings.announcementChannel);

		if (announcementChannel instanceof Discord.TextChannel) {
			let content = `Congratulations to ${inviter} and ${partner} for stealing the **${formatPair(totalBaked)}!**`;

			if (milestone !== false) {
				content += ` (${milestone})`;
			}

			return announcementChannel.send({
				content,
				allowedMentions: {
					users: [inviter.id, partner.id],
				}
			});
		}
	}
}

function handleBuggedInteractions(channel: Discord.TextBasedChannels | null, action: string) {
	return async (err: DiscordAPIError) => {
		if (err instanceof DiscordAPIError && err.httpStatus === 404) {
			if (channel) {
				await channel.send(`Something strange just happened: I received an interaction, but when I tried to reply to it… it was gone. If any of you have an idea of what you did to do this, please let the devs know. This happened while I was ${action}.`);
			}

			console.error(err);

			return null;
		}

		throw err;
	}
}

export default async function handleInteraction(interaction: Discord.Interaction): Promise<any> {
	if (!(interaction instanceof Discord.CommandInteraction)) return;
	if (interaction.commandId !== settings.command) return;

	if (interaction.channel?.id !== settings.commandChannel) {
		return interaction.reply({ content: `You can only use this command in <#${settings.commandChannel}>.`, ephemeral: true })
			.catch(handleBuggedInteractions(interaction.channel, `telling ${interaction.user.tag} where they can use the command`));
	}

	if (!interaction.guildId) return;

	const guild = await interaction.client.guilds.fetch(interaction.guildId);

	if (!guild) return;

	const inviter = await guild.members.fetch(interaction.user);
	activeUsers.add(inviter.id);

	if (cooldowns.has(inviter.id)) {
		return interaction.reply({ content: "You already have a recent pending invite, please wait a bit…", ephemeral: true })
			.catch(handleBuggedInteractions(interaction.channel, `telling ${interaction.user.tag} to wait before sending a new invite`));
	}

	const inviterAccount = getAccount(inviter.id);

	const activeMembers = (await Promise.all(
		[...activeUsers]
			.filter(id =>
				id !== inviter.id &&
				id !== interaction.client.user?.id
			)
			.map(id => guild.members.fetch(id))
	)).filter(member => !member.user.bot);

	activeMembers.sort((a, b) => a.displayName.localeCompare(b.displayName, 'en', {
		ignorePunctuation: true,
		sensitivity: 'base',
		numeric: true
	}));

	const couldAccept = activeMembers
		.filter(member => !inviterAccount.received.includes(member.id));

	const cantAccept = activeMembers
		.filter(member => inviterAccount.received.includes(member.id));

	const embed = new Discord.MessageEmbed({
		color: 0xFFB100,
		author: {
			name: `${inviter.displayName} is looking for someone to steal melon bread with!`
		},
		description: `Go on a heist with them, and you will both get **${formatCurrency(1)}**!`,
		footer: {
			text: pluralFooter(totalBaked),
		},
		thumbnail: {
			url: inviter.user.displayAvatarURL({
				dynamic: true,
			})
		}
	});

	if (couldAccept.length > 0) {
		embed.addField("Can accept", couldAccept.map(member => `  • **${member.displayName}**`).join("\n"), true);
	}

	if (cantAccept.length > 0) {
		embed.addField("Cannot accept", cantAccept.map(member => `  • ${member.displayName}`).join("\n"), true);
	}

	const button = new Discord.MessageButton()
		.setCustomId("steal")
		.setLabel("Let's steal!")
		.setStyle("SUCCESS");

	if (settings.interactions.buttonEmoji) {
		button.setEmoji(settings.interactions.buttonEmoji);
	}

	const row = new Discord.MessageActionRow()
		.addComponents(button);

	const invite = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true })
		.catch(handleBuggedInteractions(interaction.channel, `posting ${interaction.user.tag}'s invite`));

	cooldowns.add(inviter.id);

	if (!(invite instanceof Discord.Message)) {
		throw new Error("Invite wasn't a message");
	}

	const acceptation = await invite.awaitMessageComponent({
		filter: async (acceptation: Discord.ButtonInteraction) => {
			const partner = await guild.members.fetch(acceptation.user);

			if (
				partner.id === inviter.id ||
				partner.id === interaction.client.user?.id
			) {
				await acceptation.reply({
					content: `This is your invitation! You can't go on a heist with yourself, someone else has to accept it.`,
					ephemeral: true,
				}).catch(handleBuggedInteractions(acceptation.channel, `telling ${acceptation.user.tag} they can't STEAL with themselves`));

				return false;
			}

			activeUsers.add(partner.id);

			if (inviterAccount.received.includes(partner.id)) {
				await acceptation.reply({
					content: `You must wait **${humanTimeUntilReset()}** (<t:${nextReset().toSeconds()}>) before going on a heist with **${inviter.displayName}** again.`,
					ephemeral: true,
				}).catch(handleBuggedInteractions(acceptation.channel, `telling ${acceptation.user.tag} they must wait before STEALING with someone`));

				return false;
			}

			return true;
		},
		time: 30000
	}).catch(async error => {
		if (error.name === "Error [INTERACTION_COLLECTOR_ERROR]") {
			if (error.message === "Collector received no interactions before ending with reason: time") {
				await invite.edit({
					embeds: [{
						color: 15747399,
						author: {
							name: `${inviter.displayName} did not find anyone to go on a heist with ;_;`,
							icon_url: inviter.user.displayAvatarURL({
								dynamic: true,
							}) // eslint-disable-line camelcase
						},
						footer: {
							text: "If you want to go on a heist with them, you should mention them to say so!"
						}
					}],
					components: [],
				}).catch(handleBuggedInteractions(interaction.channel, `editing ${interaction.user.tag}'s invite to an unsuccessful one`));

				return null;
			} else if (error.message === "Collector received no interactions before ending with reason: messageDelete") {
				return null;
			}
		}

		throw error;
	});

	if (acceptation === null) {
		return;
	}

	const partner = await guild.members.fetch(acceptation.user);
	const partnerAccount = getAccount(partner.id);

	cooldowns.delete(inviter.id);
	updateTotal();

	embed.author!.name = "Stealing successful!";
	embed.color = 4437377;
	embed.title = `${inviter.displayName} and ${partner.displayName} have stolen a ${pluralCurrency(1)}!`;
	embed.description =
		`Both of you have received **${formatCurrency(1)}.**\n\n` +
		`You will be able to go on a heist again together in **${humanTimeUntilReset()}** on <t:${nextReset().toSeconds()}>.`;
	embed.footer!.text = pluralFooter(totalBaked+2);
	embed.thumbnail!.url = settings.interactions.successThumbnail;
	embed.fields = [];

	inviterAccount.points += 1;
	inviterAccount.received.push(partner.id);

	partnerAccount.points += 1;
	partnerAccount.received.push(inviter.id);

	await Promise.all<any>([
		invite.edit({ embeds: [embed], components: [] })
			.catch(handleBuggedInteractions(interaction.channel, `editing ${interaction.user.tag}'s invite to a sucessful one`)),
		saveUser(inviter.id, partner.id),
		checkMilestone(inviter, partner)
	]);

	if (settings.rewardRole) {
		await Promise.all([
			inviter.roles.add(settings.rewardRole),
			partner.roles.add(settings.rewardRole),
		]);
	}
}