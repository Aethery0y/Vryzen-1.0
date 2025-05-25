module.exports = {
    name: 'report',
    description: 'Report a user to group admins',
    category: 'user',
    permissions: ['user'],
    usage: '.report @user <reason>',
    aliases: ['reportuser'],
    cooldown: 1000, // 30 seconds to prevent spam

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to report.\n\nUsage: `.report @user <reason>`\n\nExample: `.report @user Spamming inappropriate content`');
        }

        if (args.length < 2) {
            return reply('❌ Please provide a reason for the report.\n\nUsage: `.report @user <reason>`\n\nExample: `.report @user Sending spam messages`');
        }

        const reportedUser = mentions[0];
        const reason = args.slice(1).join(' ');

        // Prevent self-reporting
        if (reportedUser === sender) {
            return reply('❌ You cannot report yourself.');
        }

        // Validate reason length
        if (reason.length < 10) {
            return reply('❌ Report reason must be at least 10 characters long.');
        }

        if (reason.length > 500) {
            return reply('❌ Report reason is too long. Maximum 500 characters allowed.');
        }

        try {
            // Get group metadata to get admins
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            const admins = groupMetadata.participants.filter(p => 
                p.admin === 'admin' || p.admin === 'superadmin'
            );

            if (admins.length === 0) {
                return reply('❌ No admins found in this group to send the report to.');
            }

            // Check if reported user is in the group
            const reportedUserInGroup = groupMetadata.participants.find(p => p.id === reportedUser);
            if (!reportedUserInGroup) {
                return reply('❌ The reported user is not in this group.');
            }

            // Get user information
            const reporterPhone = sender.split('@')[0];
            const reportedPhone = reportedUser.split('@')[0];
            const reporterData = bot.database.getUser(sender);
            const reportedData = bot.database.getUser(reportedUser);

            // Prepare admin mentions
            const adminMentions = admins.map(admin => admin.id);
            const adminTags = admins.map(admin => `@${admin.id.split('@')[0]}`).join(' ');

            // Create report message
            let reportMessage = `🚨 **USER REPORT**\n\n`;
            reportMessage += `👤 **Reported User:** @${reportedPhone}\n`;
            reportMessage += `👮‍♂️ **Reported By:** @${reporterPhone}\n`;
            reportMessage += `📅 **Time:** ${new Date().toLocaleString()}\n`;
            reportMessage += `🏘️ **Group:** ${groupMetadata.subject}\n\n`;
            reportMessage += `📝 **Reason:**\n${reason}\n\n`;

            // Add user status information
            if (reportedData) {
                if (reportedData.warnings > 0) {
                    const warnLimit = parseInt(bot.database.getGroupSetting(chatId, 'warn_limit') || '3');
                    reportMessage += `⚠️ **Previous Warnings:** ${reportedData.warnings}/${warnLimit}\n`;
                }

                if (reportedData.banned) {
                    reportMessage += `🔨 **Status:** Currently banned from bot commands\n`;
                } else if (reportedData.muted_until > Math.floor(Date.now() / 1000)) {
                    reportMessage += `🔇 **Status:** Currently muted\n`;
                }
            }

            reportMessage += `\n👮‍♂️ **Admins:** ${adminTags}\n`;
            reportMessage += `\n💡 **Admins can investigate and take appropriate action.**`;

            // Send report to the group
            await bot.sendMessage(chatId, {
                text: reportMessage,
                mentions: [reportedUser, sender, ...adminMentions]
            });

            // Log the report
            bot.logger.audit('USER_REPORTED', sender, {
                reportedUser,
                groupId: chatId,
                groupName: groupMetadata.subject,
                reason,
                adminCount: admins.length,
                timestamp: new Date().toISOString()
            });

            // Send confirmation to reporter
            await reply(`✅ **REPORT SUBMITTED**\n\n` +
                       `📋 Your report has been sent to all group admins.\n` +
                       `👮‍♂️ Admins will review and take appropriate action.\n\n` +
                       `⚠️ **Note:** False reports may result in consequences.\n` +
                       `💡 You can report again in 30 seconds.`);

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Report command failed:', error);
            return reply('❌ Failed to submit report. Please try again.');
        }
    }
};
