// 上部UI処理クラス
class UIController {
    constructor(slowSpeech) {
        this.slowSpeech = slowSpeech;
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.fileInput = document.getElementById('file-input');
        this.saveBtn = document.getElementById('save-btn');
        this.playBtn = document.getElementById('play-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.status = document.getElementById('status');
        this.dropZone = document.getElementById('original-drop-zone');
        this.dropOverlay = document.getElementById('drop-overlay');
        this.processedWaveform = document.getElementById('processed-waveform');
        this.filenameInput = document.getElementById('filename-input');
        this.playbackRateSlider = document.getElementById('playback-rate');
        this.playbackRateValue = document.getElementById('playback-rate-value');
        this.resampleAlgorithmSelect = document.getElementById('resample-algorithm');
        this.rateIncreaseBtn = document.getElementById('rate-increase-btn');
        this.rateDecreaseBtn = document.getElementById('rate-decrease-btn');
        this.cutRatioControls = document.getElementById('cut-ratio-controls');
        this.minCutRatioValue = document.getElementById('min-cut-ratio-value');
        this.maxCutRatioValue = document.getElementById('max-cut-ratio-value');
        this.adjustCutRatioBtn = document.getElementById('adjust-cut-ratio-btn');
        this.detailSettingsBtn = document.getElementById('detail-settings-btn');
        this.detailSettings = document.getElementById('detail-settings');
        this.silenceCorrectionStrengthSlider = document.getElementById('silence-correction-strength');
        this.silenceCorrectionStrengthValue = document.getElementById('silence-correction-strength-value');
        this.maxSilenceRateSlider = document.getElementById('max-silence-rate');
        this.maxSilenceRateValue = document.getElementById('max-silence-rate-value');
        this.showRateBtn = document.getElementById('show-rate-btn');
        this.originalSpeakerBtn = document.getElementById('original-speaker-btn');
        this.processedSpeakerBtn = document.getElementById('processed-speaker-btn');
        // レベルメーターコンポーネントを初期化（audioPlayerは後で設定）
        this.originalLevelMeter = null;
        this.processedLevelMeter = null;
        this.correctionProgressContainer = document.getElementById('correction-progress-container');
        this.correctionProgressBar = document.getElementById('correction-progress-bar');
        this.correctionProgressText = document.getElementById('correction-progress-text');
    }

    setupEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.saveBtn.addEventListener('click', () => this.saveFile());
        this.playBtn.addEventListener('click', () => this.playPreview());
        this.stopBtn.addEventListener('click', () => this.stopPreview());
        
        if (this.playbackRateSlider) {
            this.playbackRateSlider.addEventListener('input', (e) => this.handlePlaybackRateChange(e));
        }
        
        if (this.rateIncreaseBtn) {
            this.rateIncreaseBtn.addEventListener('click', () => this.adjustPlaybackRate(0.1));
        }
        
        if (this.rateDecreaseBtn) {
            this.rateDecreaseBtn.addEventListener('click', () => this.adjustPlaybackRate(-0.1));
        }
        
        if (this.playbackRateValue) {
            // 入力フィールドの変更イベント（フォーカスが外れたとき）
            this.playbackRateValue.addEventListener('change', (e) => this.handlePlaybackRateInputChange(e));
            // Enterキー押下時も処理
            this.playbackRateValue.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.playbackRateValue.blur(); // blurを呼ぶとchangeイベントが発火
                }
            });
        }
        
        if (this.resampleAlgorithmSelect) {
            this.resampleAlgorithmSelect.addEventListener('change', (e) => this.handleAlgorithmChange(e));
        }
        
        if (this.adjustCutRatioBtn) {
            this.adjustCutRatioBtn.addEventListener('click', () => this.adjustCutRatioToTarget());
        }
        
        if (this.silenceCorrectionStrengthSlider) {
            this.silenceCorrectionStrengthSlider.addEventListener('input', (e) => this.handleSilenceCorrectionStrengthChange(e));
        }
        
        if (this.maxSilenceRateSlider) {
            this.maxSilenceRateSlider.addEventListener('input', (e) => this.handleMaxSilenceRateChange(e));
        }
        
        if (this.detailSettingsBtn) {
            this.detailSettingsBtn.addEventListener('click', () => this.toggleDetailSettings());
        }
        
        if (this.minCutRatioValue) {
            this.minCutRatioValue.addEventListener('change', (e) => this.handleMinCutRatioChange(e));
            this.minCutRatioValue.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.minCutRatioValue.blur();
                }
            });
        }
        
        if (this.maxCutRatioValue) {
            this.maxCutRatioValue.addEventListener('change', (e) => this.handleMaxCutRatioChange(e));
            this.maxCutRatioValue.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.maxCutRatioValue.blur();
                }
            });
        }

        if (this.showRateBtn) {
            this.showRateBtn.addEventListener('click', () => this.toggleRateLine());
        }

        if (this.originalSpeakerBtn) {
            this.originalSpeakerBtn.addEventListener('click', () => this.toggleOriginalMute());
        }

        if (this.processedSpeakerBtn) {
            this.processedSpeakerBtn.addEventListener('click', () => this.toggleProcessedMute());
        }

        if (this.dropZone) {
            ['dragenter', 'dragover'].forEach(evt => {
                this.dropZone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(evt => {
                this.dropZone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.remove('dragover');
                });
            });

            this.dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    // 同じファイルを再度読み込めるようにリセット
                    this.fileInput.value = '';
                    this.loadFile(files[0]);
                }
            });
        }

        const clickHandler = (e) => {
            if (!this.slowSpeech || !this.slowSpeech.processedBuffer) return;
            if (!this.slowSpeech.audioPlayer || !this.slowSpeech.audioPlayer.isPlaying) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            if (width <= 0) return;

            const ratio = Math.min(1, Math.max(0, x / width));
            const duration = this.slowSpeech.processedBuffer.duration;
            const targetTime = duration * ratio;

            this.slowSpeech.seekTo(targetTime);
        };

        if (this.processedWaveform) {
            this.processedWaveform.addEventListener('click', clickHandler);
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            if (isInput) {
                return;
            }
            
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                this.togglePlayback();
            }
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        await this.loadFile(file);
    }

    async loadFile(file) {
        if (!file) return;

        this.showStatus('ファイルを読み込み中...', 'info');

        try {
            // 再生中なら停止してから読み込み
            if (this.slowSpeech.audioPlayer && this.slowSpeech.audioPlayer.isPlaying) {
                this.slowSpeech.audioPlayer.stopPreview();
                this.slowSpeech.stopPlaybackAnimation();
                this.playBtn.disabled = false;
                this.stopBtn.disabled = true;
            }

            // ファイル名を保存用ファイル名に反映
            if (this.filenameInput && file && file.name) {
                const originalName = file.name;
                // 拡張子を .wav に統一
                const dotIndex = originalName.lastIndexOf('.');
                let base = originalName;
                if (dotIndex > 0) {
                    base = originalName.substring(0, dotIndex);
                }
                const newName = base + '.wav';
                this.filenameInput.value = newName;
                this.filenameInput.disabled = false;
            }

            const arrayBuffer = await file.arrayBuffer();
            this.slowSpeech.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.slowSpeech.originalBuffer = await this.slowSpeech.audioContext.decodeAudioData(arrayBuffer);
            this.slowSpeech.audioProcessor = new AudioProcessor(this.slowSpeech.audioContext);
            this.slowSpeech.audioPlayer = new AudioPlayer(this.slowSpeech.audioContext);
            
            // レベルメーターコンポーネントを初期化
            this.originalLevelMeter = new LevelMeter('original', this.slowSpeech.audioPlayer, true);
            this.processedLevelMeter = new LevelMeter('processed', this.slowSpeech.audioPlayer, false);
            
            // 元波形を表示
            if (this.slowSpeech.originalWaveformViewer) {
                this.slowSpeech.originalWaveformViewer.setAudioBuffer(this.slowSpeech.originalBuffer);
                this.slowSpeech.useRangeStart = 0;
                this.slowSpeech.useRangeEnd = this.slowSpeech.originalBuffer.duration;
                this.slowSpeech.originalWaveformViewer.setRange(this.slowSpeech.useRangeStart, this.slowSpeech.useRangeEnd);
                if (this.dropOverlay) {
                    this.dropOverlay.classList.add('hidden');
                }
            }
            
            // バッファを生成
            await this.slowSpeech.updateBuffers();
            
            this.slowSpeech.drawWaveforms();
            this.enableControls();
            // 無音部分の再生レート倍率表示を更新
            this.updateCutRatioControlsVisibility();
            this.updateCutRatioDisplay();
            this.showStatus('ファイルの読み込みが完了しました', 'success');
        } catch (error) {
            this.showStatus('エラー: ' + error.message, 'error');
            console.error(error);
        }
    }

    togglePlayback() {
        if (!this.slowSpeech.originalBuffer || !this.slowSpeech.audioPlayer) return;
        
        if (this.slowSpeech.audioPlayer.isPlaying) {
            this.stopPreview();
        } else {
            this.playPreview();
        }
    }

    async playPreview() {
        if (!this.slowSpeech.originalBuffer || !this.slowSpeech.audioPlayer || !this.slowSpeech.processedBuffer) return;

        try {
            this.playBtn.disabled = true;
            this.stopBtn.disabled = false;

            // 元波形から利用範囲を抽出（再生用）
            const useRangeBuffer = this.slowSpeech.audioProcessor.extractRange(
                this.slowSpeech.originalBuffer,
                this.slowSpeech.useRangeStart,
                this.slowSpeech.useRangeEnd
            );

            // 元波形と加工後のバッファを同時に再生
            const started = this.slowSpeech.audioPlayer.playPreview(useRangeBuffer, this.slowSpeech.processedBuffer, 0);
            if (!started) {
                // 既に再生中などで開始できなかった場合はボタン状態を元に戻す
                this.playBtn.disabled = false;
                this.stopBtn.disabled = true;
                return;
            }

            this.slowSpeech.startPlaybackAnimation();
            this.showStatus('再生中...', 'info');
        } catch (error) {
            this.showStatus('再生エラー: ' + error.message, 'error');
            console.error(error);
            this.playBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }

    stopPreview() {
        if (this.slowSpeech.audioPlayer) {
            this.slowSpeech.audioPlayer.stopPreview();
        }
        this.slowSpeech.stopPlaybackAnimation();
        this.playBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.showStatus('停止しました', 'info');
    }

    async saveFile() {
        if (!this.slowSpeech.processedBuffer || !this.slowSpeech.audioProcessor) return;

        try {
            // ファイル名を取得
            let filename = this.filenameInput ? this.filenameInput.value.trim() : 'output.wav';
            if (!filename) {
                filename = 'output.wav';
            }
            
            // .wav拡張子がない場合は追加
            if (!filename.toLowerCase().endsWith('.wav')) {
                filename += '.wav';
                if (this.filenameInput) {
                    this.filenameInput.value = filename;
                }
            }

            // File System Access APIが利用可能な場合
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'WAV files',
                            accept: { 'audio/wav': ['.wav'] }
                        }]
                    });
                    
                    const writable = await fileHandle.createWritable();
                    const wav = this.slowSpeech.audioProcessor.bufferToWav(this.slowSpeech.processedBuffer);
                    await writable.write(wav);
                    await writable.close();
                    
                    // ファイル名を更新
                    if (this.filenameInput) {
                        this.filenameInput.value = fileHandle.name;
                    }
                    
                    this.showStatus('ファイルを保存しました', 'success');
                    return;
                } catch (error) {
                    // ユーザーがキャンセルした場合
                    if (error.name === 'AbortError') {
                        this.showStatus('保存をキャンセルしました', 'info');
                        return;
                    }
                    // その他のエラーは通常のダウンロード方式にフォールバック
                    console.warn('File System Access API error:', error);
                }
            }

            // 通常のダウンロード方式（File System Access APIが利用不可の場合）
            this.showStatus('ファイルを生成中...', 'info');
            this.slowSpeech.audioProcessor.saveBuffer(this.slowSpeech.processedBuffer, filename);
            this.showStatus('ファイルを保存しました', 'success');
        } catch (error) {
            this.showStatus('保存エラー: ' + error.message, 'error');
            console.error(error);
        }
    }

    async handlePlaybackRateChange(event) {
        const rate = parseFloat(event.target.value);
        this.setPlaybackRate(rate);
    }

    async handlePlaybackRateInputChange(event) {
        let rate = parseFloat(event.target.value);
        // 値の検証と範囲制限
        const minRate = 0.1;
        const maxRate = 2.0;
        if (isNaN(rate)) {
            // 無効な値の場合は現在の値に戻す
            rate = this.slowSpeech.playbackRate;
        } else {
            // 範囲を制限
            rate = Math.max(minRate, Math.min(maxRate, rate));
        }
        this.setPlaybackRate(rate);
    }

    async adjustPlaybackRate(delta) {
        const currentRate = this.slowSpeech.playbackRate;
        const minRate = 0.1;
        const maxRate = 2.0;
        const newRate = Math.max(minRate, Math.min(maxRate, currentRate + delta));
        this.setPlaybackRate(newRate);
    }

    async setPlaybackRate(rate) {
        this.slowSpeech.playbackRate = rate;
        if (this.playbackRateSlider) {
            this.playbackRateSlider.value = rate;
        }
        if (this.playbackRateValue) {
            // input要素の場合はvalueプロパティで更新
            this.playbackRateValue.value = rate.toFixed(2);
        }
        await this.slowSpeech.updateBuffers();
        this.slowSpeech.drawWaveforms();
    }

    async handleAlgorithmChange(event) {
        const algorithm = event.target.value;
        this.slowSpeech.resampleAlgorithm = algorithm;
        // アルゴリズムインスタンスを再作成
        this.slowSpeech.currentAlgorithm = null;
        // 無音部分の再生レート倍率コントロールの表示/非表示を切り替え
        this.updateCutRatioControlsVisibility();
        await this.slowSpeech.updateBuffers();
        this.slowSpeech.drawWaveforms();
        this.updateCutRatioDisplay();
    }

    updateCutRatioControlsVisibility() {
        if (this.cutRatioControls) {
            if (this.slowSpeech.resampleAlgorithm === 'silence-cut') {
                this.cutRatioControls.classList.remove('hidden');
                // 詳細設定はデフォルトで非表示
                if (this.detailSettings) {
                    this.detailSettings.classList.add('hidden');
                }
                if (this.detailSettingsBtn) {
                    this.detailSettingsBtn.textContent = '詳細設定 ▼';
                }
            } else {
                this.cutRatioControls.classList.add('hidden');
            }
        }
    }

    toggleDetailSettings() {
        if (this.detailSettings && this.detailSettingsBtn) {
            const isHidden = this.detailSettings.classList.contains('hidden');
            if (isHidden) {
                this.detailSettings.classList.remove('hidden');
                this.detailSettingsBtn.textContent = '詳細設定 ▲';
            } else {
                this.detailSettings.classList.add('hidden');
                this.detailSettingsBtn.textContent = '詳細設定 ▼';
            }
        }
    }

    handleMinCutRatioChange(event) {
        let value = parseFloat(event.target.value);
        if (isNaN(value)) {
            value = 1.0;
        }
        // 範囲を制限
        value = Math.max(0.001, Math.min(256.0, value));
        
        if (this.slowSpeech.currentAlgorithm && 
            this.slowSpeech.currentAlgorithm instanceof SilenceCutResampleAlgorithm) {
            const maxRate = this.slowSpeech.currentAlgorithm.maxSilenceRate;
            // 最小値が最大値を超えないようにする
            if (value > maxRate) {
                value = maxRate;
            }
            this.slowSpeech.currentAlgorithm.setCutRatios(value, maxRate);
            if (this.minCutRatioValue) {
                this.minCutRatioValue.value = value.toFixed(2);
            }
            // バッファを再生成
            this.slowSpeech.updateBuffers().then(() => {
                this.slowSpeech.drawWaveforms();
            });
        }
    }

    handleMaxCutRatioChange(event) {
        let value = parseFloat(event.target.value);
        if (isNaN(value)) {
            value = 4.0;
        }
        // 範囲を制限
        value = Math.max(0.001, Math.min(256.0, value));
        
        if (this.slowSpeech.currentAlgorithm && 
            this.slowSpeech.currentAlgorithm instanceof SilenceCutResampleAlgorithm) {
            const minRate = this.slowSpeech.currentAlgorithm.minSilenceRate;
            // 最大値が最小値より小さくならないようにする
            if (value < minRate) {
                value = minRate;
            }
            this.slowSpeech.currentAlgorithm.setCutRatios(minRate, value);
            if (this.maxCutRatioValue) {
                this.maxCutRatioValue.value = value.toFixed(2);
            }
            // 最大再生レート倍率スライダーも更新
            if (this.maxSilenceRateSlider) {
                this.maxSilenceRateSlider.value = value.toFixed(1);
            }
            if (this.maxSilenceRateValue) {
                this.maxSilenceRateValue.textContent = value.toFixed(1);
            }
            // バッファを再生成
            this.slowSpeech.updateBuffers().then(() => {
                this.slowSpeech.drawWaveforms();
            });
        }
    }

    updateCutRatioDisplay() {
        if (this.slowSpeech.currentAlgorithm && 
            this.slowSpeech.currentAlgorithm instanceof SilenceCutResampleAlgorithm) {
            if (this.minCutRatioValue) {
                // input要素の場合はvalueプロパティで更新
                this.minCutRatioValue.value = this.slowSpeech.currentAlgorithm.minSilenceRate.toFixed(2);
            }
            if (this.maxCutRatioValue) {
                // input要素の場合はvalueプロパティで更新
                this.maxCutRatioValue.value = this.slowSpeech.currentAlgorithm.maxSilenceRate.toFixed(2);
            }
            if (this.maxSilenceRateSlider) {
                this.maxSilenceRateSlider.value = this.slowSpeech.currentAlgorithm.maxSilenceRate.toFixed(1);
            }
            if (this.maxSilenceRateValue) {
                this.maxSilenceRateValue.textContent = this.slowSpeech.currentAlgorithm.maxSilenceRate.toFixed(1);
            }
            if (this.silenceCorrectionStrengthSlider) {
                // UIのスライダーは0.0〜1.0の範囲に制限（表示用）
                const displayValue = Math.min(this.slowSpeech.currentAlgorithm.silenceCorrectionStrength, 1.0);
                this.silenceCorrectionStrengthSlider.value = displayValue.toFixed(2);
            }
            if (this.silenceCorrectionStrengthValue) {
                // 1.0を超える場合は「1.0+ (実際の値)」と表示
                const strength = this.slowSpeech.currentAlgorithm.silenceCorrectionStrength;
                if (strength > 1.0) {
                    this.silenceCorrectionStrengthValue.textContent = `1.0+ (${strength.toFixed(2)})`;
                } else {
                    this.silenceCorrectionStrengthValue.textContent = strength.toFixed(2);
                }
            }
        }
    }

    handleMaxSilenceRateChange(event) {
        const maxRate = parseFloat(event.target.value);
        if (this.slowSpeech.currentAlgorithm && 
            this.slowSpeech.currentAlgorithm instanceof SilenceCutResampleAlgorithm) {
            this.slowSpeech.currentAlgorithm.setMaxSilenceRate(maxRate);
            if (this.maxSilenceRateValue) {
                this.maxSilenceRateValue.textContent = maxRate.toFixed(1);
            }
            if (this.maxCutRatioValue) {
                this.maxCutRatioValue.textContent = maxRate.toFixed(2);
            }
            // バッファを再生成
            this.slowSpeech.updateBuffers().then(() => {
                this.slowSpeech.drawWaveforms();
            });
        }
    }

    handleSilenceCorrectionStrengthChange(event) {
        const strength = parseFloat(event.target.value);
        if (this.slowSpeech.currentAlgorithm && 
            this.slowSpeech.currentAlgorithm instanceof SilenceCutResampleAlgorithm) {
            this.slowSpeech.currentAlgorithm.setSilenceCorrectionStrength(strength);
            if (this.silenceCorrectionStrengthValue) {
                this.silenceCorrectionStrengthValue.textContent = strength.toFixed(2);
            }
            // バッファを再生成
            this.slowSpeech.updateBuffers().then(() => {
                this.slowSpeech.drawWaveforms();
            });
        }
    }

    async adjustCutRatioToTarget() {
        if (!this.slowSpeech.currentAlgorithm || 
            !(this.slowSpeech.currentAlgorithm instanceof SilenceCutResampleAlgorithm)) {
            return;
        }

        if (!this.slowSpeech.originalBuffer) {
            return;
        }

        const algorithm = this.slowSpeech.currentAlgorithm;
        const targetDuration = this.slowSpeech.originalDuration;
        
        if (targetDuration <= 0) {
            this.showStatus('元の長さが無効です', 'error');
            return;
        }

        // ボタンを無効化して、処理開始を表示
        if (this.adjustCutRatioBtn) {
            this.adjustCutRatioBtn.disabled = true;
        }
        this.showStatus('補正を開始します...', 'info');

        // プログレスバーを表示
        if (this.correctionProgressContainer) {
            this.correctionProgressContainer.classList.remove('hidden');
        }
        this.updateProgress(0, '補正開始...');

        // UIを更新するために少し待つ（ブラウザに描画の機会を与える）
        await new Promise(resolve => setTimeout(resolve, 50));

        try {

        // 2分岐的補正アルゴリズム（バイナリサーチ風）
        let originalMinSilenceRate = algorithm.minSilenceRate;
        let originalMaxSilenceRate = algorithm.maxSilenceRate;
        let originalCorrectionStrength = algorithm.silenceCorrectionStrength;
        let newMinSilenceRate = originalMinSilenceRate;
        let newMaxSilenceRate = originalMaxSilenceRate;
        let newCorrectionStrength = originalCorrectionStrength;
        const maxIterations = 15;
        const tolerance = 0.01; // 許容誤差（秒）

        // 初回の現在の状態を確認
        await this.slowSpeech.updateBuffers();
        let previousDuration = this.slowSpeech.processedBuffer ? this.slowSpeech.processedBuffer.duration : targetDuration;
        let previousDiff = previousDuration - targetDuration;
        let wasTooLong = previousDiff > 0; // 前回が長すぎたかどうか
        
        // 初期の差を記録（プログレス計算用）
        const initialDiff = Math.abs(previousDiff);
        let bestDiff = initialDiff; // これまでで最も良い（小さい）差

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // 反復開始時にプログレスを更新（反復回数ベースの最小値）
            const minProgressPercent = ((iteration + 1) / maxIterations) * 50; // 最低でも50%まで
            this.updateProgress(minProgressPercent, `補正中... (${iteration + 1}/${maxIterations}) 設定を更新中...`);

            // 無音部分の再生レート倍率と補正の強さを設定
            algorithm.setCutRatios(newMinSilenceRate, newMaxSilenceRate);
            algorithm.setSilenceCorrectionStrength(newCorrectionStrength);
            this.updateCutRatioDisplay();

            // ブラウザに描画の機会を与える
            await new Promise(resolve => setTimeout(resolve, 10));

            // プログレスを更新
            this.updateProgress(minProgressPercent + 5, `補正中... (${iteration + 1}/${maxIterations}) バッファを再生成中...`);

            // バッファを再生成
            await this.slowSpeech.updateBuffers();
            
            // ブラウザに描画の機会を与える
            await new Promise(resolve => setTimeout(resolve, 10));
            
            if (!this.slowSpeech.processedBuffer) {
                break;
            }

            const processedDuration = this.slowSpeech.processedBuffer.duration;
            const durationDiff = processedDuration - targetDuration;
            const currentDiff = Math.abs(durationDiff);
            const diffRatio = Math.abs(durationDiff / targetDuration); // 相対的な差（絶対値）
            
            // 目標への近づき具合に基づいてプログレスを計算
            // 初期差から現在の差への改善率を計算
            let progressPercent = minProgressPercent;
            if (initialDiff > tolerance) {
                // 改善率 = (初期差 - 現在の差) / 初期差
                const improvement = Math.max(0, Math.min(1, (initialDiff - currentDiff) / initialDiff));
                // プログレスは改善率に基づいて計算（最低minProgressPercent、最高95%）
                const improvementProgress = improvement * (95 - minProgressPercent);
                progressPercent = minProgressPercent + improvementProgress;
            } else {
                // 初期差が既に小さい場合は、反復回数ベース
                progressPercent = ((iteration + 1) / maxIterations) * 95;
            }
            
            // これまでで最も良い差を更新
            if (currentDiff < bestDiff) {
                bestDiff = currentDiff;
            }
            
            // プログレスバーを更新
            this.updateProgress(progressPercent, `補正中... (${iteration + 1}/${maxIterations}) 残り: ${currentDiff.toFixed(2)}秒`);
            
            // 波形を更新（視覚的な進捗表示）
            this.slowSpeech.drawWaveforms();

            // 目標の長さに十分近い場合は終了
            if (currentDiff < tolerance) {
                this.updateProgress(100, '補正完了！');
                this.showStatus('目標の長さに補正しました', 'success');
                this.slowSpeech.drawWaveforms();
                // 少し待ってからプログレスバーを非表示
                setTimeout(() => {
                    if (this.correctionProgressContainer) {
                        this.correctionProgressContainer.classList.add('hidden');
                    }
                }, 1000);
                // ボタンを再有効化
                if (this.adjustCutRatioBtn) {
                    this.adjustCutRatioBtn.disabled = false;
                }
                return;
            }

            // 2分岐的補正アルゴリズム
            const isTooLong = durationDiff > 0;
            const isOvershot = (wasTooLong && !isTooLong) || (!wasTooLong && isTooLong); // 目標値を超えてしまったか

            // 調整前に前回の値を保存
            const previousMaxSilenceRate = newMaxSilenceRate;
            const previousMinSilenceRate = newMinSilenceRate;
            const previousCorrectionStrength = newCorrectionStrength;

            if (isTooLong) {
                // ===== 目標より長い場合：無音部分を短くする =====
                // アルゴリズム: silenceRate = minSilenceRate + (progress * (maxSilenceRate - minSilenceRate))
                // maxSilenceRateを上げると無音部分が短くなる
                // minSilenceRateは1.0以上を保つ（無音部分の最小再生レート倍率）
                
                if (isOvershot && iteration > 0) {
                    // 目標値を超えてしまった場合は、前回の値と現在の値の中間を取る（バイナリサーチ風）
                    newMaxSilenceRate = Math.min(256.0, (newMaxSilenceRate + previousMaxSilenceRate) / 2);
                    newCorrectionStrength = (newCorrectionStrength + previousCorrectionStrength) / 2;
                    // minSilenceRateは1.0に保つ（変更しない）
                    if (newMinSilenceRate < 1.0) {
                        newMinSilenceRate = 1.0;
                    }
                } else {
                    // 初回またはまだ長い場合：maxSilenceRateを大きく上げる
                    const aggressiveFactor = iteration === 0 ? 10.0 : (iteration < 3 ? 5.0 : 2.0);
                    const increaseAmount = Math.min(diffRatio * aggressiveFactor * 50.0, 200.0);
                    newMaxSilenceRate = Math.min(256.0, newMaxSilenceRate + increaseAmount);
                    
                    // minSilenceRateは1.0以上を保つ（変更しない、または1.0に設定）
                    if (newMinSilenceRate < 1.0) {
                        newMinSilenceRate = 1.0;
                    }
                    // minSilenceRateは変更しない（maxSilenceRateだけを調整）
                    
                    // 補正の強さも大きく上げる
                    const strengthIncrease = Math.min(diffRatio * aggressiveFactor * 2.0, 2.0);
                    newCorrectionStrength = newCorrectionStrength + strengthIncrease;
                }
                
                // 範囲チェック：minSilenceRateは1.0以上、maxSilenceRateより小さい
                if (newMinSilenceRate < 1.0) {
                    newMinSilenceRate = 1.0;
                }
                if (newMinSilenceRate >= newMaxSilenceRate) {
                    newMinSilenceRate = Math.max(1.0, newMaxSilenceRate - 0.1);
                }
                
            } else {
                // ===== 目標より短い場合：無音部分を長くする =====
                // アルゴリズム: silenceRate = 1.0 - (progress * (1.0 - minRateForExtension))
                // minSilenceRateを下げると無音部分が長くなる
                // maxSilenceRateはこの処理では使われない（変更不要）
                
                if (isOvershot && iteration > 0) {
                    // 目標値を超えてしまった場合は、前回の値と現在の値の中間を取る（バイナリサーチ風）
                    newMinSilenceRate = Math.max(0.001, (newMinSilenceRate + previousMinSilenceRate) / 2);
                    newCorrectionStrength = (newCorrectionStrength + previousCorrectionStrength) / 2;
                    // maxSilenceRateは変更しない（この処理では使われない）
                } else {
                    // 初回またはまだ短い場合：minSilenceRateを積極的に下げる
                    const aggressiveFactor = iteration === 0 ? 10.0 : (iteration < 3 ? 5.0 : 2.0);
                    
                    // minSilenceRateを下げる（0.001倍まで）
                    if (newMinSilenceRate > 0.001) {
                        const minDecreaseAmount = Math.min(diffRatio * aggressiveFactor * 0.5, newMinSilenceRate - 0.001);
                        newMinSilenceRate = Math.max(0.001, newMinSilenceRate - minDecreaseAmount);
                    }
                    
                    // maxSilenceRateは変更しない（この処理では使われない）
                    // ただし、minSilenceRateより大きく保つ必要がある
                    if (newMaxSilenceRate <= newMinSilenceRate) {
                        newMaxSilenceRate = Math.min(256.0, newMinSilenceRate + 0.1);
                    }
                    
                    // 補正の強さは上げる（無音部分をより長くするため）
                    const strengthIncrease = Math.min(diffRatio * aggressiveFactor * 0.5, 1.0);
                    newCorrectionStrength = Math.min(2.0, newCorrectionStrength + strengthIncrease);
                }
                
                // 範囲チェック：minSilenceRateは0.001以上、maxSilenceRateより小さい
                if (newMinSilenceRate < 0.001) {
                    newMinSilenceRate = 0.001;
                }
                if (newMinSilenceRate >= newMaxSilenceRate) {
                    newMinSilenceRate = Math.max(0.001, newMaxSilenceRate - 0.1);
                }
            }

            // 次回の反復用に前回の状態を保存
            previousDuration = processedDuration;
            previousDiff = durationDiff;
            wasTooLong = isTooLong;
            
            // 補正の強さの最小値チェック（上限は撤廃）
            newCorrectionStrength = Math.max(0.0, newCorrectionStrength);
            
            // UI表示を更新
            const displayStrength = Math.min(newCorrectionStrength, 1.0);
            if (this.silenceCorrectionStrengthSlider) {
                this.silenceCorrectionStrengthSlider.value = displayStrength.toFixed(2);
            }
            if (this.silenceCorrectionStrengthValue) {
                if (newCorrectionStrength > 1.0) {
                    this.silenceCorrectionStrengthValue.textContent = `1.0+ (${newCorrectionStrength.toFixed(2)})`;
                } else {
                    this.silenceCorrectionStrengthValue.textContent = newCorrectionStrength.toFixed(2);
                }
            }
        }

        // 最終結果を確認
        // 最終的な補正の強さと最大再生レート倍率を設定して表示を更新
        algorithm.setSilenceCorrectionStrength(newCorrectionStrength);
        algorithm.setMaxSilenceRate(newMaxSilenceRate);
        this.updateCutRatioDisplay();
        this.slowSpeech.drawWaveforms();
        
        // プログレスバーを更新
        this.updateProgress(100, '補正完了');
        
        if (this.slowSpeech.processedBuffer) {
            const finalDuration = this.slowSpeech.processedBuffer.duration;
            const finalDiff = Math.abs(finalDuration - targetDuration);
            if (finalDiff < tolerance) {
                this.showStatus('目標の長さに補正しました', 'success');
            } else {
                this.showStatus(`補正しました（残差: ${finalDiff.toFixed(2)}秒）`, 'info');
            }
        }
        
        // 少し待ってからプログレスバーを非表示
        setTimeout(() => {
            if (this.correctionProgressContainer) {
                this.correctionProgressContainer.classList.add('hidden');
            }
        }, 1000);

        } catch (error) {
            // エラーが発生した場合もボタンを再有効化
            console.error('補正エラー:', error);
            this.showStatus('補正中にエラーが発生しました: ' + error.message, 'error');
            if (this.correctionProgressContainer) {
                this.correctionProgressContainer.classList.add('hidden');
            }
        } finally {
            // 必ずボタンを再有効化
            if (this.adjustCutRatioBtn) {
                this.adjustCutRatioBtn.disabled = false;
            }
        }
    }

    updateProgress(percent, text) {
        if (this.correctionProgressBar) {
            this.correctionProgressBar.style.width = Math.min(100, Math.max(0, percent)) + '%';
        }
        if (this.correctionProgressText) {
            this.correctionProgressText.textContent = text || '補正中...';
        }
    }

    enableControls() {
        this.saveBtn.disabled = false;
        this.playBtn.disabled = false;
        if (this.filenameInput) {
            this.filenameInput.disabled = false;
        }
        if (this.playbackRateSlider) {
            this.playbackRateSlider.disabled = false;
        }
        if (this.playbackRateValue) {
            this.playbackRateValue.disabled = false;
        }
        if (this.rateIncreaseBtn) {
            this.rateIncreaseBtn.disabled = false;
        }
        if (this.rateDecreaseBtn) {
            this.rateDecreaseBtn.disabled = false;
        }
        if (this.resampleAlgorithmSelect) {
            this.resampleAlgorithmSelect.disabled = false;
        }
        if (this.adjustCutRatioBtn) {
            this.adjustCutRatioBtn.disabled = false;
        }
        if (this.detailSettingsBtn) {
            this.detailSettingsBtn.disabled = false;
        }
        if (this.minCutRatioValue) {
            this.minCutRatioValue.disabled = false;
        }
        if (this.maxCutRatioValue) {
            this.maxCutRatioValue.disabled = false;
        }
        if (this.silenceCorrectionStrengthSlider) {
            this.silenceCorrectionStrengthSlider.disabled = false;
        }
        if (this.maxSilenceRateSlider) {
            this.maxSilenceRateSlider.disabled = false;
        }
        if (this.showRateBtn) {
            this.showRateBtn.disabled = false;
        }
        if (this.originalSpeakerBtn) {
            this.originalSpeakerBtn.disabled = false;
        }
        if (this.processedSpeakerBtn) {
            this.processedSpeakerBtn.disabled = false;
        }
        
        // スピーカーアイコンの初期状態を設定
        if (this.originalSpeakerBtn && this.slowSpeech.audioPlayer) {
            const icon = this.originalSpeakerBtn.querySelector('.speaker-icon');
            if (icon) {
                icon.textContent = this.slowSpeech.audioPlayer.originalMuted ? '🔇' : '🔊';
            }
            if (this.slowSpeech.audioPlayer.originalMuted) {
                this.originalSpeakerBtn.classList.add('muted');
            } else {
                this.originalSpeakerBtn.classList.remove('muted');
            }
        }
        
        if (this.processedSpeakerBtn && this.slowSpeech.audioPlayer) {
            const icon = this.processedSpeakerBtn.querySelector('.speaker-icon');
            if (icon) {
                icon.textContent = this.slowSpeech.audioPlayer.processedMuted ? '🔇' : '🔊';
            }
            if (this.slowSpeech.audioPlayer.processedMuted) {
                this.processedSpeakerBtn.classList.add('muted');
            } else {
                this.processedSpeakerBtn.classList.remove('muted');
            }
        }
        
        // 無音部分の再生レート倍率コントロールの表示/非表示を更新
        this.updateCutRatioControlsVisibility();
        this.updateCutRatioDisplay();
    }

    toggleRateLine() {
        if (!this.slowSpeech.waveformRenderer) return;
        
        const currentState = this.slowSpeech.waveformRenderer.showRateLine;
        const newState = !currentState;
        this.slowSpeech.waveformRenderer.setShowRateLine(newState);
        
        if (this.showRateBtn) {
            this.showRateBtn.textContent = newState ? '再生レートを非表示' : '再生レートを表示';
        }
        
        // 波形を再描画
        this.slowSpeech.drawWaveforms();
    }

    toggleOriginalMute() {
        if (!this.slowSpeech.audioPlayer) return;
        
        const currentMuted = this.slowSpeech.audioPlayer.originalMuted;
        const newMuted = !currentMuted;
        this.slowSpeech.audioPlayer.setOriginalMuted(newMuted);
        
        if (this.originalSpeakerBtn) {
            const icon = this.originalSpeakerBtn.querySelector('.speaker-icon');
            if (icon) {
                icon.textContent = newMuted ? '🔇' : '🔊';
            }
            if (newMuted) {
                this.originalSpeakerBtn.classList.add('muted');
            } else {
                this.originalSpeakerBtn.classList.remove('muted');
            }
        }
        
        // 再生中の場合、再開する必要がある
        if (this.slowSpeech.audioPlayer.isPlaying && this.slowSpeech.processedBuffer) {
            const currentTime = this.slowSpeech.audioPlayer.getCurrentPlaybackTime();
            const useRangeBuffer = this.slowSpeech.audioProcessor.extractRange(
                this.slowSpeech.originalBuffer,
                this.slowSpeech.useRangeStart,
                this.slowSpeech.useRangeEnd
            );
            this.slowSpeech.audioPlayer.stopPreview();
            this.slowSpeech.audioPlayer.playPreview(useRangeBuffer, this.slowSpeech.processedBuffer, currentTime || 0);
        }
    }

    toggleProcessedMute() {
        if (!this.slowSpeech.audioPlayer) return;
        
        const currentMuted = this.slowSpeech.audioPlayer.processedMuted;
        const newMuted = !currentMuted;
        this.slowSpeech.audioPlayer.setProcessedMuted(newMuted);
        
        if (this.processedSpeakerBtn) {
            const icon = this.processedSpeakerBtn.querySelector('.speaker-icon');
            if (icon) {
                icon.textContent = newMuted ? '🔇' : '🔊';
            }
            if (newMuted) {
                this.processedSpeakerBtn.classList.add('muted');
            } else {
                this.processedSpeakerBtn.classList.remove('muted');
            }
        }
        
        // 再生中の場合、再開する必要がある
        if (this.slowSpeech.audioPlayer.isPlaying && this.slowSpeech.processedBuffer) {
            const currentTime = this.slowSpeech.audioPlayer.getCurrentPlaybackTime();
            const useRangeBuffer = this.slowSpeech.audioProcessor.extractRange(
                this.slowSpeech.originalBuffer,
                this.slowSpeech.useRangeStart,
                this.slowSpeech.useRangeEnd
            );
            this.slowSpeech.audioPlayer.stopPreview();
            this.slowSpeech.audioPlayer.playPreview(useRangeBuffer, this.slowSpeech.processedBuffer, currentTime || 0);
        }
    }

    updateLevelMeters() {
        // レベルメーターコンポーネントを更新
        if (this.originalLevelMeter) {
            this.originalLevelMeter.update();
        }
        if (this.processedLevelMeter) {
            this.processedLevelMeter.update();
        }
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = 'status ' + type;
    }
}
