module.exports = {
    name: 'unmute',
    description: 'Stop deleting messages from muted user',
    category: 'admin',
    permissions: ['admin'],
    usage: '.unmute @user',
    aliases: ['unsilence'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to unmute.\n\nUsage: `.unmute @user`');
        }

        const targetUser = mentions[0];
        const targetPhone = targetUser.split('@')[0];

        try {
            // Check if user is muted
            const userData = bot.database.getUser(targetUser);
            if (!userData || userData.muted_until <= Math.floor(Date.now() / 1000)) {
                return reply(`❌ @${targetPhone} is not currently muted.`, {
                    mentions: [targetUser]
                });
            }

            // Remove mute
            bot.database.unmuteUser(targetUser);

            let unmuteMessage = `🔊 **USER UNMUTED**\n\n`;
            unmuteMessage += `👤 **User:** @${targetPhone}\n`;
            unmuteMessage += `👮 **Unmuted by:** @${sender.split('@')[0]}\n`;
            unmuteMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            unmuteMessage += `✅ User messages will no longer be deleted automatically.`;

            await reply(unmuteMessage, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.logOwnerAction('UNMUTE', targetUser, sender, {
                groupId: chatId,
                timestamp: new Date().toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Unmute command failed:', error);
            return reply('❌ Failed to unmute user. Please try again.');
        }
    }
};