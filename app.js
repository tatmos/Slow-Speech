// Slow Speech - 音声リサンプリングツール
class SlowSpeech {
    constructor() {
        this.audioContext = null;
        this.originalBuffer = null; // 元波形のバッファ
        this.processedBuffer = null; // 加工後のバッファ
        this.audioProcessor = null;
        this.audioPlayer = null;
        this.waveformRenderer = null;
        this.originalWaveformViewer = null;
        this.animationFrameId = null;
        this.useRangeStart = 0; // 利用範囲の開始位置
        this.useRangeEnd = 0; // 利用範囲の終了位置
        
        this.initializeElements();
        this.uiController = new UIController(this);
    }

    initializeElements() {
        const originalCanvas = document.getElementById('original-waveform');
        const originalRuler = document.getElementById('ruler-original');
        const processedCanvas = document.getElementById('processed-waveform');
        const processedRuler = document.getElementById('ruler-processed');
        
        this.originalWaveformViewer = new OriginalWaveformViewer(originalCanvas, originalRuler);
        this.originalWaveformViewer.onRangeChange = (startTime, endTime) => {
            this.useRangeStart = startTime;
            this.useRangeEnd = endTime;
            this.updateBuffers();
            this.drawWaveforms();
        };
        
        this.waveformRenderer = new WaveformRenderer(processedCanvas, processedRuler);
    }

    updateBuffers() {
        if (!this.originalBuffer || !this.audioProcessor) return;
        
        // 再生中の場合、現在の再生位置を保持
        const wasPlaying = this.audioPlayer && this.audioPlayer.isPlaying;
        let currentPlaybackTime = null;
        if (wasPlaying) {
            currentPlaybackTime = this.audioPlayer.getCurrentPlaybackTime();
        }
        
        // 元波形から利用範囲を抽出
        const useRangeBuffer = this.audioProcessor.extractRange(
            this.originalBuffer,
            this.useRangeStart,
            this.useRangeEnd
        );
        
        // TODO: ここでリサンプリング処理を実装する
        // 今は元波形をそのまま使用
        this.processedBuffer = useRangeBuffer;
        
        // 再生中だった場合、新しいバッファで再生を再開
        if (wasPlaying && this.audioPlayer && this.processedBuffer) {
            let seekTime = currentPlaybackTime !== null ? currentPlaybackTime : 0;
            seekTime = Math.max(0, Math.min(this.processedBuffer.duration, seekTime));
            this.audioPlayer.stopPreview();
            this.audioPlayer.playPreview(this.processedBuffer, seekTime);
        }
    }

    // 波形上クリックによるシーク
    seekTo(timeInSeconds) {
        if (!this.audioPlayer || !this.processedBuffer) return;

        const duration = this.processedBuffer.duration;
        if (duration <= 0) return;

        // 範囲内にクリップ
        let targetTime = Math.max(0, Math.min(duration, timeInSeconds));

        // 再生中のみシーク
        if (this.audioPlayer.isPlaying) {
            this.audioPlayer.stopPreview();
            this.audioPlayer.playPreview(this.processedBuffer, targetTime);
        }
    }
    
    drawWaveforms() {
        if (!this.processedBuffer || !this.waveformRenderer) return;
        
        const currentTime = this.audioPlayer ? this.audioPlayer.getCurrentPlaybackTime() : null;
        this.waveformRenderer.render(this.processedBuffer, currentTime);
    }

    startPlaybackAnimation() {
        const animate = () => {
            if (this.audioPlayer && this.audioPlayer.isPlaying) {
                this.drawWaveforms();
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.animationFrameId = null;
            }
        };
        if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(animate);
        }
    }

    stopPlaybackAnimation() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // 再生位置ラインを消すために再描画
        this.drawWaveforms();
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new SlowSpeech();
});
