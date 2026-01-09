// オーディオ再生クラス
class AudioPlayer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.originalSourceNode = null;
        this.processedSourceNode = null;
        this.originalGainNode = null;
        this.processedGainNode = null;
        this.originalAnalyserNode = null;
        this.processedAnalyserNode = null;
        this.startTime = null;
        this.isPlaying = false;
        
        // ミュート状態
        this.originalMuted = true; // 初期状態では無効
        this.processedMuted = false; // 初期状態では有効
        
        // レベルメータ用のデータ配列
        this.originalLevels = null;
        this.processedLevels = null;
    }

    // 元波形と加工後のバッファを同時に再生
    // originalBuffer: 元波形のバッファ（利用範囲を抽出済み）
    // processedBuffer: 加工後のバッファ
    // offsetSeconds: 再生開始位置（秒）- 加工後のバッファの位置
    playPreview(originalBuffer, processedBuffer, offsetSeconds = 0) {
        if (!processedBuffer || this.isPlaying) return false;
        // originalBufferはnullでもOK（元波形がミュートの場合）

        try {
            // 加工後のバッファのオフセットを範囲に収める
            let offset = processedBuffer ? (offsetSeconds % processedBuffer.duration) : 0;
            if (offset < 0) {
                offset += processedBuffer.duration;
            }
            
            // 再生開始時刻を決定
            const startAt = this.audioContext.currentTime;
            
            // 元波形を再生（ミュート状態に応じてボリュームを制御）
            if (originalBuffer) {
                const originalSource = this.audioContext.createBufferSource();
                originalSource.buffer = originalBuffer;
                originalSource.loop = true;
                originalSource.loopStart = 0;
                originalSource.loopEnd = originalBuffer.duration;
                
                // GainNodeでボリューム制御（常に作成する）
                this.originalGainNode = this.audioContext.createGain();
                this.originalGainNode.gain.value = this.originalMuted ? 0 : 1;
                
                // AnalyserNodeでレベルメータ用のデータを取得
                this.originalAnalyserNode = this.audioContext.createAnalyser();
                this.originalAnalyserNode.fftSize = 256;
                this.originalLevels = new Uint8Array(this.originalAnalyserNode.frequencyBinCount);
                
                originalSource.connect(this.originalGainNode);
                this.originalGainNode.connect(this.originalAnalyserNode);
                this.originalAnalyserNode.connect(this.audioContext.destination);
                
                this.originalSourceNode = originalSource;
                
                // 元波形の再生開始（加工後の波形と同期）
                // 元波形の対応する位置を計算
                const originalOffset = originalBuffer.duration > 0 ? (offset * originalBuffer.duration / processedBuffer.duration) % originalBuffer.duration : 0;
                originalSource.start(startAt, originalOffset);
            }
            
            // 加工後のバッファを再生
            const processedSource = this.audioContext.createBufferSource();
            processedSource.buffer = processedBuffer;
            processedSource.loop = true;
            processedSource.loopStart = 0;
            processedSource.loopEnd = processedBuffer.duration;
            
            // GainNodeでボリューム制御
            this.processedGainNode = this.audioContext.createGain();
            this.processedGainNode.gain.value = this.processedMuted ? 0 : 1;
            
            // AnalyserNodeでレベルメータ用のデータを取得
            this.processedAnalyserNode = this.audioContext.createAnalyser();
            this.processedAnalyserNode.fftSize = 256;
            this.processedLevels = new Uint8Array(this.processedAnalyserNode.frequencyBinCount);
            
            processedSource.connect(this.processedGainNode);
            this.processedGainNode.connect(this.processedAnalyserNode);
            this.processedAnalyserNode.connect(this.audioContext.destination);
            
            this.processedSourceNode = processedSource;
            
            // 再生開始
            processedSource.start(startAt, offset);
            
            // 再生位置計算用の基準時刻（加工後のバッファ基準）
            this.startTime = startAt - offset;
            this.isPlaying = true;
            return true;
        } catch (error) {
            console.error('再生エラー:', error);
            this.isPlaying = false;
            throw error;
        }
    }

    stopPreview() {
        if (this.originalSourceNode) {
            try {
                this.originalSourceNode.stop();
                this.originalSourceNode.disconnect();
            } catch (e) {
                // 既に停止している場合など
            }
            this.originalSourceNode = null;
        }
        if (this.processedSourceNode) {
            try {
                this.processedSourceNode.stop();
                this.processedSourceNode.disconnect();
            } catch (e) {
                // 既に停止している場合など
            }
            this.processedSourceNode = null;
        }
        if (this.originalGainNode) {
            this.originalGainNode.disconnect();
            this.originalGainNode = null;
        }
        if (this.processedGainNode) {
            this.processedGainNode.disconnect();
            this.processedGainNode = null;
        }
        if (this.originalAnalyserNode) {
            this.originalAnalyserNode.disconnect();
            this.originalAnalyserNode = null;
        }
        if (this.processedAnalyserNode) {
            this.processedAnalyserNode.disconnect();
            this.processedAnalyserNode = null;
        }
        this.startTime = null;
        this.isPlaying = false;
        this.originalLevels = null;
        this.processedLevels = null;
    }

    // 元波形のミュート状態を切り替え
    setOriginalMuted(muted) {
        this.originalMuted = muted;
        if (this.originalGainNode) {
            this.originalGainNode.gain.value = muted ? 0 : 1;
        }
    }

    // 加工後の波形のミュート状態を切り替え
    setProcessedMuted(muted) {
        this.processedMuted = muted;
        if (this.processedGainNode) {
            this.processedGainNode.gain.value = muted ? 0 : 1;
        }
    }

    // レベルメータのデータを取得（元波形）
    getOriginalLevels() {
        if (!this.originalAnalyserNode || !this.originalLevels) {
            return null;
        }
        this.originalAnalyserNode.getByteFrequencyData(this.originalLevels);
        return this.originalLevels;
    }

    // レベルメータのデータを取得（加工後の波形）
    getProcessedLevels() {
        if (!this.processedAnalyserNode || !this.processedLevels) {
            return null;
        }
        this.processedAnalyserNode.getByteFrequencyData(this.processedLevels);
        return this.processedLevels;
    }

    getCurrentPlaybackTime() {
        if (!this.isPlaying || this.startTime === null || !this.processedSourceNode || !this.processedSourceNode.buffer) {
            return null;
        }
        const elapsed = this.audioContext.currentTime - this.startTime;
        return elapsed % this.processedSourceNode.buffer.duration;
    }
}
