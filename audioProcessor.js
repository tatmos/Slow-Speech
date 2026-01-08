// 音声処理・生成クラス（ファイル保存専用）
class AudioProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    // 元波形から指定範囲を抽出
    extractRange(audioBuffer, startTime, endTime) {
        if (!audioBuffer || startTime < 0 || endTime > audioBuffer.duration || startTime >= endTime) {
            return audioBuffer;
        }

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const rangeDuration = endTime - startTime;
        const frameCount = Math.floor(rangeDuration * sampleRate);
        
        const extractedBuffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);
        
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = extractedBuffer.getChannelData(channel);

            for (let i = 0; i < frameCount; i++) {
                const inputIndex = startSample + i;
                if (inputIndex < inputData.length && inputIndex < endSample) {
                    outputData[i] = inputData[inputIndex];
                } else {
                    outputData[i] = 0;
                }
            }
        }

        return extractedBuffer;
    }

    bufferToWav(buffer) {
        const length = buffer.length;
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2);
        const view = new DataView(arrayBuffer);
        const channels = [];

        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        // WAVヘッダー
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numChannels * 2, true);

        // データ
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                let sample = Math.max(-1, Math.min(1, channels[channel][i]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }

        return arrayBuffer;
    }

    // リサンプリング処理
    // playbackRate: 再生レート（0.7 = 0.7倍速、1.0 = 等倍、2.0 = 2倍速）
    async resample(audioBuffer, playbackRate) {
        if (!audioBuffer || playbackRate <= 0) {
            return audioBuffer;
        }

        // 再生レートが1.0の場合はそのまま返す
        if (Math.abs(playbackRate - 1.0) < 0.001) {
            return audioBuffer;
        }

        const originalSampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const originalDuration = audioBuffer.duration;
        const originalLength = audioBuffer.length;
        
        // 新しいバッファの長さを計算（再生レートが0.7の場合、長さは1/0.7倍になる）
        // 正確な長さを計算するため、元のサンプル数を基準にする
        const newLength = Math.floor(originalLength / playbackRate);
        const newSampleRate = originalSampleRate;
        const newDuration = newLength / newSampleRate;

        // 新しいバッファを作成
        const resampledBuffer = this.audioContext.createBuffer(
            numChannels,
            newLength,
            newSampleRate
        );

        // 各チャンネルをリサンプリング
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = resampledBuffer.getChannelData(channel);

            for (let i = 0; i < newLength; i++) {
                // 元のバッファでの位置を計算
                // 新しいバッファの位置iに対応する元のバッファの位置を計算
                // 新しいバッファが長いので、元のバッファの位置は i * playbackRate で計算
                const sourcePosition = i * playbackRate;
                const sourceIndex = Math.floor(sourcePosition);
                const fraction = sourcePosition - sourceIndex;

                // 線形補間
                if (sourceIndex + 1 < inputData.length) {
                    outputData[i] = inputData[sourceIndex] * (1 - fraction) + 
                                   inputData[sourceIndex + 1] * fraction;
                } else if (sourceIndex < inputData.length) {
                    outputData[i] = inputData[sourceIndex];
                } else {
                    outputData[i] = 0;
                }
            }
        }

        return resampledBuffer;
    }

    // バッファを保存
    saveBuffer(buffer, filename = 'output.wav') {
        const wav = this.bufferToWav(buffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
