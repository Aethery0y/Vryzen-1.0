module.exports = {
    name: 'getsubject',
    description: 'Get current group name (subject)',
    category: 'admin',
    permissions: ['user'],
    usage: '.getsubject',
    aliases: ['getname', 'groupname', 'subject'],
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
            const creationDate = new Date(groupMetadata.creation * 1000).toLocaleDateString();
            const memberCount = groupMetadata.participants.length;
            const adminCount = groupMetadata.participants.filter(p => p.admin).length;
            
            await reply(`👥 **GROUP INFORMATION**\n\n` +
                       `📝 **Name:** ${groupName}\n` +
                       `📅 **Created:** ${creationDate}\n` +
                       `👤 **Members:** ${memberCount}\n` +
                       `👮‍♂️ **Admins:** ${adminCount}\n\n` +
                       `🆔 **Group ID:** ${chatId}`);

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Get subject command failed:', error);
            return reply('❌ Failed to get group information. Please try again.');
        }
    }
};
