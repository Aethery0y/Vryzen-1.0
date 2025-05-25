const { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

const Database = require('./database');
const logger = require('./logger');
const PluginManager = require('./pluginManager');
const MessageHandler = require('./messageHandler');
const Permissions = require('./permissions');
const Auth = require('./auth');

class Bot {
    constructor(options = {}) {
        this.usePairCode = options.usePairCode || false;
        this.sessionPath = options.sessionPath || './sessions';
        this.sock = null;
        this.qr = undefined;
        
        // Initialize core components
        this.database = new Database();
        this.logger = logger;
        this.utils = require('./utils');
        this.adminHelper = new (require('./adminHelper'))(this);
        this.pluginManager = new PluginManager(this);
        this.messageHandler = new MessageHandler(this);
        this.permissions = new Permissions(this);
        this.auth = new Auth(this);
        
        this.startTime = Date.now();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    async start() {
        try {
            // Initialize logger first
            await this.logger.init();
            
            // Initialize database
            await this.database.init();
            this.logger.info('Database initialized successfully');

            // Load plugins
            await this.pluginManager.loadPlugins();
            this.logger.info('Plugins loaded successfully');

            // Start WhatsApp connection
            await this.connectToWhatsApp();
            
        } catch (error) {
            this.logger.error('Failed to start bot:', error);
            throw error;
        }
    }

    async connectToWhatsApp() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            const { version, isLatest } = await fetchLatestBaileysVersion();
            
            console.log(chalk.green(`🔄 Using WA v${version.join('.')}, isLatest: ${isLatest}`));
            
            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: !this.usePairCode,
                browser: ['Vryzen Bot', 'Chrome', '1.0.0'],
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                emitOwnEvents: true,
                fireInitQueries: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: true,
                logger: {
                    level: 'error',
                    child: () => ({
                        info: () => {},
                        error: () => {},
                        warn: () => {},
                        debug: () => {},
                        trace: () => {}
                    }),
                    info: () => {},
                    error: () => {},
                    warn: () => {},
                    debug: () => {},
                    trace: () => {}
                }
            });

            // Handle connection events
            this.sock.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(update);
            });

            // Handle credentials update
            this.sock.ev.on('creds.update', saveCreds);

            // Handle messages
            this.sock.ev.on('messages.upsert', async (m) => {
                await this.messageHandler.handleMessages(m);
            });

            // Handle group participants update
            this.sock.ev.on('group-participants.update', async (update) => {
                await this.handleGroupUpdate(update);
            });

            // Handle call events
            this.sock.ev.on('call', async (calls) => {
                await this.handleCalls(calls);
            });

        } catch (error) {
            this.logger.error('Connection error:', error);
            throw error;
        }
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            if (!this.usePairCode) {
                console.log(chalk.yellow('📱 Scan this QR code with WhatsApp:'));
                qrcode.generate(qr, { small: true });
                this.qr = qr;
            } else {
                // For pairing code mode, request pairing code when QR is available
                await this.sendPairingCode();
            }
        }

        if (connection === 'close') {
            this.isConnected = false;
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log(chalk.red('❌ Connection closed due to'), lastDisconnect?.error);

            if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(chalk.yellow(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`));
                setTimeout(() => this.connectToWhatsApp(), 5000);
            } else {
                console.log(chalk.red('💥 Max reconnection attempts reached or logged out'));
                process.exit(1);
            }
        } else if (connection === 'open') {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log(chalk.green('✅ Connected to WhatsApp successfully!'));
            
            // Send pairing code if needed
            if (this.usePairCode && !this.sock.authState.creds.registered) {
                await this.sendPairingCode();
            }
            
            this.logger.info('Bot connected and ready');
        }
    }

    async sendPairingCode() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(chalk.cyan('📱 Enter your phone number (with country code, e.g., +918810502592): '), async (phoneNumber) => {
                try {
                    const code = await this.sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
                    console.log(chalk.green(`🔑 Your pairing code: ${code}`));
                } catch (error) {
                    console.log(chalk.red('❌ Failed to get pairing code:'), error.message);
                }
                rl.close();
                resolve();
            });
        });
    }

    async handleGroupUpdate(update) {
        try {
            const { id, participants, action } = update;
            
            // Log group updates
            this.logger.info(`Group update in ${id}:`, { participants, action });
            
            // Handle welcome/goodbye messages
            if (action === 'add') {
                await this.sendWelcomeMessage(id, participants);
            } else if (action === 'remove') {
                await this.sendGoodbyeMessage(id, participants);
            }
            
        } catch (error) {
            this.logger.error('Error handling group update:', error);
        }
    }

    async sendWelcomeMessage(groupId, participants) {
        try {
            const welcomeMsg = await this.database.getGroupSetting(groupId, 'welcome_message');
            if (welcomeMsg) {
                const mentions = participants;
                await this.sock.sendMessage(groupId, {
                    text: welcomeMsg.replace(/{mention}/g, participants.map(p => `@${p.split('@')[0]}`).join(' ')),
                    mentions
                });
            }
        } catch (error) {
            this.logger.error('Error sending welcome message:', error);
        }
    }

    async sendGoodbyeMessage(groupId, participants) {
        try {
            const goodbyeMsg = await this.database.getGroupSetting(groupId, 'goodbye_message');
            if (goodbyeMsg) {
                await this.sock.sendMessage(groupId, {
                    text: goodbyeMsg.replace(/{mention}/g, participants.map(p => `@${p.split('@')[0]}`).join(' '))
                });
            }
        } catch (error) {
            this.logger.error('Error sending goodbye message:', error);
        }
    }

    async handleCalls(calls) {
        try {
            for (const call of calls) {
                if (call.status === 'offer') {
                    // Decline calls automatically
                    await this.sock.rejectCall(call.id, call.from);
                    this.logger.info(`Declined call from ${call.from}`);
                }
            }
        } catch (error) {
            this.logger.error('Error handling calls:', error);
        }
    }

    async sendMessage(jid, content, options = {}) {
        try {
            if (!this.isConnected) {
                throw new Error('Bot is not connected to WhatsApp');
            }
            
            return await this.sock.sendMessage(jid, content, options);
        } catch (error) {
            this.logger.error('Error sending message:', error);
            throw error;
        }
    }

    async stop() {
        try {
            if (this.sock) {
                await this.sock.logout();
                this.sock = null;
            }
            
            await this.database.close();
            this.logger.info('Bot stopped gracefully');
            
        } catch (error) {
            this.logger.error('Error stopping bot:', error);
        }
    }

    getUptime() {
        const uptime = Date.now() - this.startTime;
        const seconds = Math.floor(uptime / 1000) % 60;
        const minutes = Math.floor(uptime / (1000 * 60)) % 60;
        const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
}

module.exports = Bot;
