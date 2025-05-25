const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'setgroupicon',
    description: 'Change group icon (profile picture) - send image with command',
    category: 'admin',
    permissions: ['admin'],
    usage: '.setgroupicon (send with image)',
    aliases: ['setgrouppp', 'changegroupicon'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        try {
            const quotedMessage = ctx.getQuotedMessage();
            const mediaMessage = quotedMessage || message.message;

            if (!mediaMessage.imageMessage) {
                return reply('❌ Please send an image with this command or reply to an image.\n\nUsage: Send image with `.setgroupicon`\n\n💡 The image will become the new group profile picture.');
            }

            await reply('🔄 Updating group icon... Please wait.');

            const imageBuffer = await downloadMediaMessage(
                { message: mediaMessage },
                'buffer',
                {},
                { logger: bot.logger }
            );

            if (!imageBuffer) {
                return reply('❌ Failed to download image. Please try again.');
            }

            // Update group picture
            await bot.sock.updateProfilePicture(chatId, imageBuffer);

            const groupMetadata = await bot.sock.groupMetadata(chatId);
            
            let successMessage = `✅ **GROUP ICON UPDATED**\n\n`;
            successMessage += `🏘️ **Group:** ${groupMetadata.subject}\n`;
            successMessage += `👮 **Updated by:** @${sender.split('@')[0]}\n`;
            successMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            successMessage += `🎉 New group icon has been set successfully!`;

            await reply(successMessage, {
                mentions: [sender]
            });

            bot.logger.logOwnerAction('SET_GROUP_ICON', null, sender, {
                groupId: chatId,
                groupName: groupMetadata.subject,
                timestamp: new Date().toISOString()
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Set group icon command failed:', error);
            
            if (error.message.includes('not-authorized')) {
                return reply('❌ Bot does not have admin permissions to change group icon.');
            } else {
                return reply('❌ Failed to update group icon. Please try again.');
            }
        }
    }
};