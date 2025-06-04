const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

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
            console.log('AddPlugin: Starting plugin installation process');
            
            // Check if there's a document in the message
            let hasDocument = false;
            let fileName = null;
            let documentData = null;

            // Check multiple possible locations for document data
            if (message?.message?.documentMessage) {
                hasDocument = true;
                documentData = message.message.documentMessage;
                fileName = documentData.fileName || documentData.title;
                console.log('AddPlugin: Found document in message.message.documentMessage');
            } else if (message?.documentMessage) {
                hasDocument = true;
                documentData = message.documentMessage;
                fileName = documentData.fileName || documentData.title;
                console.log('AddPlugin: Found document in message.documentMessage');
            } else if (message?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage) {
                hasDocument = true;
                documentData = message.message.extendedTextMessage.contextInfo.quotedMessage.documentMessage;
                fileName = documentData.fileName || documentData.title;
                console.log('AddPlugin: Found document in quoted message');
            }

            if (!hasDocument) {
                console.log('AddPlugin: No document found');
                return reply('❌ Please send a JavaScript plugin file.\n\nUsage: Send a .js file with caption `.addplugin`\n\n📋 **Requirements:**\n• File must have .js extension\n• Must be a valid Vryzen plugin\n• Will be validated before installation');
            }

            // Validate file extension
            if (!fileName || !fileName.toLowerCase().endsWith('.js')) {
                console.log('AddPlugin: Invalid file extension:', fileName);
                return reply('❌ Please send a JavaScript file (.js extension).\n\nUsage: Send a .js plugin file with caption `.addplugin`');
            }

            console.log('AddPlugin: Valid JS file detected:', fileName);
            
            // Show installation progress
            await reply('🔄 **DOWNLOADING & INSTALLING PLUGIN...**\n\n⚠️ **Security Notice:**\nDownloading and analyzing plugin for malicious code...\nThis may take a moment.');

            // Download the file using Vryzen's method
            let pluginBuffer = null;
            try {
                // Try the most common Vryzen download methods
                if (ctx.downloadMedia) {
                    pluginBuffer = await ctx.downloadMedia();
                } else if (bot.downloadMedia) {
                    pluginBuffer = await bot.downloadMedia(message);
                } else if (bot.sock && bot.sock.downloadMediaMessage) {
                    pluginBuffer = await bot.sock.downloadMediaMessage(message);
                } else {
                    throw new Error('No download method available');
                }

                if (!pluginBuffer) {
                    throw new Error('Download returned null');
                }

                console.log('AddPlugin: File downloaded successfully, size:', pluginBuffer.length, 'bytes');
            } catch (downloadError) {
                console.error('AddPlugin: Download failed:', downloadError);
                return reply('❌ Failed to download plugin file. Please try again or check if the file is properly attached.');
            }

            // Convert to string
            const pluginCode = pluginBuffer.toString('utf8');
            
            // Basic security check
            if (await this.containsDangerousCode(pluginCode)) {
                console.log('AddPlugin: Security check failed');
                return reply('❌ Security check failed. Plugin contains potentially harmful code.');
            }

            // Validate plugin structure
            const pluginInfo = await this.parsePluginInfo(pluginCode);
            if (!pluginInfo.valid) {
                console.log('AddPlugin: Structure validation failed:', pluginInfo.error);
                return reply(`❌ Invalid plugin structure: ${pluginInfo.error}`);
            }

            // Install the plugin
            const installResult = await this.installPlugin(pluginCode, pluginInfo.name, pluginInfo.category || 'misc');
            
            if (installResult.success) {
                // Try to reload plugins in Vryzen
                try {
                    if (bot.reloadPlugins) {
                        await bot.reloadPlugins();
                    } else if (bot.loadPlugin) {
                        await bot.loadPlugin(pluginInfo.name);
                    }
                } catch (reloadError) {
                    console.log('AddPlugin: Plugin reload failed, but installation succeeded');
                }

                const hash = crypto.createHash('md5').update(pluginCode).digest('hex').substring(0, 8);
                
                await reply(`✅ **PLUGIN INSTALLED SUCCESSFULLY**\n\n` +
                           `📝 **Name:** ${pluginInfo.name}\n` +
                           `📂 **Category:** ${pluginInfo.category || 'misc'}\n` +
                           `🔐 **Hash:** ${hash}\n` +
                           `👤 **Installed by:** @${sender.split('@')[0]}\n` +
                           `⏰ **Time:** ${new Date().toLocaleString()}\n\n` +
                           `🚀 **Status:** Plugin ready to use!\n` +
                           `💡 Try \`.${pluginInfo.name}\` to use the new plugin.`, {
                    mentions: [sender]
                });
            } else {
                return reply(`❌ Plugin installation failed: ${installResult.error}`);
            }

        } catch (error) {
            console.error('AddPlugin: Unexpected error:', error);
            return reply(`❌ Plugin installation failed: ${error.message}`);
        }
    },

    // Check for dangerous code patterns
    async containsDangerousCode(code) {
        const dangerousPatterns = [
            /require\s*\(\s*['"`]child_process['"`]\s*\)/i,
            /require\s*\(\s*['"`]fs['"`]\s*\).*\.rm/i,
            /require\s*\(\s*['"`]fs['"`]\s*\).*\.unlink/i,
            /eval\s*\(/i,
            /Function\s*\(/i,
            /process\.exit/i,
            /process\.kill/i,
            /\.exec\s*\(/i,
            /\.spawn\s*\(/i,
            /\.deleteFile/i,
            /\.removeFile/i
        ];

        return dangerousPatterns.some(pattern => pattern.test(code));
    },

    // Parse plugin information
    async parsePluginInfo(code) {
        try {
            // Check for module.exports
            if (!code.includes('module.exports')) {
                return { valid: false, error: 'Plugin must use module.exports' };
            }

            // Extract plugin name
            const nameMatch = code.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
            if (!nameMatch) {
                return { valid: false, error: 'Plugin must have a name property' };
            }

            // Check for execute function
            if (!code.includes('execute')) {
                return { valid: false, error: 'Plugin must have an execute function' };
            }

            // Extract category if present
            const categoryMatch = code.match(/category\s*:\s*['"`]([^'"`]+)['"`]/);
            
            return {
                valid: true,
                name: nameMatch[1],
                category: categoryMatch ? categoryMatch[1] : 'misc'
            };
        } catch (error) {
            return { valid: false, error: 'Failed to parse plugin: ' + error.message };
        }
    },

    // Install plugin to filesystem
    async installPlugin(code, name, category) {
        try {
            // Create plugins directory structure
            const pluginsDir = path.join(process.cwd(), 'plugins');
            const categoryDir = path.join(pluginsDir, category);
            
            // Ensure directories exist
            await fs.mkdir(pluginsDir, { recursive: true });
            await fs.mkdir(categoryDir, { recursive: true });

            // Write plugin file
            const pluginPath = path.join(categoryDir, `${name}.js`);
            await fs.writeFile(pluginPath, code, 'utf8');

            console.log('AddPlugin: Plugin saved to:', pluginPath);

            return {
                success: true,
                path: pluginPath,
                name: name,
                category: category
            };
        } catch (error) {
            console.error('AddPlugin: Installation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};