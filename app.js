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
        this.playbackRate = 0.7; // 再生レート（初期値0.7倍速）
        this.resampleAlgorithm = 'simple'; // リサンプリングアルゴリズム（初期値：シンプルにリサンプル）
        this.currentAlgorithm = null; // 現在のアルゴリズムインスタンス
        this.originalDuration = 0; // 元の利用範囲の長さ（秒）
        this.rateHistory = null; // 再生レート履歴
        
        this.initializeElements();
        this.uiController = new UIController(this);
    }

    initializeElements() {
        const originalCanvas = document.getElementById('original-waveform');
        const originalRuler = document.getElementById('ruler-original');
        const processedCanvas = document.getElementById('processed-waveform');
        const processedRuler = document.getElementById('ruler-processed');
        
        this.originalWaveformViewer = new OriginalWaveformViewer(originalCanvas, originalRuler);
        this.originalWaveformViewer.onRangeChange = async (startTime, endTime) => {
            this.useRangeStart = startTime;
            this.useRangeEnd = endTime;
            await this.updateBuffers();
            this.drawWaveforms();
        };
        
        this.waveformRenderer = new WaveformRenderer(processedCanvas, processedRuler);
    }

    async updateBuffers() {
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
        
        // 元の利用範囲の長さを保存
        this.originalDuration = useRangeBuffer.duration;
        
        // アルゴリズムインスタンスを取得または作成
        if (!this.currentAlgorithm) {
            this.currentAlgorithm = ResampleAlgorithmFactory.create(this.resampleAlgorithm, this.audioContext);
        }
        
        // リサンプリング処理
        this.processedBuffer = await this.currentAlgorithm.process(useRangeBuffer, this.playbackRate);
        
        // 再生レート履歴を保存
        if (this.currentAlgorithm && typeof this.currentAlgorithm.getRateHistory === 'function') {
            this.rateHistory = this.currentAlgorithm.getRateHistory();
        } else {
            this.rateHistory = null;
        }
        
        // デバッグ用：リサンプリング後のバッファの長さを確認
        if (this.processedBuffer) {
            console.log('元の利用範囲の長さ:', useRangeBuffer.duration, '秒');
            console.log('リサンプリング後の長さ:', this.processedBuffer.duration, '秒');
            console.log('再生レート:', this.playbackRate);
            console.log('アルゴリズム:', this.currentAlgorithm.getName());
        }
        
        // 再生中だった場合、新しいバッファで再生を再開
        if (wasPlaying && this.audioPlayer && this.processedBuffer) {
            let seekTime = currentPlaybackTime !== null ? currentPlaybackTime : 0;
            seekTime = Math.max(0, Math.min(this.processedBuffer.duration, seekTime));
            // 元波形から利用範囲を抽出（再生用）
            const useRangeBuffer = this.audioProcessor.extractRange(
                this.originalBuffer,
                this.useRangeStart,
                this.useRangeEnd
            );
            this.audioPlayer.stopPreview();
            this.audioPlayer.playPreview(useRangeBuffer, this.processedBuffer, seekTime);
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
            // 元波形から利用範囲を抽出（再生用）
            const useRangeBuffer = this.audioProcessor.extractRange(
                this.originalBuffer,
                this.useRangeStart,
                this.useRangeEnd
            );
            this.audioPlayer.stopPreview();
            this.audioPlayer.playPreview(useRangeBuffer, this.processedBuffer, targetTime);
        }
    }
    
    drawWaveforms() {
        if (!this.processedBuffer || !this.waveformRenderer) return;
        
        const currentTime = this.audioPlayer ? this.audioPlayer.getCurrentPlaybackTime() : null;
        this.waveformRenderer.render(this.processedBuffer, currentTime, this.originalDuration, this.rateHistory);
        
        // 元波形の再生位置を表示（ミュートでない場合のみ）
        if (this.originalWaveformViewer && this.audioPlayer) {
            // 元波形がミュートでない場合のみ再生位置を表示
            if (!this.audioPlayer.originalMuted && this.audioPlayer.isPlaying) {
                const originalTime = this.audioPlayer.getOriginalPlaybackTime();
                if (originalTime !== null) {
                    // 元波形全体のバッファでの位置を計算（利用範囲を考慮）
                    const originalTimeInFullBuffer = this.useRangeStart + originalTime;
                    this.originalWaveformViewer.render(originalTimeInFullBuffer);
                } else {
                    this.originalWaveformViewer.render(null);
                }
            } else {
                this.originalWaveformViewer.render(null);
            }
        }
    }

    startPlaybackAnimation() {
        const animate = () => {
            if (this.audioPlayer && this.audioPlayer.isPlaying) {
                this.drawWaveforms();
                // レベルメータを更新
                if (this.uiController) {
                    this.uiController.updateLevelMeters();
                }
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.animationFrameId = null;
                // 再生が停止したらレベルメータをリセット
                if (this.uiController) {
                    this.uiController.updateLevelMeters();
                }
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
