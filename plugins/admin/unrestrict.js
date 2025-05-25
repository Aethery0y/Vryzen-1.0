module.exports = {
    name: 'unrestrict',
    description: 'Remove temporary bot access restriction from user',
    category: 'admin',
    permissions: ['admin'],
    usage: '.unrestrict @user',
    aliases: ['untempmute'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to unrestrict.\n\nUsage: `.unrestrict @user`');
        }

        const targetUser = mentions[0];
        const targetPhone = targetUser.split('@')[0];

        try {
            // Check if user is restricted
            const userData = bot.database.getUser(targetUser);
            if (!userData || userData.restricted_until <= Math.floor(Date.now() / 1000)) {
                return reply(`❌ @${targetPhone} is not currently restricted.`, {
                    mentions: [targetUser]
                });
            }

            // Remove restriction
            bot.database.db.prepare(`
                UPDATE users 
                SET restricted_until = 0 
                WHERE user_id = ?
            `).run(targetUser);

            let unrestrictMessage = `✅ **USER UNRESTRICTED**\n\n`;
            unrestrictMessage += `👤 **User:** @${targetPhone}\n`;
            unrestrictMessage += `👮 **Unrestricted by:** @${sender.split('@')[0]}\n`;
            unrestrictMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            unrestrictMessage += `🎉 User can now use bot commands again.`;

            await reply(unrestrictMessage, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.logOwnerAction('UNRESTRICT', targetUser, sender, {
                groupId: chatId,
                timestamp: new Date().toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Unrestrict command failed:', error);
            return reply('❌ Failed to unrestrict user. Please try again.');
        }
    }
};