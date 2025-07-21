/**
 * @class AudioProcessingWorklet
 * @extends AudioWorkletProcessor
 * @description Processes incoming audio data, converting it from Float32 to Int16 format and packaging it into chunks.
 */
class AudioProcessingWorklet extends AudioWorkletProcessor {
    /**
     * @constructor
     * @description Initializes the buffer for audio processing.
     */
    constructor() {
        super();
        this.buffer = new Int16Array(2048);
        this.bufferWriteIndex = 0;
    }

    /**
     * @method process
     * @description Processes the audio input data.
     * @param {Float32Array[][]} inputs - The input audio data.
     * @returns {boolean} True to keep the worklet alive.
     */
    process(inputs) {
        if (inputs[0].length) {
            const channel0 = inputs[0][0];
            this.processChunk(channel0);
        }
        return true;
    }

    /**
     * @method sendAndClearBuffer
     * @description Sends the current buffer content as a message and resets the buffer.
     */
    sendAndClearBuffer() {
        this.port.postMessage({
            event: 'chunk',
            data: {
                int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
            },
        });
        this.bufferWriteIndex = 0;
    }

    /**
     * @method processChunk
     * @description Processes a chunk of audio data, converting it to Int16 format.
     * @param {Float32Array} float32Array - The audio data chunk to process.
     */
    processChunk(float32Array) {
        try {
            const l = float32Array.length;

            for (let i = 0; i < l; i++) {
                const int16Value = Math.max(-32768, Math.min(32767, Math.floor(float32Array[i] * 32768)));
                this.buffer[this.bufferWriteIndex++] = int16Value;
                if (this.bufferWriteIndex >= this.buffer.length) {
                    this.sendAndClearBuffer();
                }
            }

            if (this.bufferWriteIndex >= this.buffer.length) {
                this.sendAndClearBuffer();
            }
        } catch (error) {
            this.port.postMessage({
                event: 'error',
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });
        }
    }
}

registerProcessor('audio-recorder-worklet', AudioProcessingWorklet); 