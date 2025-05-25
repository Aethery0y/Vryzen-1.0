const { downloadMediaMessage } = require('@whiskeysockets/baileys');

class MessageHandler {
    constructor(bot) {
        this.bot = bot;
        this.prefix = process.env.BOT_PREFIX || '.';
        this.cooldowns = new Map();
    }

    async handleMessages(m) {
        try {
            const messages = m.messages;
            
            for (const message of messages) {
                // Skip if message is from status broadcast
                if (message.key.remoteJid === 'status@broadcast') continue;
                
                // Skip if message is from self
                if (message.key.fromMe) continue;
                
                // Skip if no message content
                if (!message.message) continue;

                await this.processMessage(message);
            }
        } catch (error) {
            this.bot.logger.error('Error handling messages:', error);
        }
    }

    async processMessage(message) {
        try {
            const messageContent = this.extractMessageContent(message);
            if (!messageContent) return;

            const sender = message.key.participant || message.key.remoteJid;
            const chatId = message.key.remoteJid;
            const isGroup = chatId.includes('@g.us');
            
            // Update user in database
            const senderPhone = sender.split('@')[0];
            const user = this.bot.database.getUser(sender);
            if (!user) {
                this.bot.database.createUser(sender, '+' + senderPhone);
            }

            // Update user stats
            this.bot.database.updateUserStats(sender, chatId, 1, 0);

            // Check if user is banned or muted
            if (await this.isUserRestricted(sender)) {
                return;
            }

            // Check if message is a command
            if (this.isCommand(messageContent)) {
                await this.handleCommand(message, messageContent, sender, chatId, isGroup);
            }

        } catch (error) {
            this.bot.logger.error('Error processing message:', error);
        }
    }

    extractMessageContent(message) {
        const msg = message.message;
        
        if (msg.conversation) {
            return msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
            return msg.extendedTextMessage.text;
        } else if (msg.imageMessage?.caption) {
            return msg.imageMessage.caption;
        } else if (msg.videoMessage?.caption) {
            return msg.videoMessage.caption;
        } else if (msg.documentMessage?.caption) {
            return msg.documentMessage.caption;
        }
        
        return null;
    }

    isCommand(text) {
        return text.startsWith(this.prefix);
    }

    async handleCommand(message, messageContent, sender, chatId, isGroup) {
        try {
            const args = messageContent.slice(this.prefix.length).trim().split(/\s+/);
            const commandName = args.shift()?.toLowerCase();
            
            if (!commandName) return;

            // Check cooldown
            if (this.isOnCooldown(sender, commandName)) {
                return;
            }

            // Get plugin
            const plugin = this.bot.pluginManager.getPlugin(commandName);
            if (!plugin) {
                // Check for aliases
                const aliasPlugin = this.findPluginByAlias(commandName);
                if (!aliasPlugin) return;
                
                await this.executePlugin(aliasPlugin, message, args, sender, chatId, isGroup);
                return;
            }

            await this.executePlugin(plugin, message, args, sender, chatId, isGroup);

        } catch (error) {
            this.bot.logger.error('Error handling command:', error);
            await this.sendErrorMessage(chatId, 'An error occurred while processing your command.');
        }
    }

    async executePlugin(plugin, message, args, sender, chatId, isGroup) {
        const startTime = Date.now();
        let success = false;
        let errorMessage = null;

        try {
            // Check permissions
            const hasPermission = await this.bot.permissions.checkPermission(
                sender, 
                plugin.permissions || ['user'],
                chatId,
                isGroup
            );

            if (!hasPermission) {
                await this.sendMessage(chatId, '❌ You don\'t have permission to use this command.');
                return;
            }

            // Check if plugin is enabled
            if (!this.bot.pluginManager.isPluginEnabled(plugin.name)) {
                await this.sendMessage(chatId, '❌ This command is currently disabled.');
                return;
            }

            // Prepare context
            const context = {
                bot: this.bot,
                message,
                args,
                sender,
                chatId,
                isGroup,
                messageHandler: this,
                reply: (text, options = {}) => this.sendMessage(chatId, text, { quoted: message, ...options }),
                sendMessage: (text, options = {}) => this.sendMessage(chatId, text, options),
                downloadMedia: () => this.downloadMedia(message),
                extractMentions: () => this.extractMentions(message),
                getQuotedMessage: () => this.getQuotedMessage(message),
                getUserInfo: (userId) => this.bot.database.getUser(userId),
                updateUserStats: (commandsIncrement = 1) => this.bot.database.updateUserStats(sender, chatId, 0, commandsIncrement),
                parseDuration: (durationStr) => this.parseDuration(durationStr),
                formatDuration: (seconds) => this.formatDuration(seconds)
            };

            // Execute plugin
            await plugin.execute(context);
            success = true;

            // Set cooldown
            this.setCooldown(sender, plugin.name, plugin.cooldown || 3000);

            // Update user stats
            this.bot.database.updateUserStats(sender, chatId, 0, 1);

        } catch (error) {
            errorMessage = error.message;
            this.bot.logger.error(`Plugin execution failed (${plugin.name}):`, error);
            await this.sendErrorMessage(chatId, 'Command execution failed. Please try again.');
        } finally {
            const executionTime = Date.now() - startTime;
            
            // Log command execution
            this.bot.database.logCommand(sender, chatId, plugin.name, success, errorMessage);
            this.bot.logger.logCommand(sender, plugin.name, success, errorMessage, executionTime);
        }
    }

    findPluginByAlias(alias) {
        for (const [name, plugin] of this.bot.pluginManager.plugins) {
            if (plugin.aliases && plugin.aliases.includes(alias)) {
                return plugin;
            }
        }
        return null;
    }

    async isUserRestricted(userId) {
        const user = this.bot.database.getUser(userId);
        if (!user) return false;

        const currentTime = Math.floor(Date.now() / 1000);

        // Check if banned
        if (user.banned) return true;

        // Check if muted
        if (user.muted_until > currentTime) return true;

        // Check if restricted
        if (user.restricted_until > currentTime) return true;

        return false;
    }

    isOnCooldown(userId, command) {
        const key = `${userId}:${command}`;
        const cooldownEnd = this.cooldowns.get(key);
        
        if (cooldownEnd && Date.now() < cooldownEnd) {
            return true;
        }
        
        return false;
    }

    setCooldown(userId, command, duration) {
        const key = `${userId}:${command}`;
        const cooldownEnd = Date.now() + duration;
        this.cooldowns.set(key, cooldownEnd);
        
        // Clean up expired cooldowns
        setTimeout(() => {
            this.cooldowns.delete(key);
        }, duration);
    }

    async sendMessage(chatId, content, options = {}) {
        try {
            return await this.bot.sendMessage(chatId, { text: content }, options);
        } catch (error) {
            this.bot.logger.error('Error sending message:', error);
        }
    }

    async sendErrorMessage(chatId, message) {
        await this.sendMessage(chatId, `❌ ${message}`);
    }

    async downloadMedia(message) {
        try {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const msg = quoted || message.message;
            
            if (msg.imageMessage || msg.videoMessage || msg.audioMessage || msg.documentMessage || msg.stickerMessage) {
                const buffer = await downloadMediaMessage(
                    { message: msg },
                    'buffer',
                    {},
                    { logger: this.bot.logger }
                );
                return buffer;
            }
            
            return null;
        } catch (error) {
            this.bot.logger.error('Error downloading media:', error);
            return null;
        }
    }

    extractMentions(message) {
        const mentions = [];
        const msg = message.message;
        
        if (msg.extendedTextMessage?.contextInfo?.mentionedJid) {
            mentions.push(...msg.extendedTextMessage.contextInfo.mentionedJid);
        }
        
        return mentions;
    }

    getQuotedMessage(message) {
        return message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    }

    parseDuration(durationStr) {
        const units = {
            's': 1,
            'm': 60,
            'h': 3600,
            'd': 86400,
            'w': 604800
        };
        
        const match = durationStr.match(/^(\d+)([smhdw])$/);
        if (!match) return null;
        
        const [, amount, unit] = match;
        return parseInt(amount) * units[unit];
    }

    formatDuration(seconds) {
        const units = [
            { name: 'week', seconds: 604800 },
            { name: 'day', seconds: 86400 },
            { name: 'hour', seconds: 3600 },
            { name: 'minute', seconds: 60 },
            { name: 'second', seconds: 1 }
        ];
        
        for (const unit of units) {
            if (seconds >= unit.seconds) {
                const amount = Math.floor(seconds / unit.seconds);
                return `${amount} ${unit.name}${amount > 1 ? 's' : ''}`;
            }
        }
        
        return '0 seconds';
    }
}

module.exports = MessageHandler;
