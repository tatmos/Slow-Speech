// テール時間UI処理クラス
class TailTimeController {
    constructor(loopMaker) {
        this.loopMaker = loopMaker;
        this.tailTime = 0; // テール時間（秒）
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.tailTimeSlider = document.getElementById('tail-time');
        this.tailTimeValue = document.getElementById('tail-time-value');
        this.tailTimeRuler = document.getElementById('tail-time-ruler');
        this.tailTimeUI = document.getElementById('tail-time-ui');
    }

    setupEventListeners() {
        if (this.tailTimeSlider) {
            this.tailTimeSlider.addEventListener('input', (e) => this.updateTailTime(e));
        }
    }

    updateTailTime(event) {
        this.tailTime = parseFloat(event.target.value);
        this.loopMaker.tailTime = this.tailTime;
        this.updateTailTimeValue();
        this.updateRuler();
        this.loopMaker.updateBuffers();
        this.loopMaker.drawWaveforms();
    }

    updateTailTimeValue() {
        if (this.tailTimeValue) {
            this.tailTimeValue.textContent = this.tailTime.toFixed(2) + 's';
        }
    }

    updateRuler() {
        if (!this.tailTimeRuler || !this.loopMaker.originalBuffer) return;
        
        // スライダーの最大値を取得
        const sliderMax = parseFloat(this.tailTimeSlider.max);
        
        // タイムルーラーを描画（0からsliderMaxまでの範囲）
        this.drawTimeRuler(0, sliderMax, sliderMax);
    }

    drawTimeRuler(startTime, endTime, sliderMax) {
        const duration = endTime - startTime;
        const width = this.tailTimeRuler.offsetWidth;
        
        // 適切な間隔を計算
        let tickInterval = 0.01; // デフォルトは0.01秒
        if (duration > 0.2) tickInterval = 0.05;
        if (duration > 0.5) tickInterval = 0.1;
        if (duration > 1.0) tickInterval = 0.2;
        if (duration > 2.0) tickInterval = 0.5;
        if (duration > 5.0) tickInterval = 1.0;
        
        let html = '';
        const numTicks = Math.floor(duration / tickInterval);
        
        for (let i = 0; i <= numTicks; i++) {
            const time = startTime + (i * tickInterval);
            const x = (time / sliderMax) * width;
            const isMajor = i % 5 === 0;
            const height = isMajor ? 20 : 10;
            const label = isMajor ? this.formatTime(time) : '';
            
            html += `<div class="ruler-tick" style="left: ${x}px; height: ${height}px;">${label}</div>`;
        }
        
        this.tailTimeRuler.innerHTML = html;
    }

    formatTime(seconds) {
        if (seconds < 60) {
            return seconds.toFixed(2) + 's';
        }
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${mins}:${secs.padStart(5, '0')}`;
    }

    setValue(value) {
        this.tailTime = value;
        this.loopMaker.tailTime = value;
        if (this.tailTimeSlider) {
            this.tailTimeSlider.value = value;
        }
        this.updateTailTimeValue();
        this.updateRuler();
    }

    setMaxValue(maxValue) {
        if (this.tailTimeSlider) {
            this.tailTimeSlider.max = maxValue.toFixed(2);
            // 現在の値が最大値を超えている場合は調整
            if (this.tailTime > maxValue) {
                this.setValue(maxValue);
            }
        }
        this.updateRuler();
    }
    
    updateMaxValueForTailMode() {
        // テール時間モードの時のみ、最大値を以下の小さい方に設定
        // 1. トラック1の有効時間（利用範囲の長さ）
        // 2. 利用範囲エンドから元波形のエンドまでの時間
        if (this.loopMaker.loopAlgorithm !== 'tail') return;
        if (!this.loopMaker.originalBuffer) return;
        
        // トラック1の有効時間（利用範囲の長さ）
        const track1Duration = this.loopMaker.useRangeEnd - this.loopMaker.useRangeStart;
        
        // 利用範囲エンドから元波形のエンドまでの時間
        const remainingDuration = this.loopMaker.originalBuffer.duration - this.loopMaker.useRangeEnd;
        
        // 2つの値の小さい方を最大値とする
        const maxTailTime = Math.min(track1Duration, remainingDuration);
        if (maxTailTime > 0) {
            this.setMaxValue(maxTailTime);
        }
    }

    show() {
        if (this.tailTimeUI) {
            this.tailTimeUI.classList.remove('hidden');
        }
    }

    hide() {
        if (this.tailTimeUI) {
            this.tailTimeUI.classList.add('hidden');
        }
    }

    enable() {
        if (this.tailTimeSlider) {
            this.tailTimeSlider.disabled = false;
        }
    }

    disable() {
        if (this.tailTimeSlider) {
            this.tailTimeSlider.disabled = true;
        }
    }
}
