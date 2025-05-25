const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'toimg',
    description: 'Convert sticker to image',
    category: 'media',
    permissions: ['user'],
    usage: '.toimg (reply to sticker)',
    aliases: ['toimage', 'stickertoimg'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            // Check for quoted/replied message or current message media
            const quotedMessage = ctx.getQuotedMessage();
            const mediaMessage = quotedMessage || message.message;

            // Check if it's a sticker
            if (!mediaMessage.stickerMessage) {
                return reply('❌ Please reply to a sticker to convert to image.\n\nUsage: Reply to a sticker with `.toimg`\n\n💡 This command converts stickers back to regular images.');
            }

            const stickerMessage = mediaMessage.stickerMessage;

            // Check if sticker is animated (can't convert animated stickers to static image easily)
            if (stickerMessage.isAnimated) {
                return reply('❌ Cannot convert animated stickers to image.\n\n💡 This command only works with static stickers.');
            }

            // Send processing message
            await reply('🔄 Converting sticker to image... Please wait.');

            // Download sticker
            const stickerBuffer = await downloadMediaMessage(
                { message: mediaMessage },
                'buffer',
                {},
                { logger: bot.logger }
            );

            if (!stickerBuffer) {
                return reply('❌ Failed to download sticker. Please try again.');
            }

            // Send as image
            await bot.sendMessage(chatId, {
                image: stickerBuffer,
                caption: `📸 **Sticker Converted to Image**\n\n` +
                        `👤 **Converted by:** @${sender.split('@')[0]}\n` +
                        `📅 **Time:** ${new Date().toLocaleString()}\n\n` +
                        `💡 Use \`.sticker\` to convert back to sticker.`,
                mentions: [sender]
            });

            // Log the conversion
            bot.logger.info('Sticker converted to image', {
                userId: sender,
                groupId: chatId,
                stickerSize: stickerBuffer.length
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Toimg command failed:', error);
            
            if (error.message.includes('not-media')) {
                return reply('❌ The message doesn\'t contain a sticker.');
            } else if (error.message.includes('download-failed')) {
                return reply('❌ Failed to download sticker. Please try again.');
            } else {
                return reply('❌ Failed to convert sticker to image. Please try again.');
            }
        }
    }
};
