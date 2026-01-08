// 範囲詳細設定コントローラクラス
class RangeDetailController {
    constructor(container, startCanvas, endCanvas, startRuler, endRuler, originalWaveformViewer, loopMaker) {
        this.container = container;
        this.startCanvas = startCanvas;
        this.startCtx = startCanvas.getContext('2d');
        this.endCanvas = endCanvas;
        this.endCtx = endCanvas.getContext('2d');
        this.startRuler = startRuler;
        this.endRuler = endRuler;
        this.originalWaveformViewer = originalWaveformViewer;
        this.loopMaker = loopMaker;
        this.audioBuffer = null;
        this.startTime = 0;
        this.endTime = 0;
        this.zoomRange = 0.1; // 拡大範囲（秒）±0.1秒
        this.isDraggingStart = false;
        this.isDraggingEnd = false;
        this.bpm = 120;
        this.bpmEnabled = false;
        this.metronomeEnabled = false;
        this.timeSigNumerator = 4;
        this.timeSigDenominator = 4;
        
        this.setupEventListeners();
        this.updateCanvasSize();
    }

    setupEventListeners() {
        // 詳細設定ボタン
        const detailBtn = document.getElementById('range-detail-btn');
        const closeBtn = document.getElementById('range-detail-close');
        const startMinus01 = document.getElementById('range-detail-start-minus-01');
        const startPlus01 = document.getElementById('range-detail-start-plus-01');
        const startMinus001 = document.getElementById('range-detail-start-minus-001');
        const startPlus001 = document.getElementById('range-detail-start-plus-001');
        const startMinusSample = document.getElementById('range-detail-start-minus-sample');
        const startPlusSample = document.getElementById('range-detail-start-plus-sample');
        const endMinus01 = document.getElementById('range-detail-end-minus-01');
        const endPlus01 = document.getElementById('range-detail-end-plus-01');
        const endMinus001 = document.getElementById('range-detail-end-minus-001');
        const endPlus001 = document.getElementById('range-detail-end-plus-001');
        const startMinusBeat = document.getElementById('range-detail-start-minus-beat');
        const startPlusBeat = document.getElementById('range-detail-start-plus-beat');
        const endMinusBeat = document.getElementById('range-detail-end-minus-beat');
        const endPlusBeat = document.getElementById('range-detail-end-plus-beat');
        const endMinusSample = document.getElementById('range-detail-end-minus-sample');
        const endPlusSample = document.getElementById('range-detail-end-plus-sample');
        const bpmInput = document.getElementById('bpm-input');
        const bpmEstimateBtn = document.getElementById('bpm-estimate-btn');
        const bpmEnable = document.getElementById('bpm-enable');
        const metronomeEnable = document.getElementById('metronome-enable');
        const timesigNumInput = document.getElementById('timesig-numerator');
        const timesigDenInput = document.getElementById('timesig-denominator');
        
        if (detailBtn) {
            detailBtn.addEventListener('click', () => this.toggle());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // BPM入力
        if (bpmInput) {
            bpmInput.addEventListener('change', () => {
                const value = parseFloat(bpmInput.value);
                if (!isNaN(value) && value > 0) {
                    this.bpm = Math.max(20, Math.min(300, value));
                    bpmInput.value = this.bpm.toFixed(3);
                    this.updateBpmToAudioPlayer();
                    this.render();
                }
            });
        }

        // BPM推定
        if (bpmEstimateBtn) {
            bpmEstimateBtn.addEventListener('click', () => {
                const estimated = this.estimateBpmFromRange();
                if (estimated && bpmInput) {
                    this.bpm = estimated;
                    bpmInput.value = this.bpm.toFixed(3);
                    this.updateBpmToAudioPlayer(true);
                    this.render();
                }
            });
        }

        if (bpmEnable) {
            bpmEnable.addEventListener('change', () => {
                this.bpmEnabled = bpmEnable.checked;
                this.updateBpmToAudioPlayer(true);
                this.render();
            });
        }

        if (metronomeEnable) {
            metronomeEnable.addEventListener('change', () => {
                this.metronomeEnabled = metronomeEnable.checked;
                this.updateBpmToAudioPlayer(true);
            });
        }

        if (timesigNumInput) {
            timesigNumInput.addEventListener('change', () => {
                const value = parseInt(timesigNumInput.value, 10);
                if (!isNaN(value) && value > 0) {
                    this.timeSigNumerator = Math.max(1, Math.min(16, value));
                    timesigNumInput.value = this.timeSigNumerator.toString();
                    this.updateBpmToAudioPlayer(true);
                    this.render();
                }
            });
        }

        if (timesigDenInput) {
            timesigDenInput.addEventListener('change', () => {
                const value = parseInt(timesigDenInput.value, 10);
                if (!isNaN(value) && value > 0) {
                    this.timeSigDenominator = Math.max(1, Math.min(16, value));
                    timesigDenInput.value = this.timeSigDenominator.toString();
                    this.updateBpmToAudioPlayer(true);
                    this.render();
                }
            });
        }

        // 開始位置ボタン
        if (startMinus01) {
            startMinus01.addEventListener('click', () => this.nudge('start', -0.1));
        }
        if (startPlus01) {
            startPlus01.addEventListener('click', () => this.nudge('start', 0.1));
        }
        if (startMinus001) {
            startMinus001.addEventListener('click', () => this.nudge('start', -0.01));
        }
        if (startPlus001) {
            startPlus001.addEventListener('click', () => this.nudge('start', 0.01));
        }
        if (startMinusBeat) {
            startMinusBeat.addEventListener('click', () => this.nudgeBeat('start', -1));
        }
        if (startPlusBeat) {
            startPlusBeat.addEventListener('click', () => this.nudgeBeat('start', 1));
        }
        if (startMinusSample) {
            startMinusSample.addEventListener('click', () => this.nudgeSample('start', -1));
        }
        if (startPlusSample) {
            startPlusSample.addEventListener('click', () => this.nudgeSample('start', 1));
        }

        // 終了位置ボタン
        if (endMinus01) {
            endMinus01.addEventListener('click', () => this.nudge('end', -0.1));
        }
        if (endPlus01) {
            endPlus01.addEventListener('click', () => this.nudge('end', 0.1));
        }
        if (endMinus001) {
            endMinus001.addEventListener('click', () => this.nudge('end', -0.01));
        }
        if (endPlus001) {
            endPlus001.addEventListener('click', () => this.nudge('end', 0.01));
        }
        if (endMinusBeat) {
            endMinusBeat.addEventListener('click', () => this.nudgeBeat('end', -1));
        }
        if (endPlusBeat) {
            endPlusBeat.addEventListener('click', () => this.nudgeBeat('end', 1));
        }
        if (endMinusSample) {
            endMinusSample.addEventListener('click', () => this.nudgeSample('end', -1));
        }
        if (endPlusSample) {
            endPlusSample.addEventListener('click', () => this.nudgeSample('end', 1));
        }

        // 開始位置キャンバスのイベント
        this.startCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e, 'start'));
        this.startCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e, 'start'));
        this.startCanvas.addEventListener('mouseup', (e) => this.handleMouseUp(e, 'start'));
        this.startCanvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e, 'start'));

        // 終了位置キャンバスのイベント
        this.endCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e, 'end'));
        this.endCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e, 'end'));
        this.endCanvas.addEventListener('mouseup', (e) => this.handleMouseUp(e, 'end'));
        this.endCanvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e, 'end'));

        // タッチ操作対応
        this.startCanvas.addEventListener('touchstart', (e) => {
            if (!this.audioBuffer) return;
            const touch = e.touches[0];
            if (!touch) return;
            const wasDragging = this.isDraggingStart;
            this.handleMouseDown(touch, 'start');
            if (this.isDraggingStart && !wasDragging) {
                e.preventDefault();
            }
        }, { passive: false });

        this.startCanvas.addEventListener('touchmove', (e) => {
            if (!this.audioBuffer) return;
            const touch = e.touches[0];
            if (!touch) return;
            if (this.isDraggingStart) {
                e.preventDefault();
            }
            this.handleMouseMove(touch, 'start');
        }, { passive: false });

        this.startCanvas.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0] || e.touches[0];
            if (touch) {
                this.handleMouseUp(touch, 'start');
            } else {
                this.handleMouseUp(e, 'start');
            }
        });

        this.startCanvas.addEventListener('touchcancel', (e) => {
            this.handleMouseUp(e, 'start');
        });

        this.endCanvas.addEventListener('touchstart', (e) => {
            if (!this.audioBuffer) return;
            const touch = e.touches[0];
            if (!touch) return;
            const wasDragging = this.isDraggingEnd;
            this.handleMouseDown(touch, 'end');
            if (this.isDraggingEnd && !wasDragging) {
                e.preventDefault();
            }
        }, { passive: false });

        this.endCanvas.addEventListener('touchmove', (e) => {
            if (!this.audioBuffer) return;
            const touch = e.touches[0];
            if (!touch) return;
            if (this.isDraggingEnd) {
                e.preventDefault();
            }
            this.handleMouseMove(touch, 'end');
        }, { passive: false });

        this.endCanvas.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0] || e.touches[0];
            if (touch) {
                this.handleMouseUp(touch, 'end');
            } else {
                this.handleMouseUp(e, 'end');
            }
        });

        this.endCanvas.addEventListener('touchcancel', (e) => {
            this.handleMouseUp(e, 'end');
        });

        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.render();
        });
    }

    updateCanvasSize() {
        const startRect = this.startCanvas.getBoundingClientRect();
        this.startCanvas.width = startRect.width;
        this.startCanvas.height = startRect.height;

        const endRect = this.endCanvas.getBoundingClientRect();
        this.endCanvas.width = endRect.width;
        this.endCanvas.height = endRect.height;
    }

    setAudioBuffer(audioBuffer) {
        this.audioBuffer = audioBuffer;
        this.render();
    }

    setRange(startTime, endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.render();
    }

    show() {
        if (!this.audioBuffer) return;
        this.container.classList.remove('hidden');
        this.updateCanvasSize();
        this.render();
    }

    hide() {
        this.container.classList.add('hidden');
    }

    toggle() {
        // 現在の表示状態を確認してトグル
        if (this.container.classList.contains('hidden')) {
            this.show();
        } else {
            this.hide();
        }
    }

    handleMouseDown(e, type) {
        if (!this.audioBuffer) return;
        
        const canvas = type === 'start' ? this.startCanvas : this.endCanvas;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = canvas.width;
        
        const currentTime = type === 'start' ? this.startTime : this.endTime;
        const viewStart = currentTime - this.zoomRange;
        const viewEnd = currentTime + this.zoomRange;
        const timeScale = width / (viewEnd - viewStart);
        const markerX = (currentTime - viewStart) * timeScale;
        
        // マーカー付近をクリックした場合のみドラッグ開始
        const handleWidth = 20;
        if (Math.abs(x - markerX) < handleWidth) {
            if (type === 'start') {
                this.isDraggingStart = true;
            } else {
                this.isDraggingEnd = true;
            }
            canvas.style.cursor = 'ew-resize';
            this.lockScroll();
        }
    }

    handleMouseMove(e, type) {
        if (!this.audioBuffer) return;
        
        const isDragging = type === 'start' ? this.isDraggingStart : this.isDraggingEnd;
        if (!isDragging) return;
        
        const canvas = type === 'start' ? this.startCanvas : this.endCanvas;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = canvas.width;
        
        const currentTime = type === 'start' ? this.startTime : this.endTime;
        const viewStart = currentTime - this.zoomRange;
        const viewEnd = currentTime + this.zoomRange;
        const timeScale = width / (viewEnd - viewStart);
        
        // 新しい時間を計算
        const newTime = viewStart + (x / timeScale);
        
        // 範囲制限と開始位置/終了位置の逆転防止
        const minInterval = 0.01; // 最小間隔（秒）
        let clampedTime;
        
        if (type === 'start') {
            // 開始位置: 0以上、終了位置 - 最小間隔以下
            const minTime = 0;
            const maxTime = this.endTime - minInterval;
            clampedTime = Math.max(minTime, Math.min(maxTime, newTime));
        } else {
            // 終了位置: 開始位置 + 最小間隔以上、波形の長さ以下
            const minTime = this.startTime + minInterval;
            const maxTime = this.audioBuffer.duration;
            clampedTime = Math.max(minTime, Math.min(maxTime, newTime));
        }
        
        // 開始位置と終了位置が逆転しないように制限
        if (type === 'start') {
            this.applyClampedStartTime(clampedTime);
        } else {
            this.applyClampedEndTime(clampedTime);
        }
    }

    handleMouseUp(e, type) {
        const canvas = type === 'start' ? this.startCanvas : this.endCanvas;
        if (type === 'start') {
            this.isDraggingStart = false;
        } else {
            this.isDraggingEnd = false;
        }
        canvas.style.cursor = 'crosshair';
        this.unlockScroll();
    }

    updateBpmToAudioPlayer(shouldRestart = false) {
        if (!this.loopMaker || !this.loopMaker.audioPlayer) return;
        // BPM自体は常にセットし、メトロノーム有効時のみ使用
        if (typeof this.loopMaker.audioPlayer.setBpm === 'function') {
            this.loopMaker.audioPlayer.setBpm(this.bpm);
        } else {
            this.loopMaker.audioPlayer.bpm = this.bpm;
        }
        if (typeof this.loopMaker.audioPlayer.setTimeSignature === 'function') {
            this.loopMaker.audioPlayer.setTimeSignature(this.timeSigNumerator, this.timeSigDenominator);
        } else {
            this.loopMaker.audioPlayer.timeSigNumerator = this.timeSigNumerator;
            this.loopMaker.audioPlayer.timeSigDenominator = this.timeSigDenominator;
        }
        const enabled = this.bpmEnabled && this.metronomeEnabled;
        if (typeof this.loopMaker.audioPlayer.setMetronomeEnabled === 'function') {
            this.loopMaker.audioPlayer.setMetronomeEnabled(enabled);
        } else {
            this.loopMaker.audioPlayer.metronomeEnabled = enabled;
        }
        // 再生中なら即時反映
        if (shouldRestart && typeof this.loopMaker.restartPlaybackIfPlaying === 'function') {
            this.loopMaker.restartPlaybackIfPlaying();
        }
        // トラック波形にもラインを反映
        if (typeof this.loopMaker.drawWaveforms === 'function') {
            this.loopMaker.drawWaveforms();
        }
    }

    nudge(type, delta) {
        if (!this.audioBuffer) return;

        if (type === 'start') {
            const target = this.startTime + delta;
            const minTime = 0;
            const maxTime = this.endTime - 0.01; // 最小0.01秒の間隔
            const clamped = Math.max(minTime, Math.min(maxTime, target));
            this.applyClampedStartTime(clamped);
        } else {
            const target = this.endTime + delta;
            const minTime = this.startTime + 0.01; // 最小0.01秒の間隔
            const maxTime = this.audioBuffer.duration;
            const clamped = Math.max(minTime, Math.min(maxTime, target));
            this.applyClampedEndTime(clamped);
        }
    }

    nudgeBeat(type, beats) {
        if (!this.audioBuffer) return;
        const beatSec = this.bpm > 0 ? (60 / this.bpm) * (4 / this.timeSigDenominator) : 1.0;
        const delta = beats * beatSec;
        this.nudge(type, delta);
    }

    nudgeSample(type, samples) {
        if (!this.audioBuffer || !this.audioBuffer.sampleRate) return;
        const secPerSample = 1 / this.audioBuffer.sampleRate;
        const delta = samples * secPerSample;
        this.nudge(type, delta);
    }

    // 現在の範囲から単純な自己相関ベースでBPMを推定
    estimateBpmFromRange() {
        if (!this.audioBuffer) return null;

        const sampleRate = this.audioBuffer.sampleRate;
        const channelData = this.audioBuffer.getChannelData(0);
        if (!channelData) return null;

        const start = Math.max(0, this.startTime);
        const end = Math.min(this.audioBuffer.duration, this.endTime);
        const startSample = Math.floor(start * sampleRate);
        const endSample = Math.floor(end * sampleRate);
        let length = endSample - startSample;

        // 最低0.5秒、最大30秒に制限
        const minLen = Math.floor(sampleRate * 0.5);
        const maxLen = Math.floor(sampleRate * 30);
        if (length < minLen) {
            return null;
        }
        length = Math.min(length, maxLen);

        // エンベロープを低サンプリングで作成
        const envRate = 200; // 200Hz
        const step = Math.max(1, Math.floor(sampleRate / envRate));
        const envSize = Math.floor(length / step);
        if (envSize < 10) return null;

        const env = new Float32Array(envSize);
        let idx = 0;
        for (let i = 0; i < envSize; i++) {
            let sum = 0;
            let count = 0;
            for (let j = 0; j < step && idx < length; j++, idx++) {
                const v = channelData[startSample + idx];
                sum += Math.abs(v);
                count++;
            }
            env[i] = count > 0 ? sum / count : 0;
        }

        // 平均を引いて正規化
        let mean = 0;
        for (let i = 0; i < envSize; i++) mean += env[i];
        mean /= envSize;
        let energy = 0;
        for (let i = 0; i < envSize; i++) {
            env[i] -= mean;
            energy += env[i] * env[i];
        }
        if (energy === 0) return null;

        // 自己相関を計算してラグを探索
        const envFs = sampleRate / step;
        const minBpm = 40;
        const maxBpm = 240;
        const minLag = Math.floor(envFs * 60 / maxBpm);
        const maxLag = Math.floor(envFs * 60 / minBpm);

        let bestLag = -1;
        let bestCorr = -Infinity;
        for (let lag = minLag; lag <= maxLag; lag++) {
            let corr = 0;
            for (let i = 0; i + lag < envSize; i++) {
                corr += env[i] * env[i + lag];
            }
            if (corr > bestCorr) {
                bestCorr = corr;
                bestLag = lag;
            }
        }

        if (bestLag <= 0) return null;
        const bpm = (60 * envFs) / bestLag;
        if (!isFinite(bpm) || bpm <= 0) return null;

        // 許容範囲に丸め
        const clamped = Math.max(20, Math.min(300, bpm));
        return clamped;
    }

    applyClampedStartTime(time) {
        // 開始位置が終了位置を超えないように制限
        const minInterval = 0.01; // 最小間隔（秒）
        const minTime = 0;
        const maxTime = this.endTime - minInterval;
        const clampedTime = Math.max(minTime, Math.min(maxTime, time));
        
        this.startTime = clampedTime;
        // 元のビューアーに反映
        if (this.originalWaveformViewer) {
            this.originalWaveformViewer.setRange(this.startTime, this.endTime);
            if (this.originalWaveformViewer.onRangeChange) {
                this.originalWaveformViewer.onRangeChange(this.startTime, this.endTime);
            }
        }
        this.render();
    }

    applyClampedEndTime(time) {
        // 終了位置が開始位置を超えないように制限
        const minInterval = 0.01; // 最小間隔（秒）
        const minTime = this.startTime + minInterval;
        const maxTime = this.audioBuffer ? this.audioBuffer.duration : time;
        const clampedTime = Math.max(minTime, Math.min(maxTime, time));
        
        this.endTime = clampedTime;
        // 元のビューアーに反映
        if (this.originalWaveformViewer) {
            this.originalWaveformViewer.setRange(this.startTime, this.endTime);
            if (this.originalWaveformViewer.onRangeChange) {
                this.originalWaveformViewer.onRangeChange(this.startTime, this.endTime);
            }
        }
        this.render();
    }

    lockScroll() {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
            if (document.documentElement) {
                document.documentElement.style.overflow = 'hidden';
            }
        }
    }

    unlockScroll() {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
            if (document.documentElement) {
                document.documentElement.style.overflow = '';
            }
        }
    }

    render() {
        if (!this.audioBuffer) return;
        
        this.renderStartView();
        this.renderEndView();
        this.drawTimeRulers();
    }

    renderStartView() {
        const canvas = this.startCanvas;
        const ctx = this.startCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // クリア
        ctx.clearRect(0, 0, width, height);
        
        // 拡大範囲を計算
        const viewStart = this.startTime - this.zoomRange;
        const viewEnd = this.startTime + this.zoomRange;
        const viewDuration = viewEnd - viewStart;
        const timeScale = width / viewDuration;
        
        // 背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // 波形を描画
        WaveformDrawer.drawWaveform(
            this.audioBuffer,
            ctx,
            viewStart,
            viewEnd,
            viewStart,
            viewEnd,
            width,
            height,
            {
                drawDCOffset: true,
                backgroundColor: '#ffffff'
            }
        );
        
        // ビートラインを描画（BPM指定が有効な場合）
        if (this.bpmEnabled && this.bpm > 0) {
            // BPMは「4分音符基準」。拍子の分母によって拍の長さを補正する。
            const beatInterval = (60 / this.bpm) * (4 / this.timeSigDenominator);
            const anchor = this.startTime;
            const firstBeatIndex = Math.ceil((viewStart - anchor) / beatInterval);
            const lastBeatIndex = Math.floor((viewEnd - anchor) / beatInterval);
            for (let i = firstBeatIndex; i <= lastBeatIndex; i++) {
                const t = anchor + i * beatInterval;
                const x = (t - viewStart) * timeScale;
                const isMeasureLine = (this.timeSigNumerator > 0) ? (i % this.timeSigNumerator === 0) : false;
                ctx.strokeStyle = isMeasureLine ? '#f39c12' : '#f1c40f';
                ctx.lineWidth = isMeasureLine ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        }

        // マーカー線を描画（開始位置）
        const markerX = (this.startTime - viewStart) * timeScale;
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, height);
        ctx.stroke();
        
        // マーカーのハンドル
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(markerX, height / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // マーカーの上に三角形
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX - 6, 12);
        ctx.lineTo(markerX + 6, 12);
        ctx.closePath();
        ctx.fill();
    }

    renderEndView() {
        const canvas = this.endCanvas;
        const ctx = this.endCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // クリア
        ctx.clearRect(0, 0, width, height);
        
        // 拡大範囲を計算
        const viewStart = this.endTime - this.zoomRange;
        const viewEnd = this.endTime + this.zoomRange;
        const viewDuration = viewEnd - viewStart;
        const timeScale = width / viewDuration;
        
        // 背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // 波形を描画
        WaveformDrawer.drawWaveform(
            this.audioBuffer,
            ctx,
            viewStart,
            viewEnd,
            viewStart,
            viewEnd,
            width,
            height,
            {
                drawDCOffset: true,
                backgroundColor: '#ffffff'
            }
        );
        
        // ビートラインを描画（BPM指定が有効な場合）
        if (this.bpmEnabled && this.bpm > 0) {
            const beatInterval = (60 / this.bpm) * (4 / this.timeSigDenominator);
            const anchor = this.startTime;
            const firstBeatIndex = Math.ceil((viewStart - anchor) / beatInterval);
            const lastBeatIndex = Math.floor((viewEnd - anchor) / beatInterval);
            for (let i = firstBeatIndex; i <= lastBeatIndex; i++) {
                const t = anchor + i * beatInterval;
                const x = (t - viewStart) * timeScale;
                const isMeasureLine = (this.timeSigNumerator > 0) ? (i % this.timeSigNumerator === 0) : false;
                ctx.strokeStyle = isMeasureLine ? '#f39c12' : '#f1c40f';
                ctx.lineWidth = isMeasureLine ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        }

        // マーカー線を描画（終了位置）
        const markerX = (this.endTime - viewStart) * timeScale;
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, height);
        ctx.stroke();
        
        // マーカーのハンドル
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(markerX, height / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // マーカーの上に三角形
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX - 6, 12);
        ctx.lineTo(markerX + 6, 12);
        ctx.closePath();
        ctx.fill();
    }

    drawTimeRulers() {
        // 開始位置のルーラー
        this.drawTimeRuler(this.startRuler, this.startTime - this.zoomRange, this.startTime + this.zoomRange);
        
        // 終了位置のルーラー
        this.drawTimeRuler(this.endRuler, this.endTime - this.zoomRange, this.endTime + this.zoomRange);
    }

    drawTimeRuler(rulerElement, startTime, endTime) {
        const duration = endTime - startTime;
        const width = rulerElement.offsetWidth;
        
        // 適切な間隔を計算
        let tickInterval = 0.01; // デフォルトは0.01秒
        if (duration > 0.2) tickInterval = 0.05;
        if (duration > 0.5) tickInterval = 0.1;
        
        let html = '';
        const numTicks = Math.floor(duration / tickInterval);
        
        for (let i = 0; i <= numTicks; i++) {
            const time = startTime + (i * tickInterval);
            const x = (time - startTime) / duration * width;
            const isMajor = i % 5 === 0;
            const height = isMajor ? 20 : 10;
            const label = isMajor ? this.formatTime(time) : '';
            
            html += `<div class="ruler-tick" style="left: ${x}px; height: ${height}px;">${label}</div>`;
        }
        
        rulerElement.innerHTML = html;
    }

    formatTime(seconds) {
        if (seconds < 60) {
            return seconds.toFixed(2) + 's';
        }
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${mins}:${secs.padStart(5, '0')}`;
    }
}
