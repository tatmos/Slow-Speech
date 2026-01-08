// 上部UI処理クラス
class UIController {
    constructor(loopMaker) {
        this.loopMaker = loopMaker;
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.fileInput = document.getElementById('file-input');
        this.saveBtn = document.getElementById('save-btn');
        this.playBtn = document.getElementById('play-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.status = document.getElementById('status');
        this.muteTrack1Btn = document.getElementById('mute-track1');
        this.muteTrack2Btn = document.getElementById('mute-track2');
        this.dropZone = document.getElementById('original-drop-zone');
        this.dropOverlay = document.getElementById('drop-overlay');
        this.waveformTrack1 = document.getElementById('waveform-track1');
        this.waveformTrack2 = document.getElementById('waveform-track2');
        this.filenameInput = document.getElementById('filename-input');
        this.overwriteDialog = document.getElementById('overwrite-dialog');
        this.overwriteFilename = document.getElementById('overwrite-filename');
        this.overwriteConfirmBtn = document.getElementById('overwrite-confirm');
        this.overwriteRenameBtn = document.getElementById('overwrite-rename');
        this.overwriteCancelBtn = document.getElementById('overwrite-cancel');
        
        // ミュート状態
        this.track1Muted = false;
        this.track2Muted = false;
        
        // 上書き確認ダイアログのイベントリスナー
        if (this.overwriteConfirmBtn) {
            this.overwriteConfirmBtn.addEventListener('click', () => this.handleOverwriteConfirm());
        }
        if (this.overwriteRenameBtn) {
            this.overwriteRenameBtn.addEventListener('click', () => this.handleOverwriteRename());
        }
        if (this.overwriteCancelBtn) {
            this.overwriteCancelBtn.addEventListener('click', () => this.handleOverwriteCancel());
        }
    }

    setupEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.saveBtn.addEventListener('click', () => this.saveFile());
        this.playBtn.addEventListener('click', () => this.playPreview());
        this.stopBtn.addEventListener('click', () => this.stopPreview());
        this.muteTrack1Btn.addEventListener('click', () => this.toggleMuteTrack1());
        this.muteTrack2Btn.addEventListener('click', () => this.toggleMuteTrack2());

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
            if (!this.loopMaker || !this.loopMaker.track1Buffer) return;
            if (!this.loopMaker.audioPlayer || !this.loopMaker.audioPlayer.isPlaying) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            if (width <= 0) return;

            const ratio = Math.min(1, Math.max(0, x / width));
            const duration = this.loopMaker.track1Buffer.duration;
            const targetTime = duration * ratio;

            this.loopMaker.seekTo(targetTime);
        };

        if (this.waveformTrack1) {
            this.waveformTrack1.addEventListener('click', clickHandler);
        }
        if (this.waveformTrack2) {
            this.waveformTrack2.addEventListener('click', clickHandler);
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            const isOverlapSlider = e.target.id === 'overlap-rate';
            // 入力欄にフォーカスがある場合は無視するが、オーバーラップ率スライダーだけは許可
            if (isInput && !isOverlapSlider) {
                return;
            }
            
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                this.togglePlayback();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                // フォーカスされているトラックをミュート（デフォルトはトラック1）
                this.toggleMuteTrack1();
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
            if (this.loopMaker.audioPlayer && this.loopMaker.audioPlayer.isPlaying) {
                this.loopMaker.audioPlayer.stopPreview();
                this.loopMaker.stopPlaybackAnimation();
                this.playBtn.disabled = false;
                this.stopBtn.disabled = true;
            }

            // ファイル名を保存用ファイル名に反映
            if (this.filenameInput && file && file.name) {
                const originalName = file.name;
                // 拡張子を .wav に統一（元が .wav ならそのまま）
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
            this.loopMaker.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.loopMaker.originalBuffer = await this.loopMaker.audioContext.decodeAudioData(arrayBuffer);
            
            // アルゴリズムUIを初期化
            if (this.loopMaker.updateAlgorithmUI) {
                this.loopMaker.updateAlgorithmUI();
            }
            
            // テール時間の最大値を設定（テール時間モードの場合）
            if (this.loopMaker.tailTimeController && this.loopMaker.originalBuffer && this.loopMaker.loopAlgorithm === 'tail') {
                this.loopMaker.tailTimeController.updateMaxValueForTailMode();
            }
            this.loopMaker.audioProcessor = new AudioProcessor(this.loopMaker.audioContext);
            this.loopMaker.audioPlayer = new AudioPlayer(this.loopMaker.audioContext);
            
            // アルゴリズムを初期化（audioProcessorが作成された後）
            if (this.loopMaker.initAlgorithm) {
                this.loopMaker.initAlgorithm();
            }
            
            // 元波形を表示
            if (this.loopMaker.originalWaveformViewer) {
                this.loopMaker.originalWaveformViewer.setAudioBuffer(this.loopMaker.originalBuffer);
                this.loopMaker.useRangeStart = 0;
                this.loopMaker.useRangeEnd = this.loopMaker.originalBuffer.duration;
                this.loopMaker.originalWaveformViewer.setRange(this.loopMaker.useRangeStart, this.loopMaker.useRangeEnd);
                if (this.dropOverlay) {
                    this.dropOverlay.classList.add('hidden');
                }
            }
            
            // 範囲詳細設定コントローラに設定
            if (this.loopMaker.rangeDetailController) {
                this.loopMaker.rangeDetailController.setAudioBuffer(this.loopMaker.originalBuffer);
                this.loopMaker.rangeDetailController.setRange(this.loopMaker.useRangeStart, this.loopMaker.useRangeEnd);
            }
            
            // 初期オーバーラップ率を0に設定
            if (this.loopMaker.overlapRateController) {
                this.loopMaker.overlapRateController.setValue(0);
            }
            
            // バッファを生成
            this.loopMaker.updateBuffers();
            
            this.loopMaker.drawWaveforms();
            this.enableControls();
            this.showStatus('ファイルの読み込みが完了しました', 'success');
        } catch (error) {
            this.showStatus('エラー: ' + error.message, 'error');
            console.error(error);
        }
    }

    togglePlayback() {
        if (!this.loopMaker.originalBuffer || !this.loopMaker.audioPlayer) return;
        
        if (this.loopMaker.audioPlayer.isPlaying) {
            this.stopPreview();
        } else {
            this.playPreview();
        }
    }

    async playPreview() {
        if (!this.loopMaker.originalBuffer || !this.loopMaker.audioPlayer || !this.loopMaker.track1Buffer || !this.loopMaker.track2Buffer) return;

        try {
            this.playBtn.disabled = true;
            this.stopBtn.disabled = false;

            // テールモードの場合は利用範囲の長さをループ長として使用
            const useRangeDuration = this.loopMaker.useRangeEnd - this.loopMaker.useRangeStart;
            const loopDuration = this.loopMaker.loopAlgorithm === 'tail' ? useRangeDuration : null;

            // トラック1と2の加工後のバッファを再生
            const started = this.loopMaker.audioPlayer.playPreviewWithBuffers(this.loopMaker.track1Buffer, this.loopMaker.track2Buffer, 0, loopDuration);
            if (!started) {
                // 既に再生中などで開始できなかった場合はボタン状態を元に戻す
                this.playBtn.disabled = false;
                this.stopBtn.disabled = true;
                return;
            }

            // 再生開始時点でのミュート状態を反映
            if (this.track1Muted) {
                this.loopMaker.audioPlayer.setTrack1Mute(true);
            }
            if (this.track2Muted) {
                this.loopMaker.audioPlayer.setTrack2Mute(true);
            }

            this.loopMaker.startPlaybackAnimation();
            this.showStatus('再生中...', 'info');
        } catch (error) {
            this.showStatus('再生エラー: ' + error.message, 'error');
            console.error(error);
            this.playBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }

    stopPreview() {
        if (this.loopMaker.audioPlayer) {
            this.loopMaker.audioPlayer.stopPreview();
        }
        this.loopMaker.stopPlaybackAnimation();
        this.playBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.showStatus('停止しました', 'info');
    }

    async saveFile() {
        if (!this.loopMaker.mixedBuffer || !this.loopMaker.audioProcessor) return;

        try {
            // ファイル名を取得
            let filename = this.filenameInput ? this.filenameInput.value.trim() : 'loopmaker_output.wav';
            if (!filename) {
                filename = 'loopmaker_output.wav';
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
                    
                    // ファイルが既に存在するかチェック（File System Access APIでは自動的に警告が表示される）
                    // ここでは直接保存を実行（ブラウザが同名ファイルの警告を自動表示）
                    const writable = await fileHandle.createWritable();
                    const wav = this.loopMaker.audioProcessor.bufferToWav(this.loopMaker.mixedBuffer);
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
            // ブラウザのダウンロードフォルダに同名ファイルがある場合、ブラウザが自動的に「(1)」などを付ける
            this.showStatus('ファイルを生成中...', 'info');
            this.loopMaker.audioProcessor.saveMixedBuffer(this.loopMaker.mixedBuffer, filename);
            this.showStatus('ファイルを保存しました', 'success');
        } catch (error) {
            this.showStatus('保存エラー: ' + error.message, 'error');
            console.error(error);
        }
    }

    enableControls() {
        this.saveBtn.disabled = false;
        this.playBtn.disabled = false;
        if (this.filenameInput) {
            this.filenameInput.disabled = false;
        }
        const algorithmSelect = document.getElementById('loop-algorithm');
        if (algorithmSelect) {
            algorithmSelect.disabled = false;
        }
        if (this.loopMaker.overlapRateController) {
            this.loopMaker.overlapRateController.enable();
        }
        if (this.loopMaker.tailTimeController) {
            this.loopMaker.tailTimeController.enable();
        }
        const rangeDetailBtn = document.getElementById('range-detail-btn');
        if (rangeDetailBtn) {
            rangeDetailBtn.disabled = false;
        }
    }

    showStatus(message, type = 'info') {
        this.status.textContent = message;
        this.status.className = 'status ' + type;
    }

    showOverwriteDialog(filename) {
        if (!this.overwriteDialog || !this.overwriteFilename) return;
        this.overwriteFilename.textContent = filename;
        this.overwriteDialog.classList.remove('hidden');
        this.pendingFilename = filename;
    }

    hideOverwriteDialog() {
        if (!this.overwriteDialog) return;
        this.overwriteDialog.classList.add('hidden');
        this.pendingFilename = null;
    }

    handleOverwriteConfirm() {
        if (!this.pendingFilename) return;
        this.hideOverwriteDialog();
        // 上書き保存を実行
        this.showStatus('ファイルを生成中...', 'info');
        this.loopMaker.audioProcessor.saveMixedBuffer(this.loopMaker.mixedBuffer, this.pendingFilename);
        this.showStatus('ファイルを保存しました', 'success');
    }

    handleOverwriteRename() {
        if (!this.pendingFilename) return;
        this.hideOverwriteDialog();
        // 別名で保存（File System Access APIを使用）
        if ('showSaveFilePicker' in window) {
            this.saveFileWithPicker(this.pendingFilename);
        } else {
            // 通常のダウンロード方式（ブラウザが自動的に「(1)」などを付ける）
            this.showStatus('ファイルを生成中...', 'info');
            this.loopMaker.audioProcessor.saveMixedBuffer(this.loopMaker.mixedBuffer, this.pendingFilename);
            this.showStatus('ファイルを保存しました', 'success');
        }
    }

    handleOverwriteCancel() {
        this.hideOverwriteDialog();
        this.showStatus('保存をキャンセルしました', 'info');
    }

    async saveFileWithPicker(suggestedName) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{
                    description: 'WAV files',
                    accept: { 'audio/wav': ['.wav'] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            const wav = this.loopMaker.audioProcessor.bufferToWav(this.loopMaker.mixedBuffer);
            await writable.write(wav);
            await writable.close();
            
            if (this.filenameInput) {
                this.filenameInput.value = fileHandle.name;
            }
            
            this.showStatus('ファイルを保存しました', 'success');
        } catch (error) {
            if (error.name === 'AbortError') {
                this.showStatus('保存をキャンセルしました', 'info');
            } else {
                this.showStatus('保存エラー: ' + error.message, 'error');
            }
        }
    }

    toggleMuteTrack1() {
        this.track1Muted = !this.track1Muted;
        if (this.loopMaker.audioPlayer) {
            this.loopMaker.audioPlayer.setTrack1Mute(this.track1Muted);
        }
        this.updateMuteButton(this.muteTrack1Btn, this.track1Muted);
    }

    toggleMuteTrack2() {
        this.track2Muted = !this.track2Muted;
        if (this.loopMaker.audioPlayer) {
            this.loopMaker.audioPlayer.setTrack2Mute(this.track2Muted);
        }
        this.updateMuteButton(this.muteTrack2Btn, this.track2Muted);
    }

    updateMuteButton(button, muted) {
        if (muted) {
            button.classList.add('muted');
            button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
        } else {
            button.classList.remove('muted');
            button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
        }
    }
}

