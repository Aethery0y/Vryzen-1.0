module.exports = {
    name: 'hug',
    description: 'Send hug emoji or message',
    category: 'user',
    permissions: ['user'],
    usage: '.hug @user',
    aliases: ['cuddle'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            const mentions = ctx.extractMentions();
            if (mentions.length === 0) {
                return reply('❌ Please mention someone to hug.\n\nUsage: `.hug @user`');
            }

            const targetUser = mentions[0];
            const targetPhone = targetUser.split('@')[0];

            if (targetUser === sender) {
                return reply('🤗 *gives you a virtual self-hug* \n\nSometimes we all need to love ourselves! 💕');
            }

            const hugMessages = [
                '🤗 *gives a warm, cozy hug*',
                '🫂 *big bear hug incoming!*',
                '💝 *gentle and caring hug*',
                '🌟 *magical friendship hug*',
                '🎈 *bouncy, happy hug*',
                '💕 *super sweet hug*',
                '🌈 *colorful rainbow hug*',
                '⭐ *starry night hug*',
                '🍀 *lucky charm hug*',
                '🎊 *celebration hug*'
            ];

            const randomHug = hugMessages[Math.floor(Math.random() * hugMessages.length)];

            let hugMessage = `${randomHug}\n\n`;
            hugMessage += `👤 **To:** @${targetPhone}\n`;
            hugMessage += `💝 **From:** @${sender.split('@')[0]}\n\n`;
            hugMessage += `💭 *Sending virtual hugs and positive vibes!* ✨`;

            await reply(hugMessage, {
                mentions: [targetUser, sender]
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Hug command failed:', error);
            return reply('❌ Failed to send hug. Please try again.');
        }
    }
};