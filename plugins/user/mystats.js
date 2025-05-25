module.exports = {
    name: 'mystats',
    description: 'Show your personal bot usage statistics',
    category: 'user',
    permissions: ['user'],
    usage: '.mystats',
    aliases: ['stats', 'myinfo'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            // Get user data from database
            const userData = bot.database.getUser(sender);
            const senderPhone = sender.split('@')[0];

            if (!userData) {
                return reply('📊 **YOUR STATISTICS**\n\n' +
                           '❌ No data found. You haven\'t used the bot before.\n\n' +
                           '💡 Start using bot commands to build your statistics!');
            }

            let statsMessage = `📊 **YOUR STATISTICS**\n\n`;
            statsMessage += `👤 **User:** @${senderPhone}\n`;
            statsMessage += `📝 **Name:** ${userData.name || 'Not set'}\n`;
            statsMessage += `👑 **Role:** ${await bot.permissions.getUserRole(sender, chatId, isGroup)}\n`;
            statsMessage += `📅 **First Seen:** ${new Date(userData.created_at * 1000).toLocaleDateString()}\n`;

            // Get overall statistics
            const overallStats = bot.database.getUserStats(sender);
            if (overallStats) {
                statsMessage += `\n📈 **OVERALL STATISTICS**\n`;
                statsMessage += `💬 **Total Messages:** ${overallStats.total_messages || 0}\n`;
                statsMessage += `⚡ **Total Commands:** ${overallStats.total_commands || 0}\n`;
                statsMessage += `🏘️ **Active Groups:** ${overallStats.groups_active || 0}\n`;
                
                if (overallStats.last_active) {
                    const lastActive = new Date(overallStats.last_active * 1000);
                    statsMessage += `🕐 **Last Active:** ${lastActive.toLocaleString()}\n`;
                }
            }

            // Get current group statistics (if in group)
            if (isGroup) {
                const groupStats = bot.database.getUserStats(sender, chatId);
                if (groupStats) {
                    statsMessage += `\n🏘️ **THIS GROUP STATISTICS**\n`;
                    statsMessage += `💬 **Messages Sent:** ${groupStats.messages_sent || 0}\n`;
                    statsMessage += `⚡ **Commands Used:** ${groupStats.commands_used || 0}\n`;
                    
                    if (groupStats.last_active) {
                        const lastActive = new Date(groupStats.last_active * 1000);
                        statsMessage += `🕐 **Last Active:** ${lastActive.toLocaleString()}\n`;
                    }
                }
            }

            // Get warning information
            if (userData.warnings > 0) {
                const warnLimit = parseInt(bot.database.getGroupSetting(chatId, 'warn_limit') || '3');
                statsMessage += `\n⚠️ **WARNING STATUS**\n`;
                statsMessage += `📊 **Warnings:** ${userData.warnings}/${warnLimit}\n`;
                
                if (userData.warnings >= warnLimit) {
                    statsMessage += `🔴 **Status:** At warning limit\n`;
                } else {
                    const remaining = warnLimit - userData.warnings;
                    statsMessage += `🟡 **Remaining:** ${remaining} warning${remaining > 1 ? 's' : ''}\n`;
                }
            } else {
                statsMessage += `\n✅ **WARNING STATUS**\n`;
                statsMessage += `🎉 **Clean Record:** No warnings\n`;
            }

            // Get command usage statistics
            try {
                const commandStats = bot.database.db.prepare(`
                    SELECT command, COUNT(*) as count 
                    FROM command_logs 
                    WHERE user_id = ? AND success = 1 
                    GROUP BY command 
                    ORDER BY count DESC 
                    LIMIT 5
                `).all(sender);

                if (commandStats.length > 0) {
                    statsMessage += `\n🔥 **TOP COMMANDS**\n`;
                    commandStats.forEach((stat, index) => {
                        statsMessage += `${index + 1}. ${stat.command} (${stat.count}x)\n`;
                    });
                }
            } catch (error) {
                // Ignore command stats errors
            }

            // Account status
            statsMessage += `\n🔐 **ACCOUNT STATUS**\n`;
            
            if (userData.banned) {
                statsMessage += `🔨 **Status:** BANNED from bot commands\n`;
            } else if (userData.muted_until > Math.floor(Date.now() / 1000)) {
                const muteEnd = new Date(userData.muted_until * 1000);
                statsMessage += `🔇 **Status:** MUTED until ${muteEnd.toLocaleDateString()}\n`;
            } else if (userData.restricted_until > Math.floor(Date.now() / 1000)) {
                const restrictEnd = new Date(userData.restricted_until * 1000);
                statsMessage += `🚫 **Status:** RESTRICTED until ${restrictEnd.toLocaleDateString()}\n`;
            } else {
                statsMessage += `✅ **Status:** ACTIVE\n`;
            }

            // Special status
            if (bot.permissions.isRealOwner(sender)) {
                statsMessage += `👑 **Special:** Real Owner (Supreme Control)\n`;
            } else if (await bot.permissions.isOwner(sender)) {
                statsMessage += `🤖 **Special:** Bot Owner\n`;
            }

            // Activity level
            const totalActivity = (overallStats?.total_commands || 0) + (overallStats?.total_messages || 0);
            if (totalActivity > 1000) {
                statsMessage += `🌟 **Activity Level:** Very Active\n`;
            } else if (totalActivity > 100) {
                statsMessage += `🔥 **Activity Level:** Active\n`;
            } else if (totalActivity > 10) {
                statsMessage += `📈 **Activity Level:** Regular\n`;
            } else {
                statsMessage += `🌱 **Activity Level:** New User\n`;
            }

            await reply(statsMessage, {
                mentions: [sender]
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('My stats command failed:', error);
            return reply('❌ Failed to get your statistics. Please try again.');
        }
    }
};
