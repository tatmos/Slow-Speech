// タイムルーラーコンポーネント
class TimeRuler {
    constructor(rulerElement) {
        this.ruler = rulerElement;
    }

    // タイムルーラーを描画
    draw(totalDuration, width) {
        if (totalDuration <= 0 || !this.ruler) {
            if (this.ruler) {
                this.ruler.innerHTML = '';
            }
            return;
        }

        // タイムルーラーの目盛りを計算
        this.ruler.innerHTML = '';

        // 適切な目盛り間隔を計算
        const tickInterval = this.calculateTickInterval(totalDuration, width);
        const timeScale = width / totalDuration;

        for (let time = 0; time <= totalDuration; time += tickInterval) {
            const x = time * timeScale;

            // 目盛り線とラベル
            const tick = document.createElement('div');
            tick.className = 'ruler-tick';
            tick.style.position = 'absolute';
            tick.style.left = x + 'px';
            tick.textContent = this.formatTime(time);
            this.ruler.appendChild(tick);
        }
    }

    // 適切な目盛り間隔を計算
    calculateTickInterval(duration, width) {
        const minTickSpacing = 80; // 最小の目盛り間隔（ピクセル）
        const idealTicks = width / minTickSpacing;
        const rawInterval = duration / idealTicks;
        
        // 適切な間隔に丸める
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
        const normalized = rawInterval / magnitude;
        
        let interval;
        if (normalized < 1.5) {
            interval = magnitude;
        } else if (normalized < 3) {
            interval = 2 * magnitude;
        } else if (normalized < 7) {
            interval = 5 * magnitude;
        } else {
            interval = 10 * magnitude;
        }
        
        return interval;
    }

    // 時間をフォーマット（小数点以下第二位まで表示）
    formatTime(seconds) {
        return TimeRuler.formatTime(seconds);
    }

    // 静的メソッド：時間をフォーマット（小数点以下第二位まで表示）
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`;
    }

    // タイムルーラーをクリア
    clear() {
        if (this.ruler) {
            this.ruler.innerHTML = '';
        }
    }
}
