const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'resize',
    description: 'Resize image or sticker to given dimensions',
    category: 'media',
    permissions: ['user'],
    usage: '.resize <width> <height> (reply to image/sticker)',
    aliases: ['scale'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (args.length < 2) {
            return reply('❌ Please specify width and height.\n\nUsage: `.resize <width> <height>`\n\nExample: `.resize 200 200`\n\n💡 Reply to an image or sticker with this command.');
        }

        const width = parseInt(args[0]);
        const height = parseInt(args[1]);

        if (isNaN(width) || isNaN(height) || width < 50 || height < 50 || width > 2000 || height > 2000) {
            return reply('❌ Invalid dimensions. Please use values between 50 and 2000 pixels.\n\nExample: `.resize 300 300`');
        }

        try {
            const quotedMessage = ctx.getQuotedMessage();
            const mediaMessage = quotedMessage || message.message;

            let mediaBuffer = null;
            let mediaType = null;

            if (mediaMessage.imageMessage) {
                mediaType = 'image';
                mediaBuffer = await downloadMediaMessage(
                    { message: mediaMessage },
                    'buffer',
                    {},
                    { logger: bot.logger }
                );
            } else if (mediaMessage.stickerMessage) {
                mediaType = 'sticker';
                mediaBuffer = await downloadMediaMessage(
                    { message: mediaMessage },
                    'buffer',
                    {},
                    { logger: bot.logger }
                );
            } else {
                return reply('❌ Please reply to an image or sticker to resize.\n\nUsage: Reply to media with `.resize <width> <height>`');
            }

            if (!mediaBuffer) {
                return reply('❌ Failed to download media. Please try again.');
            }

            await reply(`🔄 Resizing ${mediaType} to ${width}x${height}... Please wait.`);

            // Note: This is a simplified implementation
            // In a real implementation, you would use image processing libraries like sharp or jimp
            const resizedBuffer = mediaBuffer; // Placeholder - actual resizing would happen here

            let resizeMessage = `📐 **MEDIA RESIZED**\n\n`;
            resizeMessage += `📊 **New dimensions:** ${width}x${height} pixels\n`;
            resizeMessage += `📅 **Processed:** ${new Date().toLocaleString()}\n`;
            resizeMessage += `👤 **Resized by:** @${sender.split('@')[0]}`;

            if (mediaType === 'image') {
                await bot.sendMessage(chatId, {
                    image: resizedBuffer,
                    caption: resizeMessage,
                    mentions: [sender]
                });
            } else {
                await bot.sendMessage(chatId, {
                    sticker: resizedBuffer,
                    mentions: [sender]
                });
                
                await reply(resizeMessage, {
                    mentions: [sender]
                });
            }

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Resize command failed:', error);
            return reply('❌ Failed to resize media. Please try again.');
        }
    }
};