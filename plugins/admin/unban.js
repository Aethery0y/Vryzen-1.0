module.exports = {
    name: 'unban',
    description: 'Remove permanent bot ban from a user',
    category: 'admin',
    permissions: ['admin'],
    usage: '.unban @user',
    aliases: ['removeban'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to unban.\n\nUsage: `.unban @user`');
        }

        const targetUser = mentions[0];
        const targetPhone = targetUser.split('@')[0];

        try {
            // Check if user is banned
            const userData = bot.database.getUser(targetUser);
            if (!userData || !userData.banned) {
                return reply(`❌ @${targetPhone} is not currently banned.`, {
                    mentions: [targetUser]
                });
            }

            // Remove ban
            bot.database.unbanUser(targetUser);

            let unbanMessage = `✅ **USER UNBANNED**\n\n`;
            unbanMessage += `👤 **User:** @${targetPhone}\n`;
            unbanMessage += `👮 **Unbanned by:** @${sender.split('@')[0]}\n`;
            unbanMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            unbanMessage += `🎉 User can now use bot commands again.`;

            await reply(unbanMessage, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.logOwnerAction('UNBAN', targetUser, sender, {
                groupId: chatId,
                timestamp: new Date().toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Unban command failed:', error);
            return reply('❌ Failed to unban user. Please try again.');
        }
    }
};