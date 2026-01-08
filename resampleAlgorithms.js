// リサンプリングアルゴリズムの基底クラス
class ResampleAlgorithm {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    // アルゴリズム名を返す（サブクラスで実装）
    getName() {
        throw new Error('getName() must be implemented');
    }

    // リサンプリング処理（サブクラスで実装）
    async process(audioBuffer, playbackRate) {
        throw new Error('process() must be implemented');
    }
}

// シンプルにリサンプル（現在の実装）
class SimpleResampleAlgorithm extends ResampleAlgorithm {
    getName() {
        return 'シンプルにリサンプル';
    }

    async process(audioBuffer, playbackRate) {
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
}

// 音の長さを保つように無音をカット
class SilenceCutResampleAlgorithm extends ResampleAlgorithm {
    constructor(audioContext) {
        super(audioContext);
        this.silenceThreshold = 0.01; // 無音判定の閾値（RMS）
        this.windowSize = 1024; // 無音検出のウィンドウサイズ（サンプル数）
    }

    getName() {
        return '音の長さを保つように無音をカット';
    }

    // 無音部分を検出（RMSで判定）
    isSilence(channelData, startIndex, endIndex) {
        let sumSquared = 0;
        let count = 0;
        
        for (let i = startIndex; i < endIndex && i < channelData.length; i++) {
            sumSquared += channelData[i] * channelData[i];
            count++;
        }
        
        if (count === 0) return true;
        
        const rms = Math.sqrt(sumSquared / count);
        return rms < this.silenceThreshold;
    }

    // リサンプリング後のバッファから無音部分をカットして、元の長さに近づける
    async process(audioBuffer, playbackRate) {
        if (!audioBuffer || playbackRate <= 0) {
            return audioBuffer;
        }

        // 再生レートが1.0の場合はそのまま返す
        if (Math.abs(playbackRate - 1.0) < 0.001) {
            return audioBuffer;
        }

        // まずシンプルにリサンプル
        const simpleAlgorithm = new SimpleResampleAlgorithm(this.audioContext);
        const resampledBuffer = await simpleAlgorithm.process(audioBuffer, playbackRate);

        const originalLength = audioBuffer.length;
        const targetLength = originalLength; // 目標の長さ（元の長さ）
        const resampledLength = resampledBuffer.length;
        const numChannels = resampledBuffer.numberOfChannels;
        const sampleRate = resampledBuffer.sampleRate;

        // リサンプリング後の長さが目標より短い場合は、そのまま返す
        if (resampledLength <= targetLength) {
            return resampledBuffer;
        }

        // 無音部分を検出して、カットする位置を決定
        // 先頭から順に処理して、無音部分をスキップすることで元の長さに近づける
        // ただし、無音部分が足りない場合は、元の長さより長くなっても構わない
        const cutLength = resampledLength - targetLength; // カットする必要がある長さ
        
        // 先頭から順に処理して、実際に必要な出力長さを計算
        // 各チャンネルで必要な出力長さを計算するため、一時配列を使用
        const outputDataArrays = [];
        let maxOutputLength = 0;

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = resampledBuffer.getChannelData(channel);
            const outputData = [];
            
            let outputIndex = 0; // 出力バッファのインデックス
            let inputIndex = 0; // 入力バッファのインデックス
            let cutCount = 0; // 実際にカットした長さ

            // 先頭から順に処理
            while (inputIndex < resampledLength) {
                // 残りのカットが必要な長さを計算
                const remainingCut = cutLength - cutCount;
                
                if (remainingCut <= 0) {
                    // カットが完了したら、残りをすべてコピー
                    while (inputIndex < resampledLength) {
                        outputData[outputIndex] = inputData[inputIndex];
                        outputIndex++;
                        inputIndex++;
                    }
                    break;
                }

                // 現在位置から無音部分を検出（ウィンドウサイズ分チェック）
                const windowEnd = Math.min(inputIndex + this.windowSize, resampledLength);
                const isSilent = this.isSilence(inputData, inputIndex, windowEnd);

                if (isSilent) {
                    // 無音部分をスキップ（カット）
                    // 残りのカット長さを超えないようにする
                    const skipLength = Math.min(
                        this.windowSize,
                        remainingCut,
                        resampledLength - inputIndex
                    );
                    inputIndex += skipLength;
                    cutCount += skipLength;
                } else {
                    // 有音部分はコピー
                    outputData[outputIndex] = inputData[inputIndex];
                    outputIndex++;
                    inputIndex++;
                }
            }

            outputDataArrays.push(outputData);
            maxOutputLength = Math.max(maxOutputLength, outputData.length);
        }

        // 出力バッファを作成（実際に必要な長さ）
        // 無音部分が足りない場合は、元の長さより長くなる
        const outputBuffer = this.audioContext.createBuffer(
            numChannels,
            maxOutputLength,
            sampleRate
        );

        // 各チャンネルのデータを出力バッファにコピー
        for (let channel = 0; channel < numChannels; channel++) {
            const outputData = outputBuffer.getChannelData(channel);
            const sourceData = outputDataArrays[channel];
            
            for (let i = 0; i < sourceData.length; i++) {
                outputData[i] = sourceData[i];
            }
            // 残りは0で埋める（他のチャンネルが長い場合）
            for (let i = sourceData.length; i < maxOutputLength; i++) {
                outputData[i] = 0;
            }
        }

        return outputBuffer;
    }
}

// アルゴリズムファクトリー
class ResampleAlgorithmFactory {
    static create(algorithmName, audioContext) {
        switch (algorithmName) {
            case 'simple':
                return new SimpleResampleAlgorithm(audioContext);
            case 'silence-cut':
                return new SilenceCutResampleAlgorithm(audioContext);
            default:
                return new SimpleResampleAlgorithm(audioContext);
        }
    }

    static getAvailableAlgorithms() {
        return [
            { value: 'simple', name: 'シンプルにリサンプル' },
            { value: 'silence-cut', name: '音の長さを保つように無音をカット' }
        ];
    }
}

