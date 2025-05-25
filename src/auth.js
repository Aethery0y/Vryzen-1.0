const qrcode = require('qrcode-terminal');
const readline = require('readline');
const chalk = require('chalk');

class Auth {
    constructor(bot) {
        this.bot = bot;
    }

    async handlePairingCode(sock) {
        if (!sock.authState.creds.registered) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question(chalk.cyan('📱 Enter your phone number (with country code): '), async (phoneNumber) => {
                    try {
                        const sanitizedNumber = phoneNumber.replace(/\D/g, '');
                        const code = await sock.requestPairingCode(sanitizedNumber);
                        console.log(chalk.green(`🔑 Your pairing code: ${code}`));
                        console.log(chalk.yellow('📱 Enter this code in WhatsApp > Linked Devices > Link a Device'));
                    } catch (error) {
                        console.log(chalk.red('❌ Failed to get pairing code:'), error.message);
                        this.bot.logger.error('Pairing code error:', error);
                    }
                    rl.close();
                    resolve();
                });
            });
        }
    }

    displayQRCode(qr) {
        console.log(chalk.yellow('\n📱 Scan this QR code with WhatsApp:'));
        console.log(chalk.gray('Go to WhatsApp > Menu > Linked Devices > Link a Device'));
        qrcode.generate(qr, { small: true });
    }

    async validateSession(authState) {
        try {
            // Check if session is valid
            if (!authState.creds.noiseKey) {
                return false;
            }

            // Additional session validation can be added here
            return true;
        } catch (error) {
            this.bot.logger.error('Session validation failed:', error);
            return false;
        }
    }

    async refreshSession(sock) {
        try {
            // Attempt to refresh the session
            await sock.logout();
            this.bot.logger.info('Session refreshed');
            return true;
        } catch (error) {
            this.bot.logger.error('Session refresh failed:', error);
            return false;
        }
    }
}

module.exports = Auth;
