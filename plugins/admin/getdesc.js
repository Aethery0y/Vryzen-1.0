module.exports = {
    name: 'getdesc',
    description: 'Get current group description',
    category: 'admin',
    permissions: ['user'],
    usage: '.getdesc',
    aliases: ['getdescription', 'description', 'desc'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        try {
            // Get group metadata
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            
            if (!groupMetadata.desc || groupMetadata.desc.trim() === '') {
                return reply('📝 **GROUP DESCRIPTION**\n\n❌ No description set for this group.\n\n💡 Admins can set a description using `.setdesc <text>`');
            }

            // Format and send description
            const description = groupMetadata.desc;
            const groupName = groupMetadata.subject;
            const creationDate = new Date(groupMetadata.creation * 1000).toLocaleDateString();
            
            await reply(`📝 **GROUP DESCRIPTION**\n\n` +
                       `👥 **Group:** ${groupName}\n` +
                       `📅 **Created:** ${creationDate}\n` +
                       `👤 **Members:** ${groupMetadata.participants.length}\n\n` +
                       `📄 **Description:**\n${description}`);

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Get description command failed:', error);
            return reply('❌ Failed to get group description. Please try again.');
        }
    }
};
