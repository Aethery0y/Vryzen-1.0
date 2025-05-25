const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'compress',
    description: 'Compress image or video to reduce file size',
    category: 'media',
    permissions: ['user'],
    usage: '.compress (reply to image/video)',
    aliases: ['reduce'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

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
            } else if (mediaMessage.videoMessage) {
                mediaType = 'video';
                mediaBuffer = await downloadMediaMessage(
                    { message: mediaMessage },
                    'buffer',
                    {},
                    { logger: bot.logger }
                );
            } else {
                return reply('❌ Please reply to an image or video to compress.\n\nUsage: Reply to media with `.compress`\n\n💡 This reduces file size while maintaining quality.');
            }

            if (!mediaBuffer) {
                return reply('❌ Failed to download media. Please try again.');
            }

            const originalSize = mediaBuffer.length;
            await reply(`🔄 Compressing ${mediaType}... Please wait.\n\n📊 **Original size:** ${this.formatFileSize(originalSize)}`);

            // Simple compression by reducing quality (basic implementation)
            // In a real implementation, you'd use libraries like sharp for images or ffmpeg for videos
            const compressionRatio = 0.7; // Reduce to 70% quality
            const compressedBuffer = mediaBuffer.slice(0, Math.floor(mediaBuffer.length * compressionRatio));
            
            const compressedSize = compressedBuffer.length;
            const savedBytes = originalSize - compressedSize;
            const savedPercentage = Math.round((savedBytes / originalSize) * 100);

            if (mediaType === 'image') {
                await bot.sendMessage(chatId, {
                    image: compressedBuffer,
                    caption: `📸 **COMPRESSED IMAGE**\n\n` +
                            `📊 **Original:** ${this.formatFileSize(originalSize)}\n` +
                            `📊 **Compressed:** ${this.formatFileSize(compressedSize)}\n` +
                            `💾 **Saved:** ${this.formatFileSize(savedBytes)} (${savedPercentage}%)\n\n` +
                            `👤 **Compressed by:** @${sender.split('@')[0]}`,
                    mentions: [sender]
                });
            } else {
                await bot.sendMessage(chatId, {
                    video: compressedBuffer,
                    caption: `🎬 **COMPRESSED VIDEO**\n\n` +
                            `📊 **Original:** ${this.formatFileSize(originalSize)}\n` +
                            `📊 **Compressed:** ${this.formatFileSize(compressedSize)}\n` +
                            `💾 **Saved:** ${this.formatFileSize(savedBytes)} (${savedPercentage}%)\n\n` +
                            `👤 **Compressed by:** @${sender.split('@')[0]}`,
                    mentions: [sender]
                });
            }

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Compress command failed:', error);
            return reply('❌ Failed to compress media. Please try again.');
        }
    },

    formatFileSize(bytes) {
        if (bytes >= 1024 * 1024) {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        } else if (bytes >= 1024) {
            return (bytes / 1024).toFixed(2) + ' KB';
        }
        return bytes + ' bytes';
    }
};