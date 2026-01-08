// オーディオ再生クラス
class AudioPlayer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sourceNode = null;
        this.startTime = null;
        this.isPlaying = false;
    }

    // 加工後のバッファを再生
    // offsetSeconds: 再生開始位置（秒）
    playPreview(audioBuffer, offsetSeconds = 0) {
        if (!audioBuffer || this.isPlaying) return false;

        try {
            // オフセットをバッファ長の範囲に収める
            let offset = offsetSeconds % audioBuffer.duration;
            if (offset < 0) {
                offset += audioBuffer.duration;
            }
            
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true; // ループ再生を有効化
            source.loopStart = 0;
            source.loopEnd = audioBuffer.duration;
            source.connect(this.audioContext.destination);
            
            this.sourceNode = source;
            
            // 再生開始
            const startAt = this.audioContext.currentTime;
            source.start(startAt, offset);
            
            // 再生位置計算用の基準時刻
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
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
                this.sourceNode.disconnect();
            } catch (e) {
                // 既に停止している場合など
            }
        }
        this.sourceNode = null;
        this.startTime = null;
        this.isPlaying = false;
    }

    getCurrentPlaybackTime() {
        if (!this.isPlaying || this.startTime === null || !this.sourceNode || !this.sourceNode.buffer) {
            return null;
        }
        const elapsed = this.audioContext.currentTime - this.startTime;
        return elapsed % this.sourceNode.buffer.duration;
    }
}
