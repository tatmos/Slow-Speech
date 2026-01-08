// LoopMaker - ループ波形エディタ
class LoopMaker {
    constructor() {
        this.audioContext = null;
        this.originalBuffer = null; // 元波形のバッファ
        this.track1Buffer = null; // トラック1の加工後のバッファ
        this.track2Buffer = null; // トラック2の加工後のバッファ
        this.mixedBuffer = null; // トラック1と2をミックスしたバッファ
        this.audioProcessor = null;
        this.audioPlayer = null;
        this.waveformRenderer = null;
        this.originalWaveformViewer = null;
        this.loopAlgorithm = 'overlap'; // 'overlap' or 'tail'
        this.overlapRate = 0; // オーバーラップ率（0-50%）
        this.tailTime = 0; // テール時間（秒）
        this.animationFrameId = null;
        this.useRangeStart = 0; // 利用範囲の開始位置
        this.useRangeEnd = 0; // 利用範囲の終了位置
        // フェードカーブ設定（デフォルトはログフェード）
        this.fadeSettingsTrack1 = {
            mode: 'log',
            controlX: 0.25,
            controlY: 0.1
        };
        this.fadeSettingsTrack2 = {
            mode: 'log',
            controlX: 0.9,  // フェードアウトのアンカー初期位置（右側：遅くフェードアウト）
            controlY: 0.9
        };
        
        this.initializeElements();
        this.uiController = new UIController(this);
        this.overlapRateController = new OverlapRateController(this);
        this.tailTimeController = new TailTimeController(this);
        this.setupAlgorithmSelector();
        // 初期状態ではオーバーラップ率UIを表示
        this.updateAlgorithmUI();
        // アルゴリズムインスタンスを初期化
        this.initAlgorithm();
    }

    initAlgorithm() {
        // audioProcessorが初期化されていない場合はスキップ
        if (!this.audioProcessor) return;
        
        // 現在のアルゴリズムに応じてインスタンスを作成
        if (this.loopAlgorithm === 'overlap') {
            this.currentAlgorithm = new OverlapRateAlgorithm(this.audioProcessor);
        } else {
            this.currentAlgorithm = new TailTimeAlgorithm(this.audioProcessor);
        }
    }

    initializeElements() {
        const originalCanvas = document.getElementById('original-waveform');
        const originalRuler = document.getElementById('ruler-original');
        const canvas1 = document.getElementById('waveform-track1');
        const canvas2 = document.getElementById('waveform-track2');
        const fadeCanvas1 = document.getElementById('fade-ui-track1');
        const fadeCanvas2 = document.getElementById('fade-ui-track2');
        const fadeCanvasOriginal = document.getElementById('fade-ui-original');
        const ruler1 = document.getElementById('ruler-track1');
        const ruler2 = document.getElementById('ruler-track2');
        this.levelMeter1 = document.getElementById('level-meter-track1');
        this.levelMeter2 = document.getElementById('level-meter-track2');
        
        this.originalWaveformViewer = new OriginalWaveformViewer(originalCanvas, originalRuler);
        this.originalWaveformViewer.onRangeChange = (startTime, endTime) => {
            this.useRangeStart = startTime;
            this.useRangeEnd = endTime;
            // 範囲詳細設定コントローラにも反映
            if (this.rangeDetailController) {
                this.rangeDetailController.setRange(startTime, endTime);
            }
            // テール時間の最大値を更新（テール時間モードの時のみ）
            if (this.tailTimeController && this.originalBuffer && this.loopAlgorithm === 'tail') {
                this.tailTimeController.updateMaxValueForTailMode();
            }
            // テール時間モードの情報を更新
            this.updateOriginalWaveformTailMode();
            this.updateBuffers();
            this.drawWaveforms();
        };
        
        this.waveformRenderer = new WaveformRenderer(canvas1, canvas2, ruler1, ruler2);
        this.fadeUIController = new FadeUIController(this, fadeCanvas1, fadeCanvas2, fadeCanvasOriginal);
        
        // 範囲詳細設定コントローラを初期化
        const rangeDetailContainer = document.getElementById('range-detail-container');
        const rangeDetailStartCanvas = document.getElementById('range-detail-start');
        const rangeDetailEndCanvas = document.getElementById('range-detail-end');
        const rangeDetailStartRuler = document.getElementById('ruler-detail-start');
        const rangeDetailEndRuler = document.getElementById('ruler-detail-end');
        if (rangeDetailContainer && rangeDetailStartCanvas && rangeDetailEndCanvas) {
            this.rangeDetailController = new RangeDetailController(
                rangeDetailContainer,
                rangeDetailStartCanvas,
                rangeDetailEndCanvas,
                rangeDetailStartRuler,
                rangeDetailEndRuler,
                this.originalWaveformViewer,
                this
            );
        }
    }

    updateBuffers() {
        if (!this.originalBuffer || !this.audioProcessor) return;
        
        // 再生中の場合、現在の再生位置を保持
        const wasPlaying = this.audioPlayer && this.audioPlayer.isPlaying;
        let currentPlaybackTime = null;
        if (wasPlaying) {
            currentPlaybackTime = this.audioPlayer.getCurrentPlaybackTime();
            if (currentPlaybackTime !== null) {
                // 新しいバッファの長さに合わせてクリップ
                const oldDuration = this.track1Buffer ? this.track1Buffer.duration : 0;
            }
        }
        
        // 元波形から利用範囲を抽出
        const useRangeBuffer = this.audioProcessor.extractRange(
            this.originalBuffer,
            this.useRangeStart,
            this.useRangeEnd
        );
        
        // アルゴリズムが初期化されていない場合は初期化
        if (!this.currentAlgorithm || !this.audioProcessor) {
            this.initAlgorithm();
        }
        
        if (!this.currentAlgorithm) return;
        
        // アルゴリズム固有のパラメータを準備
        const useRangeDuration = this.useRangeEnd - this.useRangeStart;
        const params = this.loopAlgorithm === 'overlap' 
            ? { overlapRate: this.overlapRate }
            : { 
                tailTime: this.tailTime, 
                useRangeDuration: useRangeDuration,
                useRangeEnd: this.useRangeEnd,
                originalBuffer: this.originalBuffer
            };
        
        // アルゴリズムクラスを使用してバッファを生成
        this.track1Buffer = this.currentAlgorithm.createTrack1Buffer(
            useRangeBuffer,
            params,
            this.fadeSettingsTrack1
        );
        
        this.track2Buffer = this.currentAlgorithm.createTrack2Buffer(
            useRangeBuffer,
            this.track1Buffer.duration,
            params,
            this.fadeSettingsTrack2
        );
        
        // トラック1と2をミックスしたバッファを生成
        this.mixedBuffer = this.audioProcessor.mixBuffers(this.track1Buffer, this.track2Buffer);
        
        // テールモードの場合、ミックスバッファを利用範囲の長さに切り詰める
        if (this.loopAlgorithm === 'tail') {
            this.mixedBuffer = this.audioProcessor.truncateBuffer(this.mixedBuffer, useRangeDuration);
        }
        
        // 再生中だった場合、新しいバッファで再生を再開
        if (wasPlaying && this.audioPlayer && this.track1Buffer && this.track2Buffer) {
            // テールモードの場合は利用範囲の長さをループ長として使用
            const loopDuration = this.loopAlgorithm === 'tail' ? useRangeDuration : this.track1Buffer.duration;
            if (loopDuration > 0) {
                // 新しいバッファの長さに合わせて再生位置をクリップ
                let seekTime = currentPlaybackTime !== null ? currentPlaybackTime : 0;
                seekTime = Math.max(0, Math.min(loopDuration, seekTime));
                this.audioPlayer.stopPreview();
                this.audioPlayer.playPreviewWithBuffers(this.track1Buffer, this.track2Buffer, seekTime, loopDuration);
                
                // ミュート状態を再適用
                if (this.uiController) {
                    if (this.uiController.track1Muted) {
                        this.audioPlayer.setTrack1Mute(true);
                    }
                    if (this.uiController.track2Muted) {
                        this.audioPlayer.setTrack2Mute(true);
                    }
                }
            }
        }
    }

    // 波形上クリックによるシーク
    seekTo(timeInSeconds) {
        if (!this.audioPlayer || !this.track1Buffer || !this.track2Buffer) return;

        const duration = this.track1Buffer.duration;
        if (duration <= 0) return;

        // ループ範囲内にクリップ
        let targetTime = Math.max(0, Math.min(duration, timeInSeconds));

        // 再生中のみシーク（要望に合わせて）
        if (this.audioPlayer.isPlaying) {
            this.audioPlayer.stopPreview();
            this.audioPlayer.playPreviewWithBuffers(this.track1Buffer, this.track2Buffer, targetTime);
        }
    }

    updateOriginalWaveformTailMode() {
        if (!this.originalWaveformViewer) return;
        if (this.loopAlgorithm === 'tail' && this.originalBuffer) {
            this.originalWaveformViewer.setTailMode({
                enabled: true,
                tailTime: this.tailTime,
                useRangeEnd: this.useRangeEnd
            });
        } else {
            this.originalWaveformViewer.setTailMode(null);
        }
    }
    
    drawWaveforms() {
        if (!this.track1Buffer || !this.track2Buffer || !this.waveformRenderer) return;
        
        // 元波形のテール時間モード情報を更新
        this.updateOriginalWaveformTailMode();
        
        const currentTime = this.audioPlayer ? this.audioPlayer.getCurrentPlaybackTime() : null;
        const bpmOptions = {
            enabled: this.rangeDetailController ? (this.rangeDetailController.bpmEnabled) : false,
            bpm: this.rangeDetailController ? this.rangeDetailController.bpm : 120,
            numerator: this.rangeDetailController ? this.rangeDetailController.timeSigNumerator : 4,
            denominator: this.rangeDetailController ? this.rangeDetailController.timeSigDenominator : 4
        };
        
        // アルゴリズムクラスからレンダリングオプションを取得
        const useRangeDuration = this.useRangeEnd - this.useRangeStart;
        const params = this.loopAlgorithm === 'overlap' 
            ? { overlapRate: this.overlapRate }
            : { tailTime: this.tailTime, useRangeDuration: useRangeDuration };
        const renderOptions = this.currentAlgorithm 
            ? this.currentAlgorithm.getRenderOptions(params, useRangeDuration)
            : { loopAlgorithm: this.loopAlgorithm };
        
        this.waveformRenderer.render(this.track1Buffer, this.track2Buffer, currentTime, bpmOptions, renderOptions);
        if (this.fadeUIController) {
            this.fadeUIController.render();
        }
    }

    // BPM/メトロノーム設定変更時に即反映するための再生再起動
    restartPlaybackIfPlaying() {
        if (!this.audioPlayer || !this.audioPlayer.isPlaying) return;
        if (!this.track1Buffer || !this.track2Buffer) return;
        const current = this.audioPlayer.getCurrentPlaybackTime() || 0;
        this.audioPlayer.stopPreview();
        this.audioPlayer.playPreviewWithBuffers(this.track1Buffer, this.track2Buffer, current);
        // ミュート状態を再適用（UI側の状態を参照）
        if (this.uiController) {
            if (this.uiController.track1Muted) {
                this.audioPlayer.setTrack1Mute(true);
            }
            if (this.uiController.track2Muted) {
                this.audioPlayer.setTrack2Mute(true);
            }
        }
        this.startPlaybackAnimation();
    }

    startPlaybackAnimation() {
        const animate = () => {
            if (this.audioPlayer && this.audioPlayer.isPlaying) {
                this.drawWaveforms();
                this.updateLevelMeters();
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.animationFrameId = null;
                this.resetLevelMeters();
            }
        };
        if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(animate);
        }
    }

    updateLevelMeters() {
        if (!this.audioPlayer) return;

        const level1 = this.audioPlayer.getLevel(1);
        const level2 = this.audioPlayer.getLevel(2);

        if (this.levelMeter1) {
            const bar1 = this.levelMeter1.querySelector('.level-bar');
            if (bar1) {
                bar1.style.height = (level1 * 100) + '%';
            }
        }

        if (this.levelMeter2) {
            const bar2 = this.levelMeter2.querySelector('.level-bar');
            if (bar2) {
                bar2.style.height = (level2 * 100) + '%';
            }
        }
    }

    resetLevelMeters() {
        if (this.levelMeter1) {
            const bar1 = this.levelMeter1.querySelector('.level-bar');
            if (bar1) {
                bar1.style.height = '0%';
            }
        }

        if (this.levelMeter2) {
            const bar2 = this.levelMeter2.querySelector('.level-bar');
            if (bar2) {
                bar2.style.height = '0%';
            }
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

    setupAlgorithmSelector() {
        const algorithmSelect = document.getElementById('loop-algorithm');
        if (!algorithmSelect) return;
        
        algorithmSelect.addEventListener('change', (e) => {
            this.loopAlgorithm = e.target.value;
            this.initAlgorithm(); // アルゴリズムインスタンスを再作成
            this.updateAlgorithmUI();
            this.updateBuffers();
            this.drawWaveforms();
        });
    }

    updateAlgorithmUI() {
        const overlapUI = document.getElementById('overlap-rate-ui');
        const tailUI = document.getElementById('tail-time-ui');
        
        if (this.loopAlgorithm === 'overlap') {
            if (overlapUI) overlapUI.classList.remove('hidden');
            if (tailUI) tailUI.classList.add('hidden');
            // オーバーラップモードの時はテール時間モード情報をクリア
            this.updateOriginalWaveformTailMode();
        } else {
            if (overlapUI) overlapUI.classList.add('hidden');
            if (tailUI) tailUI.classList.remove('hidden');
            // テール時間の最大値を useRangeEnd から originalBuffer.duration までに設定
            if (this.tailTimeController && this.originalBuffer) {
                this.tailTimeController.updateMaxValueForTailMode();
            }
            // テール時間モードの情報を更新
            this.updateOriginalWaveformTailMode();
        }
        this.drawWaveforms();
    }

}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new LoopMaker();
});

