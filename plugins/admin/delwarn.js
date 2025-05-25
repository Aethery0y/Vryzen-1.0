module.exports = {
    name: 'delwarn',
    description: 'Clear all warnings from user',
    category: 'admin',
    permissions: ['admin'],
    usage: '.delwarn @user',
    aliases: ['clearwarnings', 'resetwarnings'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to clear warnings from.\n\nUsage: `.delwarn @user`');
        }

        const targetUser = mentions[0];
        const targetPhone = targetUser.split('@')[0];

        try {
            const userData = bot.database.getUser(targetUser);
            if (!userData || userData.warnings <= 0) {
                return reply(`❌ @${targetPhone} has no warnings to clear.`, {
                    mentions: [targetUser]
                });
            }

            const previousWarnings = userData.warnings;
            
            // Clear all warnings
            bot.database.clearWarnings(targetUser);

            let clearMessage = `🧹 **ALL WARNINGS CLEARED**\n\n`;
            clearMessage += `👤 **User:** @${targetPhone}\n`;
            clearMessage += `👮 **Cleared by:** @${sender.split('@')[0]}\n`;
            clearMessage += `⚠️ **Previous warnings:** ${previousWarnings}\n`;
            clearMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            clearMessage += `🎉 User now has a completely clean record!`;

            await reply(clearMessage, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.logOwnerAction('CLEAR_WARNINGS', targetUser, sender, {
                groupId: chatId,
                previousWarnings,
                timestamp: new Date().toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Clear warnings command failed:', error);
            return reply('❌ Failed to clear warnings. Please try again.');
        }
    }
};