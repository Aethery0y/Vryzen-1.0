module.exports = {
    name: 'help',
    description: 'Show available commands and their usage',
    category: 'user',
    permissions: ['user'],
    usage: '.help [command/category]',
    aliases: ['commands', 'cmd'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        const query = args[0]?.toLowerCase();

        try {
            if (query) {
                // Show specific command or category help
                await this.showSpecificHelp(ctx, query);
            } else {
                // Show general help
                await this.showGeneralHelp(ctx);
            }

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Help command failed:', error);
            return reply('❌ Failed to display help information.');
        }
    },

    async showGeneralHelp(ctx) {
        const { bot, sender, reply } = ctx;

        try {
            // Get user role to determine available commands
            const userRole = await bot.permissions.getUserRole(sender, ctx.chatId, ctx.isGroup);
            const userLevel = bot.permissions.getPermissionLevel(userRole);

            // Get all enabled plugins
            const allPlugins = bot.pluginManager.getAllPlugins().filter(p => p.enabled);

            // Filter plugins by user permissions
            const availablePlugins = allPlugins.filter(plugin => {
                const pluginPermissions = plugin.permissions || ['user'];
                return pluginPermissions.some(perm => {
                    const requiredLevel = bot.permissions.getPermissionLevel(perm);
                    return userLevel >= requiredLevel;
                });
            });

            // Group by category
            const categories = {};
            availablePlugins.forEach(plugin => {
                const category = plugin.category || 'uncategorized';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(plugin);
            });

            let helpMessage = `📚 **VRYZEN BOT HELP**\n\n`;
            helpMessage += `👤 **Your Role:** ${userRole}\n`;
            helpMessage += `📊 **Available Commands:** ${availablePlugins.length}\n\n`;

            // Show categories
            const categoryOrder = ['user', 'admin', 'owner', 'media', 'utility', 'moderation'];
            
            for (const category of categoryOrder) {
                if (categories[category]) {
                    helpMessage += `📂 **${category.toUpperCase()} COMMANDS**\n`;
                    
                    categories[category].forEach(plugin => {
                        helpMessage += `• \`.${plugin.name}\` - ${plugin.description}\n`;
                    });
                    
                    helpMessage += `\n`;
                }
            }

            // Add remaining categories
            for (const [category, plugins] of Object.entries(categories)) {
                if (!categoryOrder.includes(category)) {
                    helpMessage += `📂 **${category.toUpperCase()} COMMANDS**\n`;
                    
                    plugins.forEach(plugin => {
                        helpMessage += `• \`.${plugin.name}\` - ${plugin.description}\n`;
                    });
                    
                    helpMessage += `\n`;
                }
            }

            helpMessage += `💡 **USAGE**\n`;
            helpMessage += `• \`.help <command>\` - Command details\n`;
            helpMessage += `• \`.help <category>\` - Category commands\n\n`;
            
            helpMessage += `🔗 **EXAMPLES**\n`;
            helpMessage += `• \`.help ping\` - Show ping command info\n`;
            helpMessage += `• \`.help admin\` - Show admin commands\n`;
            helpMessage += `• \`.help media\` - Show media commands`;

            await reply(helpMessage);

        } catch (error) {
            bot.logger.error('General help display failed:', error);
            return reply('❌ Failed to display general help.');
        }
    },

    async showSpecificHelp(ctx, query) {
        const { bot, sender, reply } = ctx;

        try {
            // Check if query is a command
            const plugin = bot.pluginManager.getPlugin(query);
            
            if (plugin) {
                // Show command help
                await this.showCommandHelp(ctx, plugin);
                return;
            }

            // Check if query is a category
            const categoryPlugins = bot.pluginManager.getPluginsByCategory(query);
            
            if (categoryPlugins.length > 0) {
                // Show category help
                await this.showCategoryHelp(ctx, query, categoryPlugins);
                return;
            }

            // Command/category not found
            return reply(`❌ Command or category '${query}' not found.\n\n💡 Use \`.help\` to see all available commands.`);

        } catch (error) {
            bot.logger.error('Specific help display failed:', error);
            return reply('❌ Failed to display specific help.');
        }
    },

    async showCommandHelp(ctx, plugin) {
        const { bot, sender, reply } = ctx;

        try {
            // Check if user has permission to see this command
            const userRole = await bot.permissions.getUserRole(sender, ctx.chatId, ctx.isGroup);
            const userLevel = bot.permissions.getPermissionLevel(userRole);
            const pluginPermissions = plugin.permissions || ['user'];
            
            const hasPermission = pluginPermissions.some(perm => {
                const requiredLevel = bot.permissions.getPermissionLevel(perm);
                return userLevel >= requiredLevel;
            });

            if (!hasPermission) {
                return reply(`❌ You don't have permission to view help for '${plugin.name}' command.`);
            }

            let commandHelp = `📖 **COMMAND HELP**\n\n`;
            commandHelp += `📝 **Name:** ${plugin.name}\n`;
            commandHelp += `📂 **Category:** ${plugin.category}\n`;
            commandHelp += `📖 **Description:** ${plugin.description}\n`;
            commandHelp += `🔐 **Permissions:** ${pluginPermissions.join(', ')}\n`;
            commandHelp += `⏱️ **Cooldown:** ${plugin.cooldown || 3000}ms\n`;

            if (plugin.usage) {
                commandHelp += `💡 **Usage:** ${plugin.usage}\n`;
            }

            if (plugin.aliases && plugin.aliases.length > 0) {
                commandHelp += `🏷️ **Aliases:** ${plugin.aliases.join(', ')}\n`;
            }

            commandHelp += `🔘 **Status:** ${bot.pluginManager.isPluginEnabled(plugin.name) ? '✅ Enabled' : '❌ Disabled'}`;

            await reply(commandHelp);

        } catch (error) {
            bot.logger.error('Command help display failed:', error);
            return reply('❌ Failed to display command help.');
        }
    },

    async showCategoryHelp(ctx, category, plugins) {
        const { bot, sender, reply } = ctx;

        try {
            // Filter plugins by user permissions
            const userRole = await bot.permissions.getUserRole(sender, ctx.chatId, ctx.isGroup);
            const userLevel = bot.permissions.getPermissionLevel(userRole);

            const availablePlugins = plugins.filter(plugin => {
                if (!plugin.enabled) return false;
                
                const pluginPermissions = plugin.permissions || ['user'];
                return pluginPermissions.some(perm => {
                    const requiredLevel = bot.permissions.getPermissionLevel(perm);
                    return userLevel >= requiredLevel;
                });
            });

            if (availablePlugins.length === 0) {
                return reply(`❌ No available commands in category '${category}' for your permission level.`);
            }

            let categoryHelp = `📂 **${category.toUpperCase()} COMMANDS**\n\n`;
            categoryHelp += `📊 **Available:** ${availablePlugins.length} command${availablePlugins.length > 1 ? 's' : ''}\n\n`;

            availablePlugins.forEach(plugin => {
                categoryHelp += `🔹 **${plugin.name}**\n`;
                categoryHelp += `   📖 ${plugin.description}\n`;
                if (plugin.usage) {
                    categoryHelp += `   💡 ${plugin.usage}\n`;
                }
                categoryHelp += `\n`;
            });

            categoryHelp += `💡 Use \`.help <command>\` for detailed command information.`;

            await reply(categoryHelp);

        } catch (error) {
            bot.logger.error('Category help display failed:', error);
            return reply('❌ Failed to display category help.');
        }
    }
};
