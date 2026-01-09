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
        this.minSilenceRate = 1.0; // 無音部分の最小再生レート倍率（ずれが小さい場合、元のレートと同じ）
        this.maxSilenceRate = 4.0; // 無音部分の最大再生レート倍率（ずれが大きい場合、元のレートの4倍まで）
    }

    // 無音部分の再生レート倍率を設定
    setCutRatios(minSilenceRate, maxSilenceRate) {
        this.minSilenceRate = Math.max(0.1, minSilenceRate); // 最小0.1倍
        this.maxSilenceRate = Math.max(0.1, Math.min(4.0, maxSilenceRate)); // 最小0.1倍、最大4.0倍
        // 最小が最大を超えないようにする
        if (this.minSilenceRate > this.maxSilenceRate) {
            this.minSilenceRate = this.maxSilenceRate;
        }
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

        // リサンプリング後の長さが目標より短い場合は、カットできないのでそのまま返す
        // （無音部分を追加することはできないため）
        if (resampledLength <= targetLength) {
            return resampledBuffer;
        }

        // 無音部分を検出して、ずれに応じて再生レートを段階的に上げる
        // 先頭から順に処理して、無音部分で再生レートを上げて元の長さに近づける
        // ずれが大きい場合は大きく、小さい場合は小さく再生レートを上げる
        
        // 先頭から順に処理して、実際に必要な出力長さを計算
        // 各チャンネルで必要な出力長さを計算するため、一時配列を使用
        const outputDataArrays = [];
        let maxOutputLength = 0;

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = resampledBuffer.getChannelData(channel);
            const outputData = [];
            
            let outputIndex = 0; // 出力バッファのインデックス（目標の長さを保つための位置）
            let inputIndex = 0; // 入力バッファのインデックス（リサンプリング後のバッファでの位置）

            // 先頭から順に処理
            while (inputIndex < resampledLength) {
                // 現在のずれを計算（元波形の本来の再生位置とのずれ）
                // 目標の位置 = outputIndex * (targetLength / resampledLength)
                // 現在の入力位置 = inputIndex
                // ずれ = inputIndex - outputIndex * (targetLength / resampledLength)
                const targetPosition = outputIndex * (targetLength / resampledLength);
                const offset = inputIndex - targetPosition;
                
                // 現在位置から無音部分を検出（ウィンドウサイズ分チェック）
                const windowEnd = Math.min(inputIndex + this.windowSize, resampledLength);
                const isSilent = this.isSilence(inputData, inputIndex, windowEnd);

                if (isSilent && offset > 0) {
                    // 無音部分を検出し、ずれがある場合
                    // 無音部分全体の終わりを検出
                    let silenceStartIndex = inputIndex;
                    let silenceEndIndex = inputIndex + this.windowSize;
                    
                    // 無音部分の終わりを検出（有音部分が始まるまで）
                    while (silenceEndIndex < resampledLength) {
                        const checkEnd = Math.min(silenceEndIndex + this.windowSize, resampledLength);
                        if (!this.isSilence(inputData, silenceEndIndex, checkEnd)) {
                            break; // 有音部分が見つかった
                        }
                        silenceEndIndex = checkEnd;
                    }
                    
                    // 無音部分の長さ
                    const silenceLength = silenceEndIndex - silenceStartIndex;
                    
                    // 現在のずれを再計算
                    const currentTargetPosition = outputIndex * (targetLength / resampledLength);
                    const currentOffset = silenceStartIndex - currentTargetPosition;
                    
                    if (currentOffset <= 0) {
                        // ずれがなくなったら、残りをコピー
                        while (inputIndex < resampledLength && outputIndex < targetLength) {
                            outputData[outputIndex] = inputData[inputIndex];
                            outputIndex++;
                            inputIndex++;
                        }
                        continue;
                    }
                    
                    // ずれに応じた再生レート倍率を計算
                    // ずれが大きいほど大きく、小さいほど小さく
                    const maxOffset = resampledLength - targetLength; // 最大ずれ
                    const offsetRatio = Math.min(currentOffset / Math.max(maxOffset, 1), 1.0);
                    
                    // 無音部分の再生レート倍率を計算
                    // ずれが大きいほど大きく、小さいほど小さく
                    // 最小再生レート倍率と最大再生レート倍率は設定可能
                    // 元の再生レートよりも高くなってもよい
                    const silenceRate = this.minSilenceRate + (offsetRatio * (this.maxSilenceRate - this.minSilenceRate));
                    
                    // 無音部分を再生レート倍率でリサンプリング（短縮）
                    // 再生レートが高いほど、出力されるサンプル数が少なくなる
                    const silenceOutputLength = Math.floor(silenceLength / silenceRate);
                    
                    // 無音部分をリサンプリング
                    for (let i = 0; i < silenceOutputLength; i++) {
                        const sourcePosition = silenceStartIndex + (i / silenceOutputLength) * silenceLength;
                        const sourceIndex = Math.floor(sourcePosition);
                        const fraction = sourcePosition - sourceIndex;
                        
                        if (sourceIndex + 1 < silenceEndIndex) {
                            // 線形補間
                            outputData[outputIndex] = inputData[sourceIndex] * (1 - fraction) + 
                                                       inputData[sourceIndex + 1] * fraction;
                        } else if (sourceIndex < silenceEndIndex) {
                            outputData[outputIndex] = inputData[sourceIndex];
                        } else {
                            outputData[outputIndex] = 0;
                        }
                        outputIndex++;
                    }
                    
                    // 入力位置を無音部分の終わりまで進める
                    inputIndex = silenceEndIndex;
                } else {
                    // 有音部分はそのままコピー
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

