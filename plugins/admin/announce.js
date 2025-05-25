module.exports = {
    name: 'announce',
    description: 'Send announcement message mentioning all admins',
    category: 'admin',
    permissions: ['admin'],
    usage: '.announce <message>',
    aliases: ['announcement'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        if (args.length === 0) {
            return reply('❌ Please provide an announcement message.\n\nUsage: `.announce <message>`\n\nExample: `.announce Important meeting tomorrow at 3 PM`');
        }

        // Check if user can make announcements
        const canAnnounce = await bot.permissions.canManageGroup(sender, chatId);
        if (!canAnnounce) {
            return reply('❌ You don\'t have permission to make announcements.');
        }

        const announcementText = args.join(' ');

        // Validate announcement length
        if (announcementText.length > 1000) {
            return reply('❌ Announcement is too long. Maximum 1000 characters allowed.');
        }

        try {
            // Get group metadata to get all admins
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            
            if (admins.length === 0) {
                return reply('❌ No admins found in this group.');
            }

            // Prepare mentions for all admins
            const adminMentions = admins.map(admin => admin.id);
            const adminTags = admins.map(admin => `@${admin.id.split('@')[0]}`).join(' ');

            const announcerPhone = sender.split('@')[0];
            const timestamp = new Date().toLocaleString();

            // Send announcement
            const announcementMessage = `📢 **ANNOUNCEMENT** 📢\n\n` +
                                      `📝 ${announcementText}\n\n` +
                                      `👮‍♂️ **Announced by:** @${announcerPhone}\n` +
                                      `⏰ **Time:** ${timestamp}\n\n` +
                                      `🔔 **Admins:** ${adminTags}`;

            await bot.sendMessage(chatId, {
                text: announcementMessage,
                mentions: [...adminMentions, sender]
            });

            // Log the action
            bot.logger.audit('ANNOUNCEMENT_SENT', sender, {
                groupId: chatId,
                groupName: groupMetadata.subject,
                announcementText,
                adminCount: admins.length,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Announce command failed:', error);
            return reply('❌ Failed to send announcement. Please try again.');
        }
    }
};
