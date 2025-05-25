module.exports = {
    name: 'translate',
    description: 'Translate text to different languages',
    category: 'utility',
    permissions: ['user'],
    usage: '.translate <target_lang> <text> or reply to message',
    aliases: ['tr', 'lang'],
    cooldown: 2000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        let targetLang = 'en';
        let textToTranslate = '';

        // Check if replying to a message
        const quotedMessage = ctx.getQuotedMessage();
        
        if (quotedMessage) {
            // Extract text from quoted message
            if (quotedMessage.conversation) {
                textToTranslate = quotedMessage.conversation;
            } else if (quotedMessage.extendedTextMessage?.text) {
                textToTranslate = quotedMessage.extendedTextMessage.text;
            }
            
            targetLang = args[0] || 'en';
        } else {
            // Parse arguments
            if (args.length < 2) {
                return reply('❌ Please provide target language and text to translate.\n\n' +
                           'Usage: `.translate <language> <text>`\n' +
                           'Or reply to a message with: `.translate <language>`\n\n' +
                           'Examples:\n• `.translate es Hello world`\n• `.translate fr How are you?`');
            }
            
            targetLang = args[0];
            textToTranslate = args.slice(1).join(' ');
        }

        if (!textToTranslate.trim()) {
            return reply('❌ No text found to translate.');
        }

        try {
            await reply('🔄 Translating...');

            // Note: This would require a translation API
            // For now, we'll show the structure and ask for API configuration
            const translationMessage = `🌐 **Translation Service Setup Required**\n\n` +
                                      `📝 **Original Text:** ${bot.utils.truncateText(textToTranslate, 100)}\n` +
                                      `🎯 **Target Language:** ${targetLang}\n\n` +
                                      `⚠️ **Notice:** Translation functionality requires API configuration.\n` +
                                      `Please contact the bot owner to set up translation services.\n\n` +
                                      `🔧 **Required:** Google Translate API or similar service`;

            await reply(translationMessage);

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Translate command failed:', error);
            return reply('❌ Translation failed. Please try again later.');
        }
    }
};