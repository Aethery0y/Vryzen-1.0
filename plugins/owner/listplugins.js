module.exports = {
    name: 'listplugins',
    description: 'List all installed plugins with detailed information',
    category: 'owner',
    permissions: ['owner'],
    usage: '.listplugins [category]',
    aliases: ['pluginlist'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        const category = args[0]?.toLowerCase();

        try {
            let plugins;
            
            if (category) {
                plugins = bot.pluginManager.getPluginsByCategory(category);
                if (plugins.length === 0) {
                    return reply(`❌ No plugins found in category '${category}'.\n\nAvailable categories: admin, owner, user, media, utility, moderation`);
                }
            } else {
                plugins = bot.pluginManager.getAllPlugins();
            }

            if (plugins.length === 0) {
                return reply('❌ No plugins installed.');
            }

            // Group by category
            const categories = {};
            plugins.forEach(plugin => {
                const cat = plugin.category || 'uncategorized';
                if (!categories[cat]) {
                    categories[cat] = [];
                }
                categories[cat].push(plugin);
            });

            let listMessage = category 
                ? `🔌 **${category.toUpperCase()} PLUGINS**\n\n`
                : `🔌 **ALL INSTALLED PLUGINS**\n\n`;

            listMessage += `📊 **Total:** ${plugins.length} plugin${plugins.length > 1 ? 's' : ''}\n\n`;

            for (const [cat, categoryPlugins] of Object.entries(categories)) {
                listMessage += `📂 **${cat.toUpperCase()} (${categoryPlugins.length})**\n`;
                
                categoryPlugins.forEach((plugin, index) => {
                    const status = plugin.enabled ? '✅' : '❌';
                    const permissions = plugin.permissions ? plugin.permissions.join(',') : 'user';
                    
                    listMessage += `${status} **${plugin.name}**\n`;
                    listMessage += `   📖 ${plugin.description || 'No description'}\n`;
                    listMessage += `   🔐 ${permissions}\n`;
                    
                    if (plugin.aliases && plugin.aliases.length > 0) {
                        listMessage += `   🏷️ ${plugin.aliases.join(', ')}\n`;
                    }
                    
                    listMessage += `\n`;
                });
            }

            // Add statistics
            const enabledCount = plugins.filter(p => p.enabled).length;
            const disabledCount = plugins.length - enabledCount;
            
            listMessage += `📈 **STATISTICS**\n`;
            listMessage += `✅ **Enabled:** ${enabledCount}\n`;
            listMessage += `❌ **Disabled:** ${disabledCount}\n\n`;

            listMessage += `💡 **COMMANDS**\n`;
            listMessage += `• \`.plugin status <name>\` - Plugin details\n`;
            listMessage += `• \`.plugin on/off <name>\` - Toggle plugin\n`;
            listMessage += `• \`.addplugin\` - Install new plugin\n`;
            listMessage += `• \`.removeplugin <name>\` - Uninstall plugin`;

            // Split message if too long
            if (listMessage.length > 4000) {
                const chunks = this.splitMessage(listMessage, 4000);
                for (let i = 0; i < chunks.length; i++) {
                    await reply(chunks[i]);
                    if (i < chunks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between chunks
                    }
                }
            } else {
                await reply(listMessage);
            }

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('List plugins command failed:', error);
            return reply('❌ Failed to get plugin list. Please try again.');
        }
    },

    splitMessage(message, maxLength) {
        const chunks = [];
        const lines = message.split('\n');
        let currentChunk = '';

        for (const line of lines) {
            if ((currentChunk + line + '\n').length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = line + '\n';
                } else {
                    // Single line is too long, force split
                    chunks.push(line);
                }
            } else {
                currentChunk += line + '\n';
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }
};
