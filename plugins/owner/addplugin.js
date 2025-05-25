const path = require('path');

module.exports = {
    name: 'addplugin',
    description: 'Install a new plugin from uploaded file',
    category: 'owner',
    permissions: ['owner'],
    usage: '.addplugin (send with plugin file)',
    aliases: ['installplugin'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            // Check if there's a document/file in the message
            const msg = message.message;
            let pluginFile = null;

            // Check for document
            if (msg.documentMessage) {
                const doc = msg.documentMessage;
                
                // Validate file type
                if (!doc.fileName || !doc.fileName.endsWith('.js')) {
                    return reply('❌ Please send a JavaScript file (.js extension).\n\nUsage: Send a .js plugin file with caption `.addplugin`');
                }

                // Download the file
                try {
                    pluginFile = await ctx.downloadMedia();
                    if (!pluginFile) {
                        return reply('❌ Failed to download plugin file.');
                    }
                } catch (error) {
                    return reply('❌ Failed to download plugin file.');
                }
            } else {
                return reply('❌ Please send a JavaScript plugin file.\n\nUsage: Send a .js file with caption `.addplugin`\n\n📋 **Requirements:**\n• File must have .js extension\n• Must be a valid Vryzen plugin\n• Will be validated before installation');
            }

            // Security warning
            await reply('🔄 **INSTALLING PLUGIN...**\n\n⚠️ **Security Notice:**\nAnalyzing plugin for malicious code...\nThis may take a moment.');

            // Install the plugin
            const result = await bot.pluginManager.installPlugin(pluginFile, sender);

            if (result.success) {
                // Immediately load the plugin after installation
                const pluginPath = path.join('./plugins', result.category, `${result.name}.js`);
                await bot.pluginManager.loadPlugin(result.category, `${result.name}.js`);
                
                await reply(`✅ **PLUGIN INSTALLED & LOADED**\n\n` +
                           `📝 **Name:** ${result.name}\n` +
                           `📂 **Category:** ${result.category}\n` +
                           `🔐 **Hash:** ${result.hash.substring(0, 16)}...\n` +
                           `👤 **Installed by:** @${sender.split('@')[0]}\n` +
                           `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                           `🚀 **Status:** Ready to use immediately!\n` +
                           `💡 Try \`.${result.name}\` or use \`.plugin status ${result.name}\` for details.`, {
                    mentions: [sender]
                });
            }

        } catch (error) {
            bot.logger.error('Add plugin command failed:', error);
            
            if (error.message.includes('Invalid file type')) {
                return reply('❌ Invalid file type. Only JavaScript files (.js) are allowed.');
            } else if (error.message.includes('Invalid plugin structure')) {
                return reply('❌ Invalid plugin structure. Please ensure your plugin follows the Vryzen plugin format.');
            } else if (error.message.includes('malicious')) {
                return reply('❌ Security check failed. Plugin contains potentially harmful code.');
            } else {
                return reply(`❌ Plugin installation failed: ${error.message}`);
            }
        }
    }
};
