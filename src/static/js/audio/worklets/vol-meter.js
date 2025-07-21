/**
 * @class VUMeterProcessor
 * @extends AudioWorkletProcessor
 * @description Calculates and outputs the volume level (RMS) of an audio stream at regular intervals.
 */
class VUMeterProcessor extends AudioWorkletProcessor {
    /**
     * @constructor
     * @description Initializes the volume meter with default settings.
     */
    constructor() {
        super();
        this._volume = 0;
        this._updateIntervalInMS = 25;
        this._nextUpdateFrame = this._updateIntervalInMS;
        this._updateIntervalInFrames = this._updateIntervalInMS / 1000 * sampleRate;
    }

    /**
     * @method intervalInFrames
     * @returns {number} The update interval in frames.
     */
    get intervalInFrames() {
        return this._updateIntervalInFrames;
    }

    /**
     * @method process
     * @description Processes the audio input data and calculates the volume level.
     * @param {Float32Array[][]} inputs - The input audio data.
     * @param {Float32Array[][]} outputs - The output audio data.
     * @returns {boolean} True to keep the worklet alive.
     */
    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];

        // If there's no input, just output silence and continue processing
        if (!input || !input.length) return true;

        // Calculate the square sum
        let sum = 0;
        for (const channel of input) {
            for (const sample of channel) {
                sum += sample * sample;
            }
        }

        // Calculate the RMS and update the volume
        const rms = Math.sqrt(sum / (input.length * input[0].length));
        this._volume = Math.max(rms, this._volume * 0.95);

        this._nextUpdateFrame -= input[0].length;
        if (this._nextUpdateFrame < 0) {
            this._nextUpdateFrame += this._updateIntervalInFrames;
            this.port.postMessage({ volume: this._volume });
        }

        // Copy input to output
        for (let channel = 0; channel < output.length; ++channel) {
            output[channel].set(input[channel]);
        }

        return true;
    }
}

registerProcessor('vumeter-out', VUMeterProcessor); 