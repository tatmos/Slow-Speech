// オーバーラップ率UI処理クラス
class OverlapRateController {
    constructor(loopMaker) {
        this.loopMaker = loopMaker;
        this.overlapRate = 0; // オーバーラップ率（0-50%）
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.overlapRateSlider = document.getElementById('overlap-rate');
        this.overlapRateValue = document.getElementById('overlap-rate-value');
    }

    setupEventListeners() {
        this.overlapRateSlider.addEventListener('input', (e) => this.updateOverlapRate(e));
    }

    updateOverlapRate(event) {
        this.overlapRate = parseFloat(event.target.value);
        this.loopMaker.overlapRate = this.overlapRate;
        this.updateOverlapRateValue();
        this.loopMaker.updateBuffers();
        this.loopMaker.drawWaveforms();
    }

    updateOverlapRateValue() {
        this.overlapRateValue.textContent = Math.round(this.overlapRate) + '%';
    }

    setValue(value) {
        this.overlapRate = value;
        this.loopMaker.overlapRate = value;
        this.overlapRateSlider.value = value;
        this.updateOverlapRateValue();
    }

    enable() {
        this.overlapRateSlider.disabled = false;
    }

    disable() {
        this.overlapRateSlider.disabled = true;
    }
}

