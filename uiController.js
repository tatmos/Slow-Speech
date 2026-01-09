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
        this.originalLevelBar = document.getElementById('original-level-bar');
        this.processedLevelBar = document.getElementById('processed-level-bar');
        this.originalLevelMeter = document.getElementById('original-level-meter');
        this.processedLevelMeter = document.getElementById('processed-level-meter');
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
        value = Math.max(0.1, Math.min(256.0, value));
        
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
        value = Math.max(0.1, Math.min(256.0, value));
        
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

        // 反復的に補正を試みる（最大5回）
        let originalMinSilenceRate = algorithm.minSilenceRate;
        let originalMaxSilenceRate = algorithm.maxSilenceRate;
        let originalCorrectionStrength = algorithm.silenceCorrectionStrength;
        let newMinSilenceRate = originalMinSilenceRate;
        let newMaxSilenceRate = originalMaxSilenceRate;
        let newCorrectionStrength = originalCorrectionStrength;
        const maxIterations = 5;
        const tolerance = 0.05; // 許容誤差（秒）

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // 無音部分の再生レート倍率と補正の強さを設定
            algorithm.setCutRatios(newMinSilenceRate, newMaxSilenceRate);
            algorithm.setSilenceCorrectionStrength(newCorrectionStrength);
            this.updateCutRatioDisplay();

            // バッファを再生成
            await this.slowSpeech.updateBuffers();
            
            if (!this.slowSpeech.processedBuffer) {
                break;
            }

            const processedDuration = this.slowSpeech.processedBuffer.duration;
            const durationDiff = processedDuration - targetDuration;
            const diffRatio = durationDiff / targetDuration; // 相対的な差

            // 目標の長さに十分近い場合は終了
            if (Math.abs(durationDiff) < tolerance) {
                this.showStatus('目標の長さに補正しました', 'success');
                this.slowSpeech.drawWaveforms();
                return;
            }

            // 再生レート倍率と補正の強さを調整
            if (durationDiff > 0) {
                // 目標より長い場合：最大再生レート倍率を上げる、または補正の強さを上げる（無音部分をより短縮）
                // 差が大きいほど大きく上げる
                const increaseAmount = Math.min(diffRatio * 0.8, 0.5); // 最大0.5まで上げる
                newMaxSilenceRate = Math.min(256.0, newMaxSilenceRate + increaseAmount);
                // 補正の強さも上げる（より積極的にカット）
                // 補正の強さは1.0を超える値も許可（上限を撤廃）
                const strengthIncrease = Math.min(diffRatio * 0.5, 0.3); // 増加量を大きく（最大0.3まで）
                newCorrectionStrength = newCorrectionStrength + strengthIncrease; // 上限チェックを削除（1.0を超える値も許可）
                // 補正の強さの表示値は1.0に制限（UI表示用）
                const displayStrength = Math.min(newCorrectionStrength, 1.0);
                if (this.silenceCorrectionStrengthSlider) {
                    this.silenceCorrectionStrengthSlider.value = displayStrength.toFixed(2);
                }
                if (this.silenceCorrectionStrengthValue) {
                    // 1.0を超える場合は「1.0+」と表示
                    if (newCorrectionStrength > 1.0) {
                        this.silenceCorrectionStrengthValue.textContent = `1.0+ (${newCorrectionStrength.toFixed(2)})`;
                    } else {
                        this.silenceCorrectionStrengthValue.textContent = newCorrectionStrength.toFixed(2);
                    }
                }
                this.showStatus(`補正中... (${(iteration + 1)}/${maxIterations}) 最大再生レート倍率と補正の強さを上げています`, 'info');
            } else {
                // 目標より短い場合：再生レート倍率を下げる、または補正の強さを下げる（より多く無音部分を保持）
                // ただし、無音部分が少ない場合は調整できないため、再生レート倍率と補正の強さを下げるだけで対処
                // 差が大きいほど大きく下げる
                const decreaseAmount = Math.min(Math.abs(diffRatio) * 0.8, 0.5); // 最大0.5まで下げる
                newMinSilenceRate = Math.max(1.0, newMinSilenceRate - decreaseAmount);
                newMaxSilenceRate = Math.max(newMinSilenceRate, newMaxSilenceRate - decreaseAmount);
                // 補正の強さも下げる（より控えめにカット）
                const strengthDecrease = Math.min(Math.abs(diffRatio) * 0.3, 0.2); // 最大0.2まで下げる
                newCorrectionStrength = Math.max(0.0, newCorrectionStrength - strengthDecrease);
                this.showStatus(`補正中... (${(iteration + 1)}/${maxIterations}) 再生レート倍率と補正の強さを下げています`, 'info');
            }

            // 再生レート倍率の範囲をチェック
            if (newMinSilenceRate >= newMaxSilenceRate) {
                newMinSilenceRate = Math.max(1.0, newMaxSilenceRate - 0.1);
            }
            
            // 補正の強さの最小値チェック（上限は撤廃）
            newCorrectionStrength = Math.max(0.0, newCorrectionStrength);
        }

        // 最終結果を確認
        // 最終的な補正の強さと最大再生レート倍率を設定して表示を更新
        algorithm.setSilenceCorrectionStrength(newCorrectionStrength);
        algorithm.setMaxSilenceRate(newMaxSilenceRate);
        this.updateCutRatioDisplay();
        this.slowSpeech.drawWaveforms();
        if (this.slowSpeech.processedBuffer) {
            const finalDuration = this.slowSpeech.processedBuffer.duration;
            const finalDiff = Math.abs(finalDuration - targetDuration);
            if (finalDiff < tolerance) {
                this.showStatus('目標の長さに補正しました', 'success');
            } else {
                this.showStatus(`補正しました（残差: ${finalDiff.toFixed(2)}秒）`, 'info');
            }
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
        if (!this.slowSpeech.audioPlayer || !this.slowSpeech.audioPlayer.isPlaying) {
            // 再生していない場合はレベルメータをリセット
            if (this.originalLevelBar) {
                this.originalLevelBar.style.height = '0%';
            }
            if (this.processedLevelBar) {
                this.processedLevelBar.style.height = '0%';
            }
            return;
        }

        // 元波形のレベルメータを更新
        const originalLevels = this.slowSpeech.audioPlayer.getOriginalLevels();
        if (originalLevels && this.originalLevelBar) {
            // 平均レベルを計算
            let sum = 0;
            for (let i = 0; i < originalLevels.length; i++) {
                sum += originalLevels[i];
            }
            const average = sum / originalLevels.length;
            const levelPercent = (average / 255) * 100;
            this.originalLevelBar.style.height = Math.min(100, levelPercent) + '%';
        } else if (this.originalLevelBar) {
            this.originalLevelBar.style.height = '0%';
        }

        // 加工後の波形のレベルメータを更新
        const processedLevels = this.slowSpeech.audioPlayer.getProcessedLevels();
        if (processedLevels && this.processedLevelBar) {
            // 平均レベルを計算
            let sum = 0;
            for (let i = 0; i < processedLevels.length; i++) {
                sum += processedLevels[i];
            }
            const average = sum / processedLevels.length;
            const levelPercent = (average / 255) * 100;
            this.processedLevelBar.style.height = Math.min(100, levelPercent) + '%';
        } else if (this.processedLevelBar) {
            this.processedLevelBar.style.height = '0%';
        }
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = 'status ' + type;
    }
}
