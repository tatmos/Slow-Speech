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
        
        if (this.resampleAlgorithmSelect) {
            this.resampleAlgorithmSelect.addEventListener('change', (e) => this.handleAlgorithmChange(e));
        }
        
        if (this.adjustCutRatioBtn) {
            this.adjustCutRatioBtn.addEventListener('click', () => this.adjustCutRatioToTarget());
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

            // 加工後のバッファを再生
            const started = this.slowSpeech.audioPlayer.playPreview(this.slowSpeech.processedBuffer, 0);
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
            this.playbackRateValue.textContent = rate.toFixed(2);
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
            } else {
                this.cutRatioControls.classList.add('hidden');
            }
        }
    }

    updateCutRatioDisplay() {
        if (this.slowSpeech.currentAlgorithm && 
            this.slowSpeech.currentAlgorithm instanceof SilenceCutResampleAlgorithm) {
            if (this.minCutRatioValue) {
                this.minCutRatioValue.textContent = this.slowSpeech.currentAlgorithm.minSilenceRate.toFixed(2);
            }
            if (this.maxCutRatioValue) {
                this.maxCutRatioValue.textContent = this.slowSpeech.currentAlgorithm.maxSilenceRate.toFixed(2);
            }
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
        let newMinSilenceRate = originalMinSilenceRate;
        let newMaxSilenceRate = originalMaxSilenceRate;
        const maxIterations = 5;
        const tolerance = 0.05; // 許容誤差（秒）

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // 無音部分の再生レート倍率を設定
            algorithm.setCutRatios(newMinSilenceRate, newMaxSilenceRate);
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

            // 再生レート倍率を調整
            if (durationDiff > 0) {
                // 目標より長い場合：最大再生レート倍率を上げる（無音部分をより短縮）
                // 差が大きいほど大きく上げる
                const increaseAmount = Math.min(diffRatio * 0.8, 0.5); // 最大0.5まで上げる
                newMaxSilenceRate = Math.min(4.0, newMaxSilenceRate + increaseAmount);
                this.showStatus(`補正中... (${(iteration + 1)}/${maxIterations}) 最大再生レート倍率を上げています`, 'info');
            } else {
                // 目標より短い場合：再生レート倍率を下げる（より多く無音部分を保持）
                // ただし、無音部分が少ない場合は調整できないため、再生レート倍率を下げるだけで対処
                // 差が大きいほど大きく下げる
                const decreaseAmount = Math.min(Math.abs(diffRatio) * 0.8, 0.5); // 最大0.5まで下げる
                newMinSilenceRate = Math.max(1.0, newMinSilenceRate - decreaseAmount);
                newMaxSilenceRate = Math.max(newMinSilenceRate, newMaxSilenceRate - decreaseAmount);
                this.showStatus(`補正中... (${(iteration + 1)}/${maxIterations}) 再生レート倍率を下げています`, 'info');
            }

            // 再生レート倍率の範囲をチェック
            if (newMinSilenceRate >= newMaxSilenceRate) {
                newMinSilenceRate = Math.max(1.0, newMaxSilenceRate - 0.1);
            }
        }

        // 最終結果を確認
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
        // 無音部分の再生レート倍率コントロールの表示/非表示を更新
        this.updateCutRatioControlsVisibility();
        this.updateCutRatioDisplay();
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = 'status ' + type;
    }
}
