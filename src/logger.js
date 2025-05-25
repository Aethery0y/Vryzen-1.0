const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;

class Logger {
    constructor() {
        this.logger = null;
        this.init();
    }

    async init() {
        try {
            // Ensure logs directory exists
            const logsDir = './logs';
            await fs.mkdir(logsDir, { recursive: true });

            // Create logger with multiple transports
            this.logger = winston.createLogger({
                level: process.env.LOG_LEVEL || 'info',
                format: winston.format.combine(
                    winston.format.timestamp({
                        format: 'YYYY-MM-DD HH:mm:ss'
                    }),
                    winston.format.errors({ stack: true }),
                    winston.format.json()
                ),
                defaultMeta: { service: 'vryzen-bot' },
                transports: [
                    // Error log file
                    new winston.transports.File({
                        filename: path.join(logsDir, 'error.log'),
                        level: 'error',
                        maxsize: 5242880, // 5MB
                        maxFiles: 5,
                        format: winston.format.combine(
                            winston.format.timestamp(),
                            winston.format.json()
                        )
                    }),

                    // Combined log file
                    new winston.transports.File({
                        filename: path.join(logsDir, 'combined.log'),
                        maxsize: 5242880, // 5MB
                        maxFiles: 5,
                        format: winston.format.combine(
                            winston.format.timestamp(),
                            winston.format.json()
                        )
                    }),

                    // Console output
                    new winston.transports.Console({
                        format: winston.format.combine(
                            winston.format.colorize(),
                            winston.format.timestamp({ format: 'HH:mm:ss' }),
                            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                                let msg = `${timestamp} [${service}] ${level}: ${message}`;
                                if (Object.keys(meta).length > 0) {
                                    msg += ` ${JSON.stringify(meta)}`;
                                }
                                return msg;
                            })
                        )
                    })
                ]
            });

            // Add audit logging for sensitive operations
            this.auditLogger = winston.createLogger({
                level: 'info',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                ),
                transports: [
                    new winston.transports.File({
                        filename: path.join(logsDir, 'audit.log'),
                        maxsize: 5242880,
                        maxFiles: 10
                    })
                ]
            });

        } catch (error) {
            console.error('Failed to initialize logger:', error);
            throw error;
        }
    }

    info(message, meta = {}) {
        this.logger?.info(message, meta);
    }

    error(message, meta = {}) {
        this.logger?.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger?.warn(message, meta);
    }

    debug(message, meta = {}) {
        this.logger?.debug(message, meta);
    }

    verbose(message, meta = {}) {
        this.logger?.verbose(message, meta);
    }

    // Audit logging for sensitive operations
    audit(action, userId, details = {}) {
        this.auditLogger?.info('AUDIT', {
            action,
            userId,
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    // Create child logger for specific modules
    child(meta) {
        return {
            info: (message, additionalMeta = {}) => this.info(message, { ...meta, ...additionalMeta }),
            error: (message, additionalMeta = {}) => this.error(message, { ...meta, ...additionalMeta }),
            warn: (message, additionalMeta = {}) => this.warn(message, { ...meta, ...additionalMeta }),
            debug: (message, additionalMeta = {}) => this.debug(message, { ...meta, ...additionalMeta }),
            verbose: (message, additionalMeta = {}) => this.verbose(message, { ...meta, ...additionalMeta })
        };
    }

    // Log command execution
    logCommand(userId, command, success, error = null, executionTime = 0) {
        const logData = {
            userId,
            command,
            success,
            executionTime,
            timestamp: new Date().toISOString()
        };

        if (error) {
            logData.error = error.message || error;
            logData.stack = error.stack;
        }

        if (success) {
            this.info(`Command executed: ${command}`, logData);
        } else {
            this.error(`Command failed: ${command}`, logData);
        }
    }

    // Log plugin operations
    logPlugin(action, pluginName, userId, details = {}) {
        this.audit(`PLUGIN_${action.toUpperCase()}`, userId, {
            pluginName,
            ...details
        });

        this.info(`Plugin ${action}: ${pluginName}`, {
            action,
            pluginName,
            userId,
            ...details
        });
    }

    // Log owner management
    logOwnerAction(action, targetUserId, actionBy, details = {}) {
        this.audit(`OWNER_${action.toUpperCase()}`, actionBy, {
            targetUserId,
            ...details
        });

        this.info(`Owner ${action}: ${targetUserId}`, {
            action,
            targetUserId,
            actionBy,
            ...details
        });
    }

    // Log security events
    logSecurity(event, userId, details = {}) {
        this.audit(`SECURITY_${event.toUpperCase()}`, userId, details);
        
        this.warn(`Security event: ${event}`, {
            event,
            userId,
            ...details
        });
    }
}

// Export singleton instance
module.exports = new Logger();
