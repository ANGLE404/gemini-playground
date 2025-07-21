import { registeredWorklets } from '../core/worklet-registry.js';
import { CONFIG } from '../config/config.js';

/**
 * @class AudioStreamer
 * @description Manages the playback of audio data, including support for queuing, scheduling, and applying audio effects through worklets.
 */
export class AudioStreamer {
    /**
     * @constructor
     * @param {AudioContext} context - The AudioContext instance to use for audio processing.
     */
    constructor(context) {
        this.context = context;
        this.audioQueue = [];
        this.isPlaying = false;
        this.sampleRate = CONFIG.AUDIO.OUTPUT_SAMPLE_RATE;
        this.bufferSize = 7680;
        this.processingBuffer = new Float32Array(0);
        this.scheduledTime = 0;
        this.gainNode = this.context.createGain();
        this.source = this.context.createBufferSource();
        this.isStreamComplete = false;
        this.checkInterval = null;
        this.initialBufferTime = 0.1;
        this.endOfQueueAudioSource = null;
        this.onComplete = () => { };
        this.gainNode.connect(this.context.destination);
        this.addPCM16 = this.addPCM16.bind(this);
    }

    /**
     * @method addWorklet
     * @description Adds an audio worklet to the processing pipeline.
     * @param {string} workletName - The name of the worklet.
     * @param {string} workletSrc - The source URL of the worklet script.
     * @param {Function} handler - The message handler function for the worklet.
     * @returns {Promise<AudioStreamer>} A promise that resolves with the AudioStreamer instance when the worklet is added.
     * @async
     */
    async addWorklet(workletName, workletSrc, handler) {
        let workletsRecord = registeredWorklets.get(this.context);
        if (workletsRecord && workletsRecord[workletName]) {
            workletsRecord[workletName].handlers.push(handler);
            return Promise.resolve(this);
        }

        if (!workletsRecord) {
            registeredWorklets.set(this.context, {});
            workletsRecord = registeredWorklets.get(this.context);
        }

        workletsRecord[workletName] = { handlers: [handler] };

        try {
            const absolutePath = `/${workletSrc}`;
            await this.context.audioWorklet.addModule(absolutePath);
        } catch (error) {
            console.error('Error loading worklet:', error);
            throw error;
        }
        const worklet = new AudioWorkletNode(this.context, workletName);

        workletsRecord[workletName].node = worklet;

        return this;
    }

    /**
     * @method addPCM16
     * @description Adds a chunk of PCM16 audio data to the streaming queue.
     * @param {Int16Array} chunk - The audio data chunk.
     */
    addPCM16(chunk) {
        const float32Array = new Float32Array(chunk.length / 2);
        const dataView = new DataView(chunk.buffer);

        for (let i = 0; i < chunk.length / 2; i++) {
            try {
                const int16 = dataView.getInt16(i * 2, true);
                float32Array[i] = int16 / 32768;
            } catch (e) {
                console.error(e);
            }
        }

        const newBuffer = new Float32Array(this.processingBuffer.length + float32Array.length);
        newBuffer.set(this.processingBuffer);
        newBuffer.set(float32Array, this.processingBuffer.length);
        this.processingBuffer = newBuffer;

        while (this.processingBuffer.length >= this.bufferSize) {
            const buffer = this.processingBuffer.slice(0, this.bufferSize);
            this.audioQueue.push(buffer);
            this.processingBuffer = this.processingBuffer.slice(this.bufferSize);
        }

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.scheduledTime = this.context.currentTime + this.initialBufferTime;
            this.scheduleNextBuffer();
        }
    }

    /**
     * @method createAudioBuffer
     * @description Creates an AudioBuffer from the given audio data.
     * @param {Float32Array} audioData - The audio data.
     * @returns {AudioBuffer} The created AudioBuffer.
     */
    createAudioBuffer(audioData) {
        const audioBuffer = this.context.createBuffer(1, audioData.length, this.sampleRate);
        audioBuffer.getChannelData(0).set(audioData);
        return audioBuffer;
    }

    /**
     * @method scheduleNextBuffer
     * @description Schedules the next audio buffer for playback.
     */
    scheduleNextBuffer() {
        const SCHEDULE_AHEAD_TIME = 0.2;

        while (this.audioQueue.length > 0 && this.scheduledTime < this.context.currentTime + SCHEDULE_AHEAD_TIME) {
            const audioData = this.audioQueue.shift();
            const audioBuffer = this.createAudioBuffer(audioData);
            const source = this.context.createBufferSource();

            if (this.audioQueue.length === 0) {
                if (this.endOfQueueAudioSource) {
                    this.endOfQueueAudioSource.onended = null;
                }
                this.endOfQueueAudioSource = source;
                source.onended = () => {
                    if (!this.audioQueue.length && this.endOfQueueAudioSource === source) {
                        this.endOfQueueAudioSource = null;
                        this.onComplete();
                    }
                };
            }

            source.buffer = audioBuffer;
            source.connect(this.gainNode);

            const worklets = registeredWorklets.get(this.context);

            if (worklets) {
                Object.entries(worklets).forEach(([workletName, graph]) => {
                    const { node, handlers } = graph;
                    if (node) {
                        source.connect(node);
                        node.port.onmessage = function (ev) {
                            handlers.forEach((handler) => {
                                handler.call(node.port, ev);
                            });
                        };
                        node.connect(this.context.destination);
                    }
                });
            }

            const startTime = Math.max(this.scheduledTime, this.context.currentTime);
            source.start(startTime);

            this.scheduledTime = startTime + audioBuffer.duration;
        }

        if (this.audioQueue.length === 0 && this.processingBuffer.length === 0) {
            if (this.isStreamComplete) {
                this.isPlaying = false;
                if (this.checkInterval) {
                    clearInterval(this.checkInterval);
                    this.checkInterval = null;
                }
            } else {
                if (!this.checkInterval) {
                    this.checkInterval = window.setInterval(() => {
                        if (this.audioQueue.length > 0 || this.processingBuffer.length >= this.bufferSize) {
                            this.scheduleNextBuffer();
                        }
                    }, 100);
                }
            }
        } else {
            const nextCheckTime = (this.scheduledTime - this.context.currentTime) * 1000;
            setTimeout(() => this.scheduleNextBuffer(), Math.max(0, nextCheckTime - 50));
        }
    }

    /**
     * @method stop
     * @description Stops the audio stream.
     */
    stop() {
        this.isPlaying = false;
        this.isStreamComplete = true;
        this.audioQueue = [];
        this.processingBuffer = new Float32Array(0);
        this.scheduledTime = this.context.currentTime;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.1);

        setTimeout(() => {
            this.gainNode.disconnect();
            this.gainNode = this.context.createGain();
            this.gainNode.connect(this.context.destination);
        }, 200);
    }

    /**
     * @method resume
     * @description Resumes the audio stream if the AudioContext was suspended.
     * @async
     */
    async resume() {
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
        this.isStreamComplete = false;
        this.scheduledTime = this.context.currentTime + this.initialBufferTime;
        this.gainNode.gain.setValueAtTime(1, this.context.currentTime);
    }

    /**
     * @method complete
     * @description Marks the audio stream as complete and schedules any remaining data in the buffer.
     */
    complete() {
        this.isStreamComplete = true;
        if (this.processingBuffer.length > 0) {
            this.audioQueue.push(this.processingBuffer);
            this.processingBuffer = new Float32Array(0);
            if (this.isPlaying) {
                this.scheduleNextBuffer();
            }
        } else {
            this.onComplete();
        }
    }
} 