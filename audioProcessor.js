// 音声処理・生成クラス（ファイル保存専用）
class AudioProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.track1Processor = new Track1Processor(audioContext);
        this.track2Processor = new Track2Processor(audioContext);
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


    // トラック1と2をミックスしたバッファを生成
    mixBuffers(track1Buffer, track2Buffer) {
        const sampleRate = track1Buffer.sampleRate;
        const numChannels = track1Buffer.numberOfChannels;
        
        // 2つのバッファの長い方を基準にする
        const maxLength = Math.max(track1Buffer.length, track2Buffer.length);
        const mixedBuffer = this.audioContext.createBuffer(numChannels, maxLength, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const track1Data = track1Buffer.getChannelData(channel);
            const track2Data = track2Buffer.getChannelData(channel);
            const mixedData = mixedBuffer.getChannelData(channel);

            for (let i = 0; i < maxLength; i++) {
                const track1Value = i < track1Data.length ? track1Data[i] : 0;
                const track2Value = i < track2Data.length ? track2Data[i] : 0;
                // 2つのトラックをミックス（合計が1.0を超えないようにクリッピング）
                mixedData[i] = Math.max(-1, Math.min(1, track1Value + track2Value));
            }
        }

        return mixedBuffer;
    }

    // バッファを指定した長さに切り詰める
    truncateBuffer(audioBuffer, maxDuration) {
        if (!audioBuffer || maxDuration <= 0) {
            return audioBuffer;
        }

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const originalDuration = audioBuffer.duration;
        
        // 既に指定長以下の場合はそのまま返す
        if (originalDuration <= maxDuration) {
            return audioBuffer;
        }

        const frameCount = Math.floor(maxDuration * sampleRate);
        const truncatedBuffer = this.audioContext.createBuffer(numChannels, frameCount, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = truncatedBuffer.getChannelData(channel);

            for (let i = 0; i < frameCount && i < inputData.length; i++) {
                outputData[i] = inputData[i];
            }
        }

        return truncatedBuffer;
    }

    // ミックスしたバッファを保存
    saveMixedBuffer(mixedBuffer, filename = 'loopmaker_output.wav') {
        const wav = this.bufferToWav(mixedBuffer);
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

