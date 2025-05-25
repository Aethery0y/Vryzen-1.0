module.exports = {
    name: 'restrict',
    description: 'Temporarily block user from using bot commands',
    category: 'admin',
    permissions: ['admin'],
    usage: '.restrict @user <duration>',
    aliases: ['tempmute'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to restrict.\n\nUsage: `.restrict @user <duration>`\n\nExample: `.restrict @user 10m`');
        }

        if (args.length < 2) {
            return reply('❌ Please specify duration.\n\nUsage: `.restrict @user <duration>`\n\nExamples:\n• `.restrict @user 10m` (10 minutes)\n• `.restrict @user 1h` (1 hour)\n• `.restrict @user 1d` (1 day)');
        }

        const targetUser = mentions[0];
        const duration = args[1];
        const targetPhone = targetUser.split('@')[0];

        // Prevent self-restriction
        if (targetUser === sender) {
            return reply('❌ You cannot restrict yourself.');
        }

        try {
            // Check permissions - prevent restricting admins/owners
            const targetRole = await bot.permissions.getUserRole(targetUser, chatId, isGroup);
            if (bot.permissions.getPermissionLevel(targetRole) >= bot.permissions.getPermissionLevel('admin')) {
                return reply('❌ Cannot restrict admins or owners.');
            }

            // Parse duration
            const durationMs = ctx.parseDuration(duration);
            if (!durationMs) {
                return reply('❌ Invalid duration format. Use: 10m, 1h, 2d, etc.');
            }

            const restrictUntil = Math.floor((Date.now() + durationMs) / 1000);

            // Apply restriction
            bot.database.db.prepare(`
                UPDATE users 
                SET restricted_until = ? 
                WHERE user_id = ?
            `).run(restrictUntil, targetUser);

            const endTime = new Date(restrictUntil * 1000);
            let restrictMessage = `🚫 **USER RESTRICTED**\n\n`;
            restrictMessage += `👤 **User:** @${targetPhone}\n`;
            restrictMessage += `👮 **Restricted by:** @${sender.split('@')[0]}\n`;
            restrictMessage += `⏰ **Duration:** ${duration}\n`;
            restrictMessage += `🕐 **Until:** ${endTime.toLocaleString()}\n\n`;
            restrictMessage += `⚠️ User cannot use bot commands until restriction expires.`;

            await reply(restrictMessage, {
                mentions: [targetUser, sender]
            });

            // Auto-remove restriction after duration
            setTimeout(() => {
                bot.database.db.prepare(`
                    UPDATE users 
                    SET restricted_until = 0 
                    WHERE user_id = ? AND restricted_until = ?
                `).run(targetUser, restrictUntil);
                
                bot.logger.info('Auto-removed restriction', { targetUser, duration });
            }, durationMs);

            // Log the action
            bot.logger.logOwnerAction('RESTRICT', targetUser, sender, {
                groupId: chatId,
                duration,
                until: endTime.toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Restrict command failed:', error);
            return reply('❌ Failed to restrict user. Please try again.');
        }
    }
};