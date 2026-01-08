// トラック2の加工処理クラス
class Track2Processor {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    // 再生用: フェードアウト+無音バッファ生成（オーバーラップ率分引いた位置から開始、フェードアウト、トラック1と同じサイズに）
    createFadeOutBufferWithSilence(audioBuffer, overlapRate, targetDuration, fadeSettings = null) {
        if (overlapRate === 0) {
            // オーバーラップ率0のときはトラック2を無音にする
            const sampleRate = audioBuffer.sampleRate;
            const frameCount = Math.floor(targetDuration * sampleRate);
            const numChannels = audioBuffer.numberOfChannels;
            return this.audioContext.createBuffer(numChannels, frameCount, sampleRate);
        }
        
        // createSaveBufferと同じ処理
        return this.createSaveBuffer(audioBuffer, overlapRate, targetDuration, fadeSettings);
    }

    // 保存用: トラック2の保存バッファ生成（オーバーラップ率分引いた位置から開始、フェードアウト、トラック1と同じサイズに）
    // fadeSettings: { mode: 'linear'|'log'|'exp'|'custom', controlX:number, controlY:number }
    createSaveBuffer(audioBuffer, overlapRate, targetDuration, fadeSettings = null) {
        // オーバーラップ率0の場合は無音バッファ（長さはtargetDurationに合わせる）
        if (overlapRate === 0) {
            const sampleRate = audioBuffer.sampleRate;
            const frameCount = Math.floor(targetDuration * sampleRate);
            const numChannels = audioBuffer.numberOfChannels;
            return this.audioContext.createBuffer(numChannels, frameCount, sampleRate);
        }
        
        // オーバーラップ率からカットする長さを計算（50%で半分になる）
        const cutDuration = audioBuffer.duration * (overlapRate / 100);
        const waveformStartTime = audioBuffer.duration - cutDuration;
        const waveformEndTime = audioBuffer.duration;
        const waveformDuration = waveformEndTime - waveformStartTime;
        
        // トラック1と同じサイズのバッファを作成
        const sampleRate = audioBuffer.sampleRate;
        const frameCount = Math.floor(targetDuration * sampleRate);
        const numChannels = audioBuffer.numberOfChannels;
        const newBuffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);

        const waveformStartSample = Math.floor(waveformStartTime * sampleRate);
        const waveformEndSample = Math.floor(waveformEndTime * sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);

            for (let i = 0; i < frameCount; i++) {
                const timeInOutput = i / sampleRate;
                
                if (timeInOutput < waveformDuration) {
                    // 波形の範囲内：フェードアウトを適用
                    const inputIndex = waveformStartSample + Math.floor(timeInOutput * sampleRate);
                    if (inputIndex < inputData.length && inputIndex < waveformEndSample) {
                        // フェードアウトを適用（1から0まで）
                        const fadeOutProgress = timeInOutput / waveformDuration;
                        const mode = fadeSettings && fadeSettings.mode ? fadeSettings.mode : 'log';
                        const cp = fadeSettings ? { controlX: fadeSettings.controlX, controlY: fadeSettings.controlY } : null;
                        const fadeCurve = FadeCurves.evaluate(mode, fadeOutProgress, cp, true); // フェードアウト
                        const fadeFactor = 1.0 - fadeCurve;
                        outputData[i] = inputData[inputIndex] * fadeFactor;
                    } else {
                        outputData[i] = 0;
                    }
                } else {
                    // 波形エンド後は無音
                    outputData[i] = 0;
                }
            }
        }

        return newBuffer;
    }

    // テール時間モード: 元波形の useRangeEnd 以降（右側）をテールとして利用し、先頭でフェードアウト、その後は無音
    // originalBuffer: 元波形全体
    // useRangeEnd: 利用範囲の終了位置（元波形上の時間）
    // tailTime: テール時間（秒）
    // targetDuration: 出力バッファの長さ（秒）
    // fadeSettings: { mode: 'linear'|'log'|'exp'|'custom', controlX:number, controlY:number }
    createTailTimeBuffer(originalBuffer, useRangeEnd, tailTime, targetDuration, fadeSettings = null) {
        // テール時間が0の場合は無音バッファ
        if (tailTime === 0) {
            const sampleRate = originalBuffer.sampleRate;
            const frameCount = Math.floor(targetDuration * sampleRate);
            const numChannels = originalBuffer.numberOfChannels;
            return this.audioContext.createBuffer(numChannels, frameCount, sampleRate);
        }
        
        const sampleRate = originalBuffer.sampleRate;
        const numChannels = originalBuffer.numberOfChannels;
        const frameCount = Math.floor(targetDuration * sampleRate);
        const newBuffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);

        // テール部分の開始・終了（利用範囲の右側を使用）
        const tailStartTime = useRangeEnd;
        const tailEndTime = Math.min(originalBuffer.duration, useRangeEnd + tailTime);
        const actualTailDuration = Math.max(0, tailEndTime - tailStartTime);

        // フェードアウトの長さはテール部分の実長
        const fadeOutDuration = actualTailDuration;
        const fadeOutFrameCount = Math.floor(fadeOutDuration * sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = originalBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);

            for (let i = 0; i < frameCount; i++) {
                if (i < fadeOutFrameCount) {
                    // 出力の先頭からテール時間分: 元波形の useRangeEnd 以降をフェードアウトで配置
                    const progressInTail = i / fadeOutFrameCount;
                    const tailTimePosition = tailStartTime + (progressInTail * actualTailDuration);
                    const inputIndex = Math.floor(tailTimePosition * sampleRate);

                    if (inputIndex >= 0 && inputIndex < inputData.length) {
                        const fadeOutProgress = progressInTail; // 0→1
                        const mode = fadeSettings && fadeSettings.mode ? fadeSettings.mode : 'log';
                        const cp = fadeSettings ? { controlX: fadeSettings.controlX, controlY: fadeSettings.controlY } : null;
                        const fadeCurve = FadeCurves.evaluate(mode, fadeOutProgress, cp, true); // フェードアウト
                        const fadeFactor = 1.0 - fadeCurve;
                        outputData[i] = inputData[inputIndex] * fadeFactor;
                    } else {
                        outputData[i] = 0;
                    }
                } else {
                    // フェードアウト後は無音
                    outputData[i] = 0;
                }
            }
        }

        return newBuffer;
    }
}

