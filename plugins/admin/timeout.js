module.exports = {
    name: 'timeout',
    description: 'Silences user from using commands and deletes their messages temporarily',
    category: 'admin',
    permissions: ['admin'],
    usage: '.timeout @user <duration>',
    aliases: ['silence'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to timeout.\n\nUsage: `.timeout @user <duration>`\n\nExample: `.timeout @user 5m`');
        }

        if (args.length < 2) {
            return reply('❌ Please specify duration.\n\nUsage: `.timeout @user <duration>`\n\nExamples:\n• `.timeout @user 5m` (5 minutes)\n• `.timeout @user 1h` (1 hour)');
        }

        const targetUser = mentions[0];
        const duration = args[1];
        const targetPhone = targetUser.split('@')[0];

        if (targetUser === sender) {
            return reply('❌ You cannot timeout yourself.');
        }

        try {
            const targetRole = await bot.permissions.getUserRole(targetUser, chatId, isGroup);
            if (bot.permissions.getPermissionLevel(targetRole) >= bot.permissions.getPermissionLevel('admin')) {
                return reply('❌ Cannot timeout admins or owners.');
            }

            const durationMs = ctx.parseDuration(duration);
            if (!durationMs) {
                return reply('❌ Invalid duration format. Use: 5m, 1h, 2d, etc.');
            }

            const timeoutUntil = Math.floor((Date.now() + durationMs) / 1000);

            // Apply both restriction and mute
            bot.database.db.prepare(`
                UPDATE users 
                SET restricted_until = ?, muted_until = ? 
                WHERE user_id = ?
            `).run(timeoutUntil, timeoutUntil, targetUser);

            const endTime = new Date(timeoutUntil * 1000);
            let timeoutMessage = `⏰ **USER TIMEOUT**\n\n`;
            timeoutMessage += `👤 **User:** @${targetPhone}\n`;
            timeoutMessage += `👮 **Timeout by:** @${sender.split('@')[0]}\n`;
            timeoutMessage += `⏰ **Duration:** ${duration}\n`;
            timeoutMessage += `🕐 **Until:** ${endTime.toLocaleString()}\n\n`;
            timeoutMessage += `🚫 User cannot use commands AND messages will be deleted until timeout expires.`;

            await reply(timeoutMessage, {
                mentions: [targetUser, sender]
            });

            setTimeout(() => {
                bot.database.db.prepare(`
                    UPDATE users 
                    SET restricted_until = 0, muted_until = 0 
                    WHERE user_id = ? AND restricted_until = ?
                `).run(targetUser, timeoutUntil);
                
                bot.logger.info('Auto-removed timeout', { targetUser, duration });
            }, durationMs);

            bot.logger.logOwnerAction('TIMEOUT', targetUser, sender, {
                groupId: chatId,
                duration,
                until: endTime.toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Timeout command failed:', error);
            return reply('❌ Failed to timeout user. Please try again.');
        }
    }
};