module.exports = {
    name: 'praise',
    description: 'Send a fun compliment message',
    category: 'user',
    permissions: ['user'],
    usage: '.praise @user',
    aliases: ['compliment'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            const mentions = ctx.extractMentions();
            if (mentions.length === 0) {
                return reply('❌ Please mention someone to praise.\n\nUsage: `.praise @user`');
            }

            const targetUser = mentions[0];
            const targetPhone = targetUser.split('@')[0];

            if (targetUser === sender) {
                return reply('❌ You cannot praise yourself! That would be a bit awkward 😅');
            }

            const compliments = [
                '🌟 Amazing person with incredible energy!',
                '💎 A true gem in our community!',
                '🚀 Always brings positive vibes!',
                '🎯 Super helpful and kind-hearted!',
                '⭐ Lights up every conversation!',
                '🔥 Absolutely fantastic human being!',
                '🌈 Spreads joy wherever they go!',
                '💫 A wonderful soul with great wisdom!',
                '🎉 Makes everything more fun and exciting!',
                '👑 Truly one of the best people around!',
                '🌸 Sweet, caring, and absolutely lovely!',
                '⚡ Full of positive energy and inspiration!',
                '🦋 Beautiful inside and out!',
                '🎨 Creative and uniquely awesome!',
                '🍀 A lucky charm for our group!'
            ];

            const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];

            let praiseMessage = `✨ **PRAISE TIME!** ✨\n\n`;
            praiseMessage += `👤 **To:** @${targetPhone}\n`;
            praiseMessage += `💝 **From:** @${sender.split('@')[0]}\n\n`;
            praiseMessage += `${randomCompliment}\n\n`;
            praiseMessage += `🎊 Keep being awesome!`;

            await reply(praiseMessage, {
                mentions: [targetUser, sender]
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Praise command failed:', error);
            return reply('❌ Failed to send praise. Please try again.');
        }
    }
};