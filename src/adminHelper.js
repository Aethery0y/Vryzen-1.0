class AdminHelper {
    constructor(bot) {
        this.bot = bot;
    }

    async isBotAdmin(chatId) {
        try {
            if (!this.bot.sock || !this.bot.sock.user) {
                return false;
            }

            const groupMetadata = await this.bot.sock.groupMetadata(chatId);
            if (!groupMetadata || !groupMetadata.participants) {
                return false;
            }

            // Get bot's WhatsApp ID
            const botNumber = this.bot.sock.user.id.split(':')[0];
            const botId = botNumber + '@s.whatsapp.net';

            // Find bot in participants
            const botParticipant = groupMetadata.participants.find(p => 
                p.id === botId || 
                p.id.includes(botNumber) ||
                p.id.split('@')[0] === botNumber
            );

            if (!botParticipant) {
                this.bot.logger.debug('Bot not found in group participants', { 
                    botId, 
                    botNumber, 
                    participants: groupMetadata.participants.map(p => p.id) 
                });
                return false;
            }

            const isAdmin = botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin';
            
            this.bot.logger.debug('Bot admin status check', {
                botId,
                botNumber,
                foundParticipant: botParticipant.id,
                adminStatus: botParticipant.admin,
                isAdmin
            });

            return isAdmin;

        } catch (error) {
            this.bot.logger.error('Error checking bot admin status:', error);
            return false;
        }
    }

    async requireBotAdmin(chatId, reply) {
        const isAdmin = await this.isBotAdmin(chatId);
        if (!isAdmin) {
            await reply('❌ I need admin privileges to perform this action.\n\n💡 Please make me an admin in this group first.');
            return false;
        }
        return true;
    }
}

module.exports = AdminHelper;