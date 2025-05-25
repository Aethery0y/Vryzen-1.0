module.exports = {
    name: 'checkwarn',
    description: 'Check warning count for a user',
    category: 'user',
    permissions: ['user'],
    usage: '.checkwarn [@user]',
    aliases: ['warnings', 'warncount'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        // Extract mentions or use sender if no mention
        const mentions = ctx.extractMentions();
        const targetUser = mentions.length > 0 ? mentions[0] : sender;
        const isSelf = targetUser === sender;

        try {
            // Get user data from database
            const userData = bot.database.getUser(targetUser);
            const targetPhone = targetUser.split('@')[0];

            if (!userData) {
                return reply(`ℹ️ ${isSelf ? 'You have' : 'User has'} no warnings recorded.\n\n📝 User is not in the database yet.`);
            }

            const warnings = userData.warnings || 0;
            const warnLimit = parseInt(bot.database.getGroupSetting(chatId, 'warn_limit') || '3');
            const remainingWarnings = Math.max(0, warnLimit - warnings);

            let warningMessage = `⚠️ **WARNING STATUS**\n\n`;
            warningMessage += `👤 **User:** @${targetPhone}\n`;
            warningMessage += `📝 **Name:** ${userData.name || 'Not set'}\n`;
            warningMessage += `📊 **Current Warnings:** ${warnings}/${warnLimit}\n`;

            if (warnings === 0) {
                warningMessage += `✅ **Status:** Clean record - No warnings\n`;
                warningMessage += `🎉 Keep up the good behavior!`;
            } else if (warnings < warnLimit) {
                warningMessage += `🟡 **Status:** ${remainingWarnings} warning${remainingWarnings > 1 ? 's' : ''} remaining\n`;
                
                if (remainingWarnings === 1) {
                    warningMessage += `⚠️ **CAUTION:** Next warning will trigger action!`;
                } else {
                    warningMessage += `💡 Be careful with your behavior in the group.`;
                }
            } else {
                warningMessage += `🔴 **Status:** Warning limit reached!\n`;
                
                // Check what auto-action is set
                const autoAction = bot.database.getGroupSetting(chatId, 'warn_action') || 'kick';
                warningMessage += `⚡ **Auto-action:** ${autoAction === 'kick' ? 'Kick from group' : 'Ban from bot commands'}\n`;
                warningMessage += `🚨 Action may be taken by admins.`;
            }

            // Add additional status information
            if (userData.banned) {
                warningMessage += `\n\n🔨 **Additional Status:** Currently banned from bot commands`;
            } else if (userData.muted_until > Math.floor(Date.now() / 1000)) {
                const muteEnd = new Date(userData.muted_until * 1000);
                warningMessage += `\n\n🔇 **Additional Status:** Muted until ${muteEnd.toLocaleString()}`;
            } else if (userData.restricted_until > Math.floor(Date.now() / 1000)) {
                const restrictEnd = new Date(userData.restricted_until * 1000);
                warningMessage += `\n\n🚫 **Additional Status:** Restricted until ${restrictEnd.toLocaleString()}`;
            }

            // Show warning history if available (for admins or self)
            const userRole = await bot.permissions.getUserRole(sender, chatId, isGroup);
            const canSeeHistory = isSelf || bot.permissions.getPermissionLevel(userRole) >= bot.permissions.getPermissionLevel('admin');

            if (canSeeHistory && warnings > 0) {
                // Get recent warning logs
                try {
                    const warningLogs = bot.database.db.prepare(`
                        SELECT executed_at FROM command_logs 
                        WHERE user_id = ? AND command = 'warn' AND success = 1 
                        ORDER BY executed_at DESC 
                        LIMIT 3
                    `).all(targetUser);

                    if (warningLogs.length > 0) {
                        warningMessage += `\n\n📅 **Recent Warnings:**\n`;
                        warningLogs.forEach((log, index) => {
                            const date = new Date(log.executed_at * 1000).toLocaleDateString();
                            warningMessage += `${index + 1}. ${date}\n`;
                        });
                    }
                } catch (logError) {
                    // Ignore log errors
                }
            }

            await reply(warningMessage, {
                mentions: [targetUser]
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Check warn command failed:', error);
            return reply('❌ Failed to check warning status. Please try again.');
        }
    }
};
