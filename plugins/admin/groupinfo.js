module.exports = {
    name: 'groupinfo',
    description: 'Show detailed group metadata and statistics',
    category: 'admin',
    permissions: ['user'],
    usage: '.groupinfo',
    aliases: ['ginfo', 'groupstats'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        try {
            // Get group metadata
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            
            const groupName = groupMetadata.subject;
            const groupDesc = groupMetadata.desc || 'No description';
            const creationDate = new Date(groupMetadata.creation * 1000);
            const memberCount = groupMetadata.participants.length;
            
            // Count admins and members
            const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const superAdmins = groupMetadata.participants.filter(p => p.admin === 'superadmin');
            const regularMembers = groupMetadata.participants.filter(p => !p.admin);

            // Get group settings from database
            const groupData = bot.database.getGroup(chatId);
            const isLocked = groupData ? groupData.locked : false;
            const warnLimit = bot.database.getGroupSetting(chatId, 'warn_limit') || '3';
            const welcomeMsg = bot.database.getGroupSetting(chatId, 'welcome_message');
            
            // Get bot status
            const botId = bot.sock.user.id;
            const botParticipant = groupMetadata.participants.find(p => p.id === botId);
            const botStatus = botParticipant ? (botParticipant.admin || 'member') : 'not_in_group';

            // Format creation date
            const createdStr = creationDate.toLocaleDateString() + ' ' + creationDate.toLocaleTimeString();

            let infoMessage = `📊 **GROUP INFORMATION**\n\n`;
            infoMessage += `👥 **Name:** ${groupName}\n`;
            infoMessage += `📝 **Description:** ${groupDesc.length > 50 ? groupDesc.substring(0, 50) + '...' : groupDesc}\n`;
            infoMessage += `📅 **Created:** ${createdStr}\n`;
            infoMessage += `🆔 **Group ID:** ${chatId}\n\n`;

            infoMessage += `👤 **MEMBERS (${memberCount})**\n`;
            infoMessage += `👑 **Creators:** ${superAdmins.length}\n`;
            infoMessage += `👮‍♂️ **Admins:** ${admins.length - superAdmins.length}\n`;
            infoMessage += `👥 **Members:** ${regularMembers.length}\n\n`;

            infoMessage += `⚙️ **SETTINGS**\n`;
            infoMessage += `🔒 **Group Locked:** ${isLocked ? 'Yes' : 'No'}\n`;
            infoMessage += `⚠️ **Warning Limit:** ${warnLimit}\n`;
            infoMessage += `👋 **Welcome Message:** ${welcomeMsg ? 'Set' : 'Not set'}\n`;
            infoMessage += `🤖 **Bot Status:** ${botStatus}\n\n`;

            // Get some statistics if available
            try {
                const stats = bot.database.db.prepare(`
                    SELECT COUNT(*) as command_count 
                    FROM command_logs 
                    WHERE group_id = ? AND executed_at > ?
                `).get(chatId, Math.floor(Date.now() / 1000) - 86400); // Last 24 hours

                if (stats && stats.command_count > 0) {
                    infoMessage += `📈 **24H STATS**\n`;
                    infoMessage += `⚡ **Commands Used:** ${stats.command_count}\n`;
                }
            } catch (error) {
                // Ignore stats errors
            }

            await reply(infoMessage);

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Group info command failed:', error);
            return reply('❌ Failed to get group information. Please try again.');
        }
    }
};
