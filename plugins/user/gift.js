module.exports = {
    name: 'gift',
    description: 'Send a fun gift sticker or emoji',
    category: 'user',
    permissions: ['user'],
    usage: '.gift @user',
    aliases: ['present'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            const mentions = ctx.extractMentions();
            if (mentions.length === 0) {
                return reply('❌ Please mention someone to send a gift.\n\nUsage: `.gift @user`');
            }

            const targetUser = mentions[0];
            const targetPhone = targetUser.split('@')[0];

            if (targetUser === sender) {
                return reply('🎁 *unwraps a self-gift* \n\nSurprise! You deserve nice things! 🎉');
            }

            const gifts = [
                { emoji: '🎁', name: 'Mystery Gift Box' },
                { emoji: '🌹', name: 'Beautiful Rose' },
                { emoji: '🍰', name: 'Delicious Cake' },
                { emoji: '🎈', name: 'Party Balloon' },
                { emoji: '💎', name: 'Precious Diamond' },
                { emoji: '🌟', name: 'Shining Star' },
                { emoji: '🎊', name: 'Confetti Blast' },
                { emoji: '🍫', name: 'Sweet Chocolate' },
                { emoji: '🎪', name: 'Circus Ticket' },
                { emoji: '🦄', name: 'Magical Unicorn' },
                { emoji: '🌈', name: 'Rainbow Bridge' },
                { emoji: '🎭', name: 'Theater Mask' },
                { emoji: '🎨', name: 'Art Palette' },
                { emoji: '🎵', name: 'Musical Note' },
                { emoji: '⭐', name: 'Lucky Star' }
            ];

            const randomGift = gifts[Math.floor(Math.random() * gifts.length)];

            let giftMessage = `🎁 **GIFT DELIVERY!** 🎁\n\n`;
            giftMessage += `${randomGift.emoji} **Gift:** ${randomGift.name}\n`;
            giftMessage += `👤 **To:** @${targetPhone}\n`;
            giftMessage += `💝 **From:** @${sender.split('@')[0]}\n\n`;
            giftMessage += `✨ *Special delivery with love and kindness!* ✨\n`;
            giftMessage += `🎉 Enjoy your surprise gift!`;

            await reply(giftMessage, {
                mentions: [targetUser, sender]
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Gift command failed:', error);
            return reply('❌ Failed to send gift. Please try again.');
        }
    }
};