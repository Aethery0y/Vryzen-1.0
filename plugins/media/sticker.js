const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'sticker',
    description: 'Convert image or video to sticker',
    category: 'media',
    permissions: ['user'],
    usage: '.sticker (reply to image/video)',
    aliases: ['s', 'stiker'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            // Check for quoted/replied message or current message media
            const quotedMessage = ctx.getQuotedMessage();
            const mediaMessage = quotedMessage || message.message;

            let mediaBuffer = null;
            let mediaType = null;

            // Check for image
            if (mediaMessage.imageMessage) {
                mediaType = 'image';
                mediaBuffer = await downloadMediaMessage(
                    { message: mediaMessage },
                    'buffer',
                    {},
                    { logger: bot.logger }
                );
            } 
            // Check for video (must be short for sticker)
            else if (mediaMessage.videoMessage) {
                const videoMsg = mediaMessage.videoMessage;
                
                // Check video duration (max 10 seconds for sticker)
                if (videoMsg.seconds && videoMsg.seconds > 10) {
                    return reply('❌ Video is too long for sticker. Maximum 10 seconds allowed.\n\n💡 Try using a shorter video clip.');
                }

                mediaType = 'video';
                mediaBuffer = await downloadMediaMessage(
                    { message: mediaMessage },
                    'buffer',
                    {},
                    { logger: bot.logger }
                );
            }
            else {
                return reply('❌ Please reply to an image or video to convert to sticker.\n\nUsage: Reply to an image/video with `.sticker`\n\n📝 **Supported formats:**\n• Images: JPG, PNG, WEBP\n• Videos: MP4, 3GP (max 10 seconds)');
            }

            if (!mediaBuffer) {
                return reply('❌ Failed to download media. Please try again.');
            }

            // Send processing message
            await reply('🔄 Converting to sticker... Please wait.');

            // Prepare sticker metadata
            const stickerMetadata = {
                pack: 'Vryzen Bot',
                author: `@${sender.split('@')[0]}`,
                type: mediaType === 'video' ? 'video' : 'image',
                quality: 50
            };

            // Send as sticker
            await bot.sendMessage(chatId, {
                sticker: mediaBuffer,
                mimetype: mediaType === 'video' ? 'video/webm' : 'image/webp',
                metadata: stickerMetadata
            });

            // Log the conversion
            bot.logger.info('Sticker created', {
                userId: sender,
                groupId: chatId,
                mediaType,
                bufferSize: mediaBuffer.length
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Sticker command failed:', error);
            
            if (error.message.includes('not-media')) {
                return reply('❌ The message doesn\'t contain media or media is not supported.');
            } else if (error.message.includes('download-failed')) {
                return reply('❌ Failed to download media. The file might be too large or corrupted.');
            } else {
                return reply('❌ Failed to create sticker. Please try again with a different image/video.');
            }
        }
    }
};
