module.exports = {
    name: 'getgroupicon',
    description: 'Download current group icon',
    category: 'admin',
    permissions: ['admin'],
    usage: '.getgroupicon',
    aliases: ['getgrouppp', 'downloadgroupicon'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        try {
            await reply('🔄 Downloading group icon... Please wait.');

            const groupMetadata = await bot.sock.groupMetadata(chatId);
            
            // Get group profile picture
            const profilePicUrl = await bot.sock.profilePictureUrl(chatId, 'image');
            
            if (!profilePicUrl) {
                return reply('❌ This group has no profile picture set.');
            }

            // Download the image
            const response = await fetch(profilePicUrl);
            const imageBuffer = await response.buffer();

            let iconMessage = `🖼️ **GROUP ICON**\n\n`;
            iconMessage += `🏘️ **Group:** ${groupMetadata.subject}\n`;
            iconMessage += `📱 **Downloaded by:** @${sender.split('@')[0]}\n`;
            iconMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            iconMessage += `💡 Current group profile picture`;

            await bot.sendMessage(chatId, {
                image: imageBuffer,
                caption: iconMessage,
                mentions: [sender]
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Get group icon command failed:', error);
            
            if (error.message.includes('not-found')) {
                return reply('❌ Group has no profile picture or picture is not accessible.');
            } else {
                return reply('❌ Failed to download group icon. Please try again.');
            }
        }
    }
};