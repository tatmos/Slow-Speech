// 波形描画のコア処理
class WaveformDrawer {
    /**
     * 波形を描画
     * @param {AudioBuffer} audioBuffer - 音声バッファ
     * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
     * @param {number} waveformStartTime - 波形の開始秒
     * @param {number} waveformEndTime - 波形の終了秒
     * @param {number} displayStartTime - 表示範囲の開始秒
     * @param {number} displayEndTime - 表示範囲の終了秒
     * @param {number} width - キャンバスの幅
     * @param {number} height - キャンバスの高さ
     * @param {Object} options - オプション
     * @param {number} options.fadeInStartTime - フェードイン開始秒（オプション）
     * @param {number} options.fadeInEndTime - フェードイン終了秒（オプション）
     * @param {number} options.fadeOutStartTime - フェードアウト開始秒（オプション）
     * @param {number} options.fadeOutEndTime - フェードアウト終了秒（オプション）
     * @param {boolean} options.drawDCOffset - DCオフセットラインを描画するか（デフォルト: true）
     * @param {string} options.backgroundColor - 背景色（デフォルト: '#e0e0e0'）
     */
    static drawWaveform(audioBuffer, ctx, waveformStartTime, waveformEndTime, displayStartTime, displayEndTime, width, height, options = {}) {
        if (!audioBuffer) return;

        const {
            fadeInStartTime = null,
            fadeInEndTime = null,
            fadeOutStartTime = null,
            fadeOutEndTime = null,
            drawDCOffset = true,
            backgroundColor = '#e0e0e0'
        } = options;

        // 背景を塗りつぶす
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const trackHeight = numChannels === 2 ? height / 2 : height;

        // 表示範囲の時間スケール
        const displayDuration = displayEndTime - displayStartTime;
        const timeScale = width / displayDuration;

        // 波形の範囲をサンプルに変換
        const waveformStartSample = Math.floor(waveformStartTime * sampleRate);
        const waveformEndSample = Math.floor(waveformEndTime * sampleRate);
        const waveformDuration = waveformEndTime - waveformStartTime;

        // DCオフセットを計算して横線を描画
        if (drawDCOffset && waveformDuration > 0) {
            for (let channel = 0; channel < numChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                const yOffset = channel * trackHeight;

                // DCオフセット（平均値）を計算
                let sum = 0;
                let count = 0;
                for (let i = waveformStartSample; i < waveformEndSample && i < channelData.length; i++) {
                    sum += channelData[i];
                    count++;
                }
                const dcOffset = count > 0 ? sum / count : 0;

                // DCオフセットラインを描画（濃い緑色）
                const dcY = yOffset + (trackHeight / 2) - (dcOffset * trackHeight / 2 * 0.9);
                ctx.strokeStyle = '#006400';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                
                // 表示範囲内の波形部分のみ描画
                const dcStartX = Math.max(0, (waveformStartTime - displayStartTime) * timeScale);
                const dcEndX = Math.min(width, (waveformEndTime - displayStartTime) * timeScale);
                ctx.moveTo(dcStartX, dcY);
                ctx.lineTo(dcEndX, dcY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // 波形を描画
        if (waveformDuration > 0) {
            const waveformWidth = waveformDuration * timeScale;
            const samplesPerPixel = Math.max(1, Math.floor((waveformEndSample - waveformStartSample) / waveformWidth));

            // 表示範囲内の波形部分の描画範囲
            const drawStartX = Math.max(0, Math.floor((waveformStartTime - displayStartTime) * timeScale));
            const drawEndX = Math.min(width, Math.ceil((waveformEndTime - displayStartTime) * timeScale));

            for (let channel = 0; channel < numChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                const yOffset = channel * trackHeight;
                const centerY = yOffset + trackHeight / 2;

                ctx.strokeStyle = channel === 0 ? '#667eea' : '#764ba2';
                ctx.lineWidth = 2;
                ctx.beginPath();

                let firstPointTop = true;
                let firstPointBottom = true;

                // 上側の波形
                for (let x = drawStartX; x < drawEndX; x++) {
                    const timeInDisplay = displayStartTime + (x / timeScale);
                    const timeInWaveform = timeInDisplay - waveformStartTime;
                    const pixelStartSample = Math.floor((waveformStartTime + timeInWaveform) * sampleRate);
                    
                    if (pixelStartSample < waveformStartSample || pixelStartSample >= waveformEndSample) continue;

                    // 最大値と最小値を計算
                    let max = -Infinity;
                    let min = Infinity;
                    for (let i = 0; i < samplesPerPixel && pixelStartSample + i < channelData.length && pixelStartSample + i >= waveformStartSample; i++) {
                        const value = channelData[pixelStartSample + i];
                        if (value > max) max = value;
                        if (value < min) min = value;
                    }

                    // フェードイン/フェードアウトを適用
                    let fadeFactor = 1.0;
                    if (fadeInStartTime !== null && fadeInEndTime !== null && timeInDisplay >= fadeInStartTime && timeInDisplay < fadeInEndTime) {
                        const fadeProgress = (timeInDisplay - fadeInStartTime) / (fadeInEndTime - fadeInStartTime);
                        fadeFactor = fadeProgress;
                    } else if (fadeOutStartTime !== null && fadeOutEndTime !== null && timeInDisplay >= fadeOutStartTime && timeInDisplay < fadeOutEndTime) {
                        const fadeProgress = (timeInDisplay - fadeOutStartTime) / (fadeOutEndTime - fadeOutStartTime);
                        fadeFactor = 1.0 - fadeProgress;
                    }

                    const scaledMax = max * fadeFactor;
                    const scaledMin = min * fadeFactor;
                    const yTop = centerY - (scaledMax * trackHeight / 2 * 0.9);
                    const yBottom = centerY - (scaledMin * trackHeight / 2 * 0.9);

                    if (firstPointTop) {
                        ctx.moveTo(x, yTop);
                        firstPointTop = false;
                    } else {
                        ctx.lineTo(x, yTop);
                    }
                }

                // 下側の波形（逆順に描画）
                for (let x = drawEndX - 1; x >= drawStartX; x--) {
                    const timeInDisplay = displayStartTime + (x / timeScale);
                    const timeInWaveform = timeInDisplay - waveformStartTime;
                    const pixelStartSample = Math.floor((waveformStartTime + timeInWaveform) * sampleRate);
                    
                    if (pixelStartSample < waveformStartSample || pixelStartSample >= waveformEndSample) continue;

                    let max = -Infinity;
                    let min = Infinity;
                    for (let i = 0; i < samplesPerPixel && pixelStartSample + i < channelData.length && pixelStartSample + i >= waveformStartSample; i++) {
                        const value = channelData[pixelStartSample + i];
                        if (value > max) max = value;
                        if (value < min) min = value;
                    }

                    // フェードイン/フェードアウトを適用
                    let fadeFactor = 1.0;
                    if (fadeInStartTime !== null && fadeInEndTime !== null && timeInDisplay >= fadeInStartTime && timeInDisplay < fadeInEndTime) {
                        const fadeProgress = (timeInDisplay - fadeInStartTime) / (fadeInEndTime - fadeInStartTime);
                        fadeFactor = fadeProgress;
                    } else if (fadeOutStartTime !== null && fadeOutEndTime !== null && timeInDisplay >= fadeOutStartTime && timeInDisplay < fadeOutEndTime) {
                        const fadeProgress = (timeInDisplay - fadeOutStartTime) / (fadeOutEndTime - fadeOutStartTime);
                        fadeFactor = 1.0 - fadeProgress;
                    }

                    const scaledMin = min * fadeFactor;
                    const yBottom = centerY - (scaledMin * trackHeight / 2 * 0.9);

                    if (firstPointBottom) {
                        ctx.lineTo(x, yBottom);
                        firstPointBottom = false;
                    } else {
                        ctx.lineTo(x, yBottom);
                    }
                }

                ctx.closePath();
                ctx.stroke();
            }
        }
    }
}

