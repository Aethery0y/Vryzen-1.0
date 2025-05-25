module.exports = {
    name: 'stats',
    description: 'Show user activity stats (messages sent, last seen, etc.)',
    category: 'user',
    permissions: ['user'],
    usage: '.stats @user',
    aliases: ['userstats'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        const mentions = ctx.extractMentions();
        const targetUser = mentions.length > 0 ? mentions[0] : sender;
        const targetPhone = targetUser.split('@')[0];
        const isSelf = targetUser === sender;

        try {
            const userData = bot.database.getUser(targetUser);
            if (!userData) {
                return reply(`❌ ${isSelf ? 'You have' : 'User has'} no activity recorded yet.\n\n💡 Start using the bot to build your statistics!`);
            }

            let statsMessage = `📊 **${isSelf ? 'YOUR' : 'USER'} ACTIVITY STATS**\n\n`;
            statsMessage += `👤 **User:** @${targetPhone}\n`;
            statsMessage += `📝 **Name:** ${userData.name || 'Not set'}\n`;
            statsMessage += `👑 **Role:** ${await bot.permissions.getUserRole(targetUser, chatId, isGroup)}\n`;
            statsMessage += `📅 **First Seen:** ${new Date(userData.created_at * 1000).toLocaleDateString()}\n\n`;

            // Get overall statistics
            const overallStats = bot.database.getUserStats(targetUser);
            if (overallStats) {
                statsMessage += `📈 **OVERALL STATISTICS**\n`;
                statsMessage += `💬 **Total Messages:** ${overallStats.total_messages || 0}\n`;
                statsMessage += `⚡ **Total Commands:** ${overallStats.total_commands || 0}\n`;
                statsMessage += `🏘️ **Active Groups:** ${overallStats.groups_active || 0}\n`;
                
                if (overallStats.last_active) {
                    const lastActive = new Date(overallStats.last_active * 1000);
                    const timeDiff = Date.now() - (overallStats.last_active * 1000);
                    const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                    
                    if (daysAgo === 0) {
                        statsMessage += `🕐 **Last Active:** Today\n`;
                    } else if (daysAgo === 1) {
                        statsMessage += `🕐 **Last Active:** Yesterday\n`;
                    } else {
                        statsMessage += `🕐 **Last Active:** ${daysAgo} days ago\n`;
                    }
                }
            }

            // Current group stats if in group
            if (isGroup) {
                const groupStats = bot.database.getUserStats(targetUser, chatId);
                if (groupStats) {
                    statsMessage += `\n🏘️ **THIS GROUP STATS**\n`;
                    statsMessage += `💬 **Messages:** ${groupStats.messages_sent || 0}\n`;
                    statsMessage += `⚡ **Commands:** ${groupStats.commands_used || 0}\n`;
                }
            }

            // Warning status
            if (userData.warnings > 0) {
                const warnLimit = parseInt(bot.database.getGroupSetting(chatId, 'warn_limit') || '3');
                statsMessage += `\n⚠️ **WARNING STATUS**\n`;
                statsMessage += `📊 **Warnings:** ${userData.warnings}/${warnLimit}\n`;
            }

            // Account status
            statsMessage += `\n🔐 **ACCOUNT STATUS**\n`;
            if (userData.banned) {
                statsMessage += `🔨 **Status:** BANNED\n`;
            } else if (userData.muted_until > Math.floor(Date.now() / 1000)) {
                statsMessage += `🔇 **Status:** MUTED\n`;
            } else if (userData.restricted_until > Math.floor(Date.now() / 1000)) {
                statsMessage += `🚫 **Status:** RESTRICTED\n`;
            } else {
                statsMessage += `✅ **Status:** ACTIVE\n`;
            }

            await reply(statsMessage, {
                mentions: [targetUser]
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Stats command failed:', error);
            return reply('❌ Failed to get user statistics. Please try again.');
        }
    }
};