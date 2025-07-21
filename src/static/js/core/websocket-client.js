import { EventEmitter } from 'https://cdn.skypack.dev/eventemitter3';
import { blobToJSON, base64ToArrayBuffer } from '../utils/utils.js';
import { ApplicationError, ErrorCodes } from '../utils/error-boundary.js';
import { Logger } from '../utils/logger.js';
import { ToolManager } from '../tools/tool-manager.js';

/**
 * Client for interacting with the Gemini Multimodal Live API via WebSockets.
 * This class handles the connection, sending and receiving messages, and processing responses.
 * It extends EventEmitter to emit events for various stages of the interaction.
 *
 * @extends EventEmitter
 */
export class MultimodalLiveClient extends EventEmitter {
    /**
     * Creates a new MultimodalLiveClient.
     *
     * @param {Object} options - Configuration options.
     * @param {string} [options.url] - The WebSocket URL for the Gemini API. Defaults to a URL constructed with the provided API key.
     */
    constructor() {
        super();
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.baseUrl  = `${wsProtocol}//${window.location.host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
        this.ws = null;
        this.config = null;
        this.send = this.send.bind(this);
        this.toolManager = new ToolManager();
    }

    /**
     * Logs a message with a timestamp and type. Emits a 'log' event.
     *
     * @param {string} type - The type of the log message (e.g., 'server.send', 'client.close').
     * @param {string|Object} message - The message to log.
     */
    log(type, message) {
        this.emit('log', { date: new Date(), type, message });
    }

    /**
     * Connects to the WebSocket server with the given configuration.
     * The configuration can include model settings, generation config, system instructions, and tools.
     *
     * @param {Object} config - The configuration for the connection.
     * @param {string} config.model - The model to use (e.g., 'gemini-2.0-flash-exp').
     * @param {Object} config.generationConfig - Configuration for content generation.
     * @param {string[]} config.generationConfig.responseModalities - The modalities for the response (e.g., "audio", "text").
     * @param {Object} config.generationConfig.speechConfig - Configuration for speech generation.
     * @param {Object} config.generationConfig.speechConfig.voiceConfig - Configuration for the voice.
     * @param {string} config.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName - The name of the prebuilt voice to use.
     * @param {Object} config.systemInstruction - Instructions for the system.
     * @param {Object[]} config.systemInstruction.parts - Parts of the system instruction.
     * @param {string} config.systemInstruction.parts[].text - Text content of the instruction part.
     * @param {Object[]} [config.tools] - Additional tools to be used by the model.
     * @returns {Promise<boolean>} - Resolves with true when the connection is established.
     * @throws {ApplicationError} - Throws an error if the connection fails.
     */
    connect(config,apiKey) {
        this.config = {
            ...config,
            tools: [
                ...this.toolManager.getToolDeclarations(),
                ...(config.tools || [])
            ]
        };
        const ws = new WebSocket(`${this.baseUrl}?key=${apiKey}`);

        ws.addEventListener('message', async (evt) => {
            if (evt.data instanceof Blob) {
                this.receive(evt.data);
            } else {
                console.log('Non-blob message', evt);
            }
        });

        return new Promise((resolve, reject) => {
            const onError = (ev) => {
                this.disconnect(ws);
                const message = `Could not connect to "${this.baseUrl}"`;
                this.log(`server.${ev.type}`, message);
                throw new ApplicationError(
                    message,
                    ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
                    { originalError: ev }
                );
            };

            ws.addEventListener('error', onError);
            ws.addEventListener('open', (ev) => {
                if (!this.config) {
                    reject('Invalid config sent to `connect(config)`');
                    return;
                }
                this.log(`client.${ev.type}`, 'Connected to socket');
                this.emit('open');

                this.ws = ws;

                const setupMessage = { setup: this.config };
                this._sendDirect(setupMessage);
                this.log('client.send', 'setup');

                ws.removeEventListener('error', onError);
                ws.addEventListener('close', (ev) => {
                    this.disconnect(ws);
                    let reason = ev.reason || '';
                    if (reason.toLowerCase().includes('error')) {
                        const prelude = 'ERROR]';
                        const preludeIndex = reason.indexOf(prelude);
                        if (preludeIndex > 0) {
                            reason = reason.slice(preludeIndex + prelude.length + 1);
                        }
                    }
                    this.log(`server.${ev.type}`, `Disconnected ${reason ? `with reason: ${reason}` : ''}`);
                    this.emit('close', { code: ev.code, reason });
                });
                resolve(true);
            });
        });
    }

    /**
     * Disconnects from the WebSocket server.
     *
     * @param {WebSocket} [ws] - The WebSocket instance to disconnect. If not provided, defaults to the current instance.
     * @returns {boolean} - True if disconnected, false otherwise.
     */
    disconnect(ws) {
        if ((!ws || this.ws === ws) && this.ws) {
            this.ws.close();
            this.ws = null;
            this.log('client.close', 'Disconnected');
            return true;
        }
        return false;
    }

    /**
     * Receives and processes a message from the WebSocket server.
     * Handles different types of responses like tool calls, setup completion, and server content.
     *
     * @param {Blob} blob - The received blob data.
     */
    async receive(blob) {
        const response = await blobToJSON(blob);
        if (response.toolCall) {
            this.log('server.toolCall', response);
            await this.handleToolCall(response.toolCall);
            return;
        }
        if (response.toolCallCancellation) {
            this.log('receive.toolCallCancellation', response);
            this.emit('toolcallcancellation', response.toolCallCancellation);
            return;
        }
        if (response.setupComplete) {
            this.log('server.send', 'setupComplete');
            this.emit('setupcomplete');
            return;
        }
        if (response.serverContent) {
            const { serverContent } = response;
            if (serverContent.interrupted) {
                this.log('receive.serverContent', 'interrupted');
                this.emit('interrupted');
                return;
            }
            if (serverContent.turnComplete) {
                this.log('server.send', 'turnComplete');
                this.emit('turncomplete');
            }
            if (serverContent.modelTurn) {
                let parts = serverContent.modelTurn.parts;
                const audioParts = parts.filter((p) => p.inlineData && p.inlineData.mimeType.startsWith('audio/pcm'));
                const base64s = audioParts.map((p) => p.inlineData?.data);
                const otherParts = parts.filter((p) => !audioParts.includes(p));

                base64s.forEach((b64) => {
                    if (b64) {
                        const data = base64ToArrayBuffer(b64);
                        this.emit('audio', data);
                        //this.log(`server.audio`, `buffer (${data.byteLength})`);
                    }
                });

                if (!otherParts.length) {
                    return;
                }

                parts = otherParts;
                const content = { modelTurn: { parts } };
                this.emit('content', content);
                this.log(`server.content`, response);
            }
        } else {
            console.log('Received unmatched message', response);
        }
    }

    /**
     * Sends real-time input data to the server.
     *
     * @param {Array} chunks - An array of media chunks to send. Each chunk should have a mimeType and data.
     */
    sendRealtimeInput(chunks) {
        let hasAudio = false;
        let hasVideo = false;
        let totalSize = 0;

        for (let i = 0; i < chunks.length; i++) {
            const ch = chunks[i];
            totalSize += ch.data.length;
            if (ch.mimeType.includes('audio')) {
                hasAudio = true;
            }
            if (ch.mimeType.includes('image')) {
                hasVideo = true;
            }
        }

        const message = hasAudio && hasVideo ? 'audio + video' : hasAudio ? 'audio' : hasVideo ? 'video' : 'unknown';
        Logger.debug(`Sending realtime input: ${message} (${Math.round(totalSize/1024)}KB)`);

        const data = { realtimeInput: { mediaChunks: chunks } };
        this._sendDirect(data);
        //this.log(`client.realtimeInput`, message);
    }

    /**
     * Sends a tool response to the server.
     *
     * @param {Object} toolResponse - The tool response to send.
     */
    sendToolResponse(toolResponse) {
        const message = { toolResponse };
        this._sendDirect(message);
        this.log(`client.toolResponse`, message);
    }

    /**
     * Sends a message to the server.
     *
     * @param {string|Object|Array} parts - The message parts to send. Can be a string, an object, or an array of strings/objects.
     * @param {boolean} [turnComplete=true] - Indicates if this message completes the current turn.
     */
    send(parts, turnComplete = true) {
        parts = Array.isArray(parts) ? parts : [parts];
        const formattedParts = parts.map(part => {
            if (typeof part === 'string') {
                return { text: part };
            } else if (typeof part === 'object' && !part.text && !part.inlineData) {
                return { text: JSON.stringify(part) };
            }
            return part;
        });
        const content = { role: 'user', parts: formattedParts };
        const clientContentRequest = { clientContent: { turns: [content], turnComplete } };
        this._sendDirect(clientContentRequest);
        this.log(`client.send`, clientContentRequest);
    }

    /**
     * Sends a message directly to the WebSocket server.
     *
     * @param {Object} request - The request to send.
     * @throws {Error} - Throws an error if the WebSocket is not connected.
     * @private
     */
    _sendDirect(request) {
        if (!this.ws) {
            throw new Error('WebSocket is not connected');
        }
        const str = JSON.stringify(request);
        this.ws.send(str);
    }

    /**
     * Handles a tool call from the server.
     *
     * @param {Object} toolCall - The tool call data.
     */
    async handleToolCall(toolCall) {
        try {
            const response = await this.toolManager.handleToolCall(toolCall.functionCalls[0]);
            this.sendToolResponse(response);
        } catch (error) {
            Logger.error('Tool call failed', error);
            this.sendToolResponse({
                functionResponses: [{
                    response: { error: error.message },
                    id: toolCall.functionCalls[0].id
                }]
            });
        }
    }
} 