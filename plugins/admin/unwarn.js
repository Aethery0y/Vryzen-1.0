module.exports = {
    name: 'unwarn',
    description: 'Remove a warning from user',
    category: 'admin',
    permissions: ['admin'],
    usage: '.unwarn @user',
    aliases: ['removewarn'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to remove warning from.\n\nUsage: `.unwarn @user`');
        }

        const targetUser = mentions[0];
        const targetPhone = targetUser.split('@')[0];

        try {
            const userData = bot.database.getUser(targetUser);
            if (!userData || userData.warnings <= 0) {
                return reply(`❌ @${targetPhone} has no warnings to remove.`, {
                    mentions: [targetUser]
                });
            }

            // Remove one warning
            bot.database.removeWarning(targetUser);
            const newWarningCount = userData.warnings - 1;
            const warnLimit = parseInt(bot.database.getGroupSetting(chatId, 'warn_limit') || '3');

            let unwarnMessage = `✅ **WARNING REMOVED**\n\n`;
            unwarnMessage += `👤 **User:** @${targetPhone}\n`;
            unwarnMessage += `👮 **Removed by:** @${sender.split('@')[0]}\n`;
            unwarnMessage += `⚠️ **Warnings:** ${newWarningCount}/${warnLimit}\n`;
            unwarnMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            
            if (newWarningCount === 0) {
                unwarnMessage += `🎉 User now has a clean record!`;
            } else {
                const remaining = warnLimit - newWarningCount;
                unwarnMessage += `📊 **Remaining warnings before action:** ${remaining}`;
            }

            await reply(unwarnMessage, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.logOwnerAction('UNWARN', targetUser, sender, {
                groupId: chatId,
                newWarningCount,
                timestamp: new Date().toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Unwarn command failed:', error);
            return reply('❌ Failed to remove warning. Please try again.');
        }
    }
};