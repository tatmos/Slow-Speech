// トラック1の加工処理クラス
class Track1Processor {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    // 再生用: ループバッファ生成（オーバーラップ率の分後半をカットし、フェードイン適用）
    createLoopBuffer(audioBuffer, overlapRate) {
        if (overlapRate === 0) {
            return audioBuffer;
        }
        
        // オーバーラップ率からカットする長さを計算（50%で半分になる）
        const cutDuration = audioBuffer.duration * (overlapRate / 100);
        const waveformStartTime = 0;
        const waveformEndTime = audioBuffer.duration - cutDuration;
        const waveformDuration = waveformEndTime - waveformStartTime;
        
        if (waveformDuration <= 0) {
            return audioBuffer;
        }

        const sampleRate = audioBuffer.sampleRate;
        const frameCount = Math.floor(waveformDuration * sampleRate);
        const numChannels = audioBuffer.numberOfChannels;
        const buffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);

        const waveformStartSample = Math.floor(waveformStartTime * sampleRate);
        const waveformEndSample = Math.floor(waveformEndTime * sampleRate);
        
        // フェードインの長さはオーバーラップ率の長さ
        const fadeInDuration = cutDuration;
        const fadeInFrameCount = Math.floor(fadeInDuration * sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = buffer.getChannelData(channel);

            for (let i = 0; i < frameCount; i++) {
                const inputIndex = waveformStartSample + i;
                if (inputIndex < inputData.length && inputIndex < waveformEndSample) {
                    let fadeFactor = 1.0;
                    // フェードインを適用（0からオーバーラップ率の長さ分だけ）
                    if (i < fadeInFrameCount) {
                        fadeFactor = i / fadeInFrameCount;
                    }
                    outputData[i] = inputData[inputIndex] * fadeFactor;
                } else {
                    outputData[i] = 0;
                }
            }
        }

        return buffer;
    }

    // 再生用: フェードインバッファ生成（オーバーラップ率の分後半をカットし、フェードイン適用）
    createFadeInBuffer(audioBuffer, overlapRate) {
        // createLoopBufferと同じ処理
        return this.createLoopBuffer(audioBuffer, overlapRate);
    }

    // 保存用: トラック1の保存バッファ生成（オーバーラップ率の分後半をカットし、フェードイン適用）
    // fadeSettings: { mode: 'linear'|'log'|'exp'|'custom', controlX:number, controlY:number }
    createSaveBuffer(audioBuffer, overlapRate, fadeSettings = null) {
        // オーバーラップ率が0の場合は何も処理しない
        if (overlapRate === 0) {
            return audioBuffer;
        }
        
        // オーバーラップ率からカットする長さを計算（50%で半分になる）
        const cutDuration = audioBuffer.duration * (overlapRate / 100);
        const waveformStartTime = 0;
        const waveformEndTime = audioBuffer.duration - cutDuration;
        const waveformDuration = waveformEndTime - waveformStartTime;
        
        if (waveformDuration <= 0) {
            return audioBuffer;
        }

        const sampleRate = audioBuffer.sampleRate;
        const frameCount = Math.floor(waveformDuration * sampleRate);
        const numChannels = audioBuffer.numberOfChannels;
        const newBuffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);

        const waveformStartSample = Math.floor(waveformStartTime * sampleRate);
        const waveformEndSample = Math.floor(waveformEndTime * sampleRate);

        // フェードインの長さはオーバーラップ率の長さ
        const fadeInDuration = cutDuration;
        const fadeInFrameCount = Math.floor(fadeInDuration * sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);

            for (let i = 0; i < frameCount; i++) {
                const inputIndex = waveformStartSample + i;
                if (inputIndex < inputData.length && inputIndex < waveformEndSample) {
                    let fadeFactor = 1.0;
                    // フェードインを適用（0からオーバーラップ率の長さ分だけ）
                    if (i < fadeInFrameCount) {
                        const t = i / fadeInFrameCount;
                        const mode = fadeSettings && fadeSettings.mode ? fadeSettings.mode : 'log';
                        const cp = fadeSettings ? { controlX: fadeSettings.controlX, controlY: fadeSettings.controlY } : null;
                        fadeFactor = FadeCurves.evaluate(mode, t, cp);
                    }
                    outputData[i] = inputData[inputIndex] * fadeFactor;
                } else {
                    outputData[i] = 0;
                }
            }
        }

        return newBuffer;
    }

    // テール時間モード: 利用範囲 + テール時間分のバッファを作成
    // 利用範囲部分にフェードインを適用し、テール部分は無音
    // fadeSettings: { mode: 'linear'|'log'|'exp'|'custom', controlX:number, controlY:number }
    createTailTimeBuffer(audioBuffer, tailTime, fadeSettings = null) {
        const sampleRate = audioBuffer.sampleRate;
        const waveformDuration = audioBuffer.duration; // 利用範囲の長さ
        const numChannels = audioBuffer.numberOfChannels;
        
        // バッファ長 = 利用範囲 + テール時間
        const totalDuration = waveformDuration + tailTime;
        const totalFrameCount = Math.floor(totalDuration * sampleRate);
        const newBuffer = this.audioContext.createBuffer(numChannels, totalFrameCount, sampleRate);

        // フェードインの長さはテール時間
        const fadeInDuration = Math.min(tailTime, waveformDuration);
        const fadeInFrameCount = Math.floor(fadeInDuration * sampleRate);
        
        // 利用範囲の終了位置
        const waveformFrameCount = Math.floor(waveformDuration * sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);

            for (let i = 0; i < totalFrameCount; i++) {
                if (i < waveformFrameCount && i < inputData.length) {
                    // 利用範囲内: フェードインを適用
                    let fadeFactor = 1.0;
                    if (i < fadeInFrameCount && fadeInFrameCount > 0) {
                        const t = i / fadeInFrameCount;
                        const mode = fadeSettings && fadeSettings.mode ? fadeSettings.mode : 'log';
                        const cp = fadeSettings ? { controlX: fadeSettings.controlX, controlY: fadeSettings.controlY } : null;
                        fadeFactor = FadeCurves.evaluate(mode, t, cp);
                    }
                    outputData[i] = inputData[i] * fadeFactor;
                } else {
                    // テール部分（利用範囲外）: 無音
                    outputData[i] = 0;
                }
            }
        }

        return newBuffer;
    }
}

