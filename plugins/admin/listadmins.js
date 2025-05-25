module.exports = {
    name: 'listadmins',
    description: 'List all group admins with their roles',
    category: 'admin',
    permissions: ['user'],
    usage: '.listadmins',
    aliases: ['admins', 'adminlist'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        try {
            // Get group metadata
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            
            // Filter admins and creators
            const superAdmins = groupMetadata.participants.filter(p => p.admin === 'superadmin');
            const admins = groupMetadata.participants.filter(p => p.admin === 'admin');
            
            if (superAdmins.length === 0 && admins.length === 0) {
                return reply('❌ No admins found in this group.');
            }

            let adminMessage = `👑 **GROUP ADMINS**\n\n`;
            adminMessage += `👥 **Group:** ${groupMetadata.subject}\n`;
            adminMessage += `📊 **Total Admins:** ${superAdmins.length + admins.length}\n\n`;

            // List creators/super admins
            if (superAdmins.length > 0) {
                adminMessage += `👑 **CREATORS (${superAdmins.length})**\n`;
                
                for (let i = 0; i < superAdmins.length; i++) {
                    const admin = superAdmins[i];
                    const phone = admin.id.split('@')[0];
                    
                    try {
                        // Try to get user info from database
                        const userInfo = bot.database.getUser(admin.id);
                        const displayName = userInfo?.name || `+${phone}`;
                        
                        adminMessage += `${i + 1}. @${phone} ${displayName !== `+${phone}` ? `(${displayName})` : ''}\n`;
                    } catch (error) {
                        adminMessage += `${i + 1}. @${phone}\n`;
                    }
                }
                adminMessage += `\n`;
            }

            // List regular admins
            if (admins.length > 0) {
                adminMessage += `👮‍♂️ **ADMINS (${admins.length})**\n`;
                
                for (let i = 0; i < admins.length; i++) {
                    const admin = admins[i];
                    const phone = admin.id.split('@')[0];
                    
                    try {
                        // Try to get user info from database
                        const userInfo = bot.database.getUser(admin.id);
                        const displayName = userInfo?.name || `+${phone}`;
                        
                        adminMessage += `${i + 1}. @${phone} ${displayName !== `+${phone}` ? `(${displayName})` : ''}\n`;
                    } catch (error) {
                        adminMessage += `${i + 1}. @${phone}\n`;
                    }
                }
            }

            // Add bot owners if any
            try {
                const botOwners = bot.database.getAllOwners();
                if (botOwners.length > 0) {
                    adminMessage += `\n🤖 **BOT OWNERS (${botOwners.length})**\n`;
                    
                    for (let i = 0; i < botOwners.length; i++) {
                        const owner = botOwners[i];
                        const phone = owner.phone.replace('+', '');
                        const isRealOwner = owner.phone === '+918810502592';
                        
                        adminMessage += `${i + 1}. @${phone} ${isRealOwner ? '(Real Owner)' : '(Owner)'}\n`;
                    }
                }
            } catch (error) {
                // Ignore errors getting owners
            }

            // Prepare mentions
            const mentions = [...superAdmins.map(a => a.id), ...admins.map(a => a.id)];

            await reply(adminMessage, { mentions });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('List admins command failed:', error);
            return reply('❌ Failed to get admin list. Please try again.');
        }
    }
};
