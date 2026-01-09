// 波形表示レンダラー
class WaveformRenderer {
    constructor(canvas, ruler) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ruler = ruler;
        this.showRateLine = false; // 再生レートライン表示フラグ
    }

    setShowRateLine(show) {
        this.showRateLine = show;
    }

    render(audioBuffer, currentPlaybackTime = null, originalDuration = null, rateHistory = null) {
        if (!audioBuffer) return;

        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const processedDuration = audioBuffer.duration;

        // 加工後のバッファを表示
        this.drawWaveform(audioBuffer, processedDuration, width, height);
        
        // 再生レートラインを描画
        if (this.showRateLine && rateHistory && rateHistory.length > 0) {
            this.drawRateLine(rateHistory, processedDuration, width, height);
        }
        
        // 元の長さより長い場合、目的の長さ（元の長さ）の位置に縦ラインを表示
        if (originalDuration !== null && originalDuration > 0 && processedDuration > originalDuration) {
            this.drawTargetDurationLine(originalDuration, processedDuration, width, height);
        }
        
        // 再生位置ラインを描画
        if (currentPlaybackTime !== null) {
            this.drawPlaybackPosition(currentPlaybackTime, processedDuration, width, height);
        }
        
        // タイムルーラーを描画
        this.drawTimeRuler(processedDuration, width);
    }

    drawPlaybackPosition(currentTime, totalDuration, width, height) {
        if (totalDuration <= 0) return;

        const timeScale = width / totalDuration;
        const x = (currentTime % totalDuration) * timeScale;

        const ctx = this.ctx;
        ctx.strokeStyle = '#ff8c00'; // オレンジ色
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    drawTargetDurationLine(targetDuration, processedDuration, width, height) {
        if (targetDuration <= 0 || processedDuration <= 0) return;

        const timeScale = width / processedDuration;
        const x = targetDuration * timeScale;

        const ctx = this.ctx;
        // 目的の長さの位置に縦ラインを描画（赤色の点線）
        ctx.strokeStyle = '#dc3545'; // 赤色
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // 点線
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]); // 点線をリセット

        // ラベルを描画
        ctx.fillStyle = '#dc3545';
        ctx.font = '12px sans-serif';
        ctx.fillText('目標の長さ', x + 5, 15);
    }

    drawWaveform(audioBuffer, totalDuration, width, height) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, width, height);
        
        if (!audioBuffer || totalDuration <= 0) return;

        // 加工後のバッファ全体を表示
        const waveformStartTime = 0;
        const waveformEndTime = audioBuffer.duration;
        const displayStartTime = 0;
        const displayEndTime = totalDuration;

        WaveformDrawer.drawWaveform(
            audioBuffer,
            ctx,
            waveformStartTime,
            waveformEndTime,
            displayStartTime,
            displayEndTime,
            width,
            height,
            {
                drawDCOffset: true,
                backgroundColor: '#e0e0e0'
            }
        );
    }

    drawRateLine(rateHistory, totalDuration, width, height) {
        if (!rateHistory || rateHistory.length === 0 || totalDuration <= 0) return;

        const ctx = this.ctx;
        
        // 再生レートの範囲を計算
        let minRate = Infinity;
        let maxRate = -Infinity;
        for (let i = 0; i < rateHistory.length; i++) {
            if (rateHistory[i] && rateHistory[i].rate !== undefined) {
                minRate = Math.min(minRate, rateHistory[i].rate);
                maxRate = Math.max(maxRate, rateHistory[i].rate);
            }
        }
        
        // 有効なデータがない場合は描画しない
        if (minRate === Infinity || maxRate === -Infinity) return;
        
        // 1.0が真ん中になるように調整
        // 1.0からの最大偏差を計算
        const maxDeviation = Math.max(Math.abs(maxRate - 1.0), Math.abs(1.0 - minRate));
        const displayMinRate = Math.max(0, 1.0 - maxDeviation);
        const displayMaxRate = 1.0 + maxDeviation;
        
        // Y座標の計算関数（1.0が真ん中、maxRateが上、minRateが下）
        const rateToY = (rate) => {
            if (displayMaxRate === displayMinRate) return height / 2;
            const normalized = (rate - displayMinRate) / (displayMaxRate - displayMinRate);
            return height - (normalized * height); // 上下を反転（1.0が真ん中）
        };

        // 再生レートラインを描画
        ctx.strokeStyle = '#00aa00'; // 緑色
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const timeScale = width / totalDuration;
        let firstPoint = true;
        
        // サンプルを間引いて描画（パフォーマンス向上）
        const step = Math.max(1, Math.floor(rateHistory.length / width));
        
        for (let i = 0; i < rateHistory.length; i += step) {
            if (!rateHistory[i] || rateHistory[i].rate === undefined) continue;
            
            const x = rateHistory[i].time * timeScale;
            const y = rateToY(rateHistory[i].rate);
            
            if (x < 0 || x > width) continue;
            
            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // 1.0のラインを描画（真ん中）
        const centerY = height / 2;
        ctx.strokeStyle = '#0000ff'; // 青色
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // ラベルを描画
        ctx.fillStyle = '#0000ff';
        ctx.font = '12px sans-serif';
        ctx.fillText('1.0', 5, centerY - 5);
        ctx.fillStyle = '#00aa00';
        ctx.fillText(`最大: ${maxRate.toFixed(2)}`, 5, 15);
        ctx.fillText(`最小: ${minRate.toFixed(2)}`, 5, height - 5);
    }

    drawTimeRuler(totalDuration, width) {
        if (totalDuration <= 0) {
            this.ruler.innerHTML = '';
            return;
        }

        // タイムルーラーの目盛りを計算
        this.ruler.innerHTML = '';

        // 適切な目盛り間隔を計算（5秒、10秒、30秒など）
        let tickInterval = 1; // デフォルト1秒
        if (totalDuration > 60) {
            tickInterval = 10;
        } else if (totalDuration > 30) {
            tickInterval = 5;
        } else if (totalDuration > 10) {
            tickInterval = 2;
        }

        const timeScale = width / totalDuration;
        const numTicks = Math.floor(totalDuration / tickInterval) + 1;

        for (let i = 0; i < numTicks; i++) {
            const time = i * tickInterval;
            if (time > totalDuration) break;

            const x = time * timeScale;

            // 目盛り線
            const tick = document.createElement('div');
            tick.style.position = 'absolute';
            tick.style.left = x + 'px';
            tick.style.top = '0';
            tick.style.width = '1px';
            tick.style.height = '100%';
            tick.style.background = '#adb5bd';
            this.ruler.appendChild(tick);

            // 時間ラベル
            const label = document.createElement('div');
            label.style.position = 'absolute';
            label.style.left = (x + 2) + 'px';
            label.style.top = '2px';
            label.style.fontSize = '11px';
            label.style.color = '#495057';
            label.textContent = time.toFixed(1) + 's';
            this.ruler.appendChild(label);
        }
    }
}
