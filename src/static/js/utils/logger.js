import { EventEmitter } from 'https://cdn.skypack.dev/eventemitter3';

/**
 * @fileoverview A simple logger that logs messages to the console and emits events.
 * It also stores a limited number of logs in memory and provides a method to export them.
 */
export class Logger extends EventEmitter {
    static instance = null;
    static maxStoredLogs = 1000;
    static logs = [];

    /**
     * Returns the singleton instance of the Logger.
     *
     * @returns {Logger} The Logger instance.
     */
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Logs a message with the given level and optional data.
     *
     * @param {string} level - The log level (e.g., 'debug', 'info', 'warn', 'error').
     * @param {string} message - The message to log.
     * @param {Object} [data=null] - Optional data to include with the log.
     */
    static log(level, message, data = null) {
        const logger = Logger.getInstance();
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        // Store log
        Logger.logs.push(logEntry);
        if (Logger.logs.length > Logger.maxStoredLogs) {
            Logger.logs.shift();
        }

        // Console output
        switch (level) {
            case Logger.LEVELS.ERROR:
                console.error(logEntry);
                break;
            case Logger.LEVELS.WARN:
                console.warn(logEntry);
                break;
            case Logger.LEVELS.INFO:
                console.info(logEntry);
                break;
            default:
                console.log(logEntry);
        }

        // Emit event
        logger.emit('log', logEntry);
    }

    /**
     * Exports the stored logs as a JSON file.
     */
    static export() {
        const blob = new Blob([JSON.stringify(Logger.logs, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Log levels.
     * @enum {string}
     */
    static LEVELS = {
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error'
    };

    /**
     * Logs a debug message.
     *
     * @param {string} message - The message to log.
     * @param {Object} [data] - Optional data to include with the log.
     */
    static debug(message, data) {
        this.log(this.LEVELS.DEBUG, message, data);
    }

    /**
     * Logs an info message.
     *
     * @param {string} message - The message to log.
     * @param {Object} [data] - Optional data to include with the log.
     */
    static info(message, data) {
        this.log(this.LEVELS.INFO, message, data);
    }

    /**
     * Logs a warning message.
     *
     * @param {string} message - The message to log.
     * @param {Object} [data] - Optional data to include with the log.
     */
    static warn(message, data) {
        this.log(this.LEVELS.WARN, message, data);
    }

    /**
     * Logs an error message.
     *
     * @param {string} message - The message to log.
     * @param {Object} [data] - Optional data to include with the log.
     */
    static error(message, data) {
        this.log(this.LEVELS.ERROR, message, data);
    }
} 