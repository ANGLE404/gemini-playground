import { Logger } from '../utils/logger.js';
import { ApplicationError, ErrorCodes } from '../utils/error-boundary.js';

/**
 * @fileoverview Implements a video recorder for capturing and processing video frames from a camera.
 * It supports previewing the video and sending frames to a callback function.
 */
export class VideoRecorder {
    /**
     * Creates a new VideoRecorder instance.
     * @param {Object} [options] - Configuration options for the recorder.
     * @param {number} [options.fps=15] - Frames per second for video capture.
     * @param {number} [options.quality=0.7] - JPEG quality for captured frames (0.0 - 1.0).
     * @param {number} [options.width=640] - Width of the captured video.
     * @param {number} [options.height=480] - Height of the captured video.
     * @param {number} [options.maxFrameSize=102400] - Maximum size of a frame in bytes (100KB).
     */
    constructor(options = {}) {
        this.stream = null;
        this.previewElement = null;
        this.isRecording = false;
        this.onVideoData = null;
        this.frameCanvas = document.createElement('canvas');
        this.frameCtx = this.frameCanvas.getContext('2d');
        this.captureInterval = null;
        this.options = {
            fps: options.fps || 1, // 使用传入的fps,默认为1
            quality: 0.6,
            width: 640,
            height: 480,
            maxFrameSize: 100 * 1024, // 100KB max per frame
            ...options
        };
        this.frameCount = 0; // Add frame counter for debugging
        this.actualWidth = 640;
        this.actualHeight = 480;
        console.log(this.options);  
    }

    /**
     * Starts video recording.
     * @param {HTMLVideoElement} previewElement - The video element to display the video preview.
     * @param {Function} onVideoData - Callback function to receive video frame data.
     * @throws {ApplicationError} Throws an error if the video recording fails to start.
     */
    async start(previewElement, facingMode, onVideoData, ) {
        try {
            this.previewElement = previewElement;
            this.onVideoData = onVideoData;

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    facingMode: facingMode,
                    width: { ideal: this.options.width },
                    height: { ideal: this.options.height }
                }
            });

            const videoTrack = this.stream.getVideoTracks()[0];
            // 获取视频轨道的实际分辨率
            const settings = videoTrack.getSettings();
            this.actualWidth = settings.width;
            this.actualHeight = settings.height;

            // 计算保持宽高比的情况下，限制高度最大为480的
            if (this.actualHeight > 480) {
                const aspectRatio = this.actualWidth / this.actualHeight;
                this.actualHeight = 480;
                this.actualWidth = Math.round(this.actualHeight * aspectRatio);
            }

            // 设置画布尺寸
            this.frameCanvas.width = this.actualWidth;
            this.frameCanvas.height = this.actualHeight;

            // Set up preview
            this.previewElement.srcObject = this.stream;
            await this.previewElement.play();

            // Start frame capture loop
            this.isRecording = true;
            this.startFrameCapture();
            
            Logger.info('Video recording started');

        } catch (error) {
            Logger.error('Failed to start video recording:', error);
            throw new ApplicationError(
                'Failed to start video recording',
                ErrorCodes.VIDEO_START_FAILED,
                { originalError: error }
            );
        }
    }

    /**
     * Starts the frame capture loop.
     * @private
     */
    startFrameCapture() {
        const frameInterval = 1000 / this.options.fps;
        
        this.captureInterval = setInterval(() => {
            if (this.isRecording && this.onVideoData) {
                try {
                    // Draw current video frame to canvas
                    this.frameCtx.drawImage(
                        this.previewElement,
                        0, 0,
                        this.frameCanvas.width,
                        this.frameCanvas.height
                    );
  
                    // Convert to JPEG
                    const jpegData = this.frameCanvas.toDataURL('image/jpeg', this.options.quality);
                    // Remove data URL prefix
                    const base64Data = jpegData.split(',')[1];
                    
                    if (!this.validateFrame(base64Data)) {
                        return;
                    }

                    this.frameCount++;
                    //const size = Math.round(base64Data.length / 1024);
                    //Logger.debug(`Frame #${this.frameCount} captured (${size}KB)`);
                    
                    if (!base64Data) {
                        Logger.error('Empty frame data');
                        return;
                    }

                    this.onVideoData(base64Data);
                } catch (error) {
                    Logger.error('Frame capture error:', error);
                }
            }
        }, frameInterval);

        Logger.info(`Video capture started at ${this.options.fps} FPS`);
    }

    /**
     * Stops video recording.
     * @throws {ApplicationError} Throws an error if the video recording fails to stop.
     */
    stop() {
        try {
            this.isRecording = false;
            
            if (this.captureInterval) {
                clearInterval(this.captureInterval);
                this.captureInterval = null;
            }

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            if (this.previewElement) {
                this.previewElement.srcObject = null;
            }

            this.stream = null;
            Logger.info('Video recording stopped');

        } catch (error) {
            Logger.error('Failed to stop video recording:', error);
            throw new ApplicationError(
                'Failed to stop video recording',
                ErrorCodes.VIDEO_STOP_FAILED,
                { originalError: error }
            );
        }
    }

    /**
     * Checks if video recording is supported by the browser.
     * @returns {boolean} True if video recording is supported, false otherwise.
     * @throws {ApplicationError} Throws an error if video recording is not supported.
     * @static
     */
    static checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new ApplicationError(
                'Video recording is not supported in this browser',
                ErrorCodes.VIDEO_NOT_SUPPORTED
            );
        }
        return true;
    }

    /**
     * Validates a captured frame.
     * @param {string} base64Data - Base64 encoded frame data.
     * @returns {boolean} True if the frame is valid, false otherwise.
     * @private
     */
    validateFrame(base64Data) {
        // Check if it's a valid base64 string
        if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
            Logger.error('Invalid base64 data');
            return false;
        }
        
        // Check minimum size (1KB)
        if (base64Data.length < 1024) {
            Logger.error('Frame too small');
            return false;
        }
        
        return true;
    }

    /**
     * Optimizes the frame quality to reduce size.
     * @param {string} base64Data - Base64 encoded frame data.
     * @returns {string} Optimized base64 encoded frame data.
     * @private
     */
    async optimizeFrameQuality(base64Data) {
        let quality = this.options.quality;
        let currentSize = base64Data.length;
        
        while (currentSize > this.options.maxFrameSize && quality > 0.3) {
            quality -= 0.1;
            const jpegData = this.frameCanvas.toDataURL('image/jpeg', quality);
            base64Data = jpegData.split(',')[1];
            currentSize = base64Data.length;
        }
        
        return base64Data;
    }
} 