/**
 * @fileoverview Defines an error boundary for handling various types of errors in the application.
 * It provides a set of predefined error codes and an ApplicationError class for consistent error handling.
 */

/**
 * Enumeration of error codes for different types of errors.
 * @enum {string}
 */
export const ErrorCodes = {
    // Audio related errors
    AUDIO_DEVICE_NOT_FOUND: 'AUDIO_DEVICE_NOT_FOUND',
    AUDIO_PERMISSION_DENIED: 'AUDIO_PERMISSION_DENIED',
    AUDIO_NOT_SUPPORTED: 'AUDIO_NOT_SUPPORTED',
    AUDIO_INITIALIZATION_FAILED: 'AUDIO_INITIALIZATION_FAILED',
    AUDIO_RECORDING_FAILED: 'AUDIO_RECORDING_FAILED',
    AUDIO_STOP_FAILED: 'AUDIO_STOP_FAILED',
    AUDIO_CONVERSION_FAILED: 'AUDIO_CONVERSION_FAILED',

    // WebSocket related errors
    WEBSOCKET_CONNECTION_FAILED: 'WEBSOCKET_CONNECTION_FAILED',
    WEBSOCKET_MESSAGE_FAILED: 'WEBSOCKET_MESSAGE_FAILED',
    WEBSOCKET_CLOSE_FAILED: 'WEBSOCKET_CLOSE_FAILED',

    // API related errors
    API_AUTHENTICATION_FAILED: 'API_AUTHENTICATION_FAILED',
    API_REQUEST_FAILED: 'API_REQUEST_FAILED',
    API_RESPONSE_INVALID: 'API_RESPONSE_INVALID',

    // General errors
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    INVALID_STATE: 'INVALID_STATE',
    INVALID_PARAMETER: 'INVALID_PARAMETER',

    // Video related errors
    VIDEO_DEVICE_NOT_FOUND: 'VIDEO_DEVICE_NOT_FOUND',
    VIDEO_PERMISSION_DENIED: 'VIDEO_PERMISSION_DENIED',
    VIDEO_NOT_SUPPORTED: 'VIDEO_NOT_SUPPORTED',
    VIDEO_CODEC_NOT_SUPPORTED: 'VIDEO_CODEC_NOT_SUPPORTED',
    VIDEO_START_FAILED: 'VIDEO_START_FAILED',
    VIDEO_STOP_FAILED: 'VIDEO_STOP_FAILED',

    // Screen sharing related errors
    SCREEN_DEVICE_NOT_FOUND: 'SCREEN_DEVICE_NOT_FOUND',
    SCREEN_PERMISSION_DENIED: 'SCREEN_PERMISSION_DENIED',
    SCREEN_NOT_SUPPORTED: 'SCREEN_NOT_SUPPORTED',
    SCREEN_START_FAILED: 'SCREEN_START_FAILED',
    SCREEN_STOP_FAILED: 'SCREEN_STOP_FAILED',
};

/**
 * Custom error class for application-specific errors.
 * Extends the built-in Error class and adds properties for error code, details, and timestamp.
 */
export class ApplicationError extends Error {
    /**
     * Creates a new ApplicationError.
     *
     * @param {string} message - The error message.
     * @param {string} [code=ErrorCodes.UNKNOWN_ERROR] - The error code.
     * @param {Object} [details={}] - Additional details about the error.
     */
    constructor(message, code = ErrorCodes.UNKNOWN_ERROR, details = {}) {
        super(message);
        this.name = 'ApplicationError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Ensure proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApplicationError);
        }
    }

    /**
     * Converts the error object to a JSON representation.
     *
     * @returns {Object} The JSON representation of the error.
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
} 