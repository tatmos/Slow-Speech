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
    constructor(audioContext) {
        super(audioContext);
        this.rateHistory = null; // 再生レート履歴
    }

    getName() {
        return 'シンプルにリサンプル';
    }

    async process(audioBuffer, playbackRate) {
        if (!audioBuffer || playbackRate <= 0) {
            this.rateHistory = null;
            return audioBuffer;
        }

        // 再生レートが1.0の場合はそのまま返す
        if (Math.abs(playbackRate - 1.0) < 0.001) {
            this.rateHistory = null;
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

        // 再生レート履歴を初期化（基本的な再生レートで埋める）
        this.rateHistory = [];
        const sampleRate = resampledBuffer.sampleRate;
        for (let i = 0; i < newLength; i++) {
            const outputTime = i / sampleRate;
            this.rateHistory[i] = { time: outputTime, rate: playbackRate };
        }

        return resampledBuffer;
    }

    // 再生レート履歴を取得
    getRateHistory() {
        return this.rateHistory;
    }
}

// 音の長さを保つように無音をカット
class SilenceCutResampleAlgorithm extends ResampleAlgorithm {
    constructor(audioContext) {
        super(audioContext);
        this.silenceThreshold = 0.01; // 無音判定の閾値（RMS）
        this.windowSize = 1024; // 無音検出のウィンドウサイズ（サンプル数）
        this.minSilenceRate = 1.0; // 無音部分の最小再生レート倍率（ずれが小さい場合、元のレートと同じ）
        this.maxSilenceRate = 4.0; // 無音部分の最大再生レート倍率（デフォルト4.0、最大256.0まで）
        this.silenceCorrectionStrength = 0.5; // 無音区間の補正の強さ（0.0〜1.0、デフォルト0.5）
        this.rateHistory = null; // 再生レート履歴
    }

    // 無音部分の再生レート倍率を設定
    setCutRatios(minSilenceRate, maxSilenceRate) {
        this.minSilenceRate = Math.max(0.001, minSilenceRate); // 最小0.001倍
        this.maxSilenceRate = Math.max(0.001, Math.min(256.0, maxSilenceRate)); // 最小0.001倍、最大256.0倍
        // 最小が最大を超えないようにする
        if (this.minSilenceRate > this.maxSilenceRate) {
            this.minSilenceRate = this.maxSilenceRate;
        }
    }

    // 最大再生レート倍率を設定
    setMaxSilenceRate(maxSilenceRate) {
        this.maxSilenceRate = Math.max(0.001, Math.min(256.0, maxSilenceRate));
        // 最小が最大を超えないようにする
        if (this.minSilenceRate > this.maxSilenceRate) {
            this.minSilenceRate = this.maxSilenceRate;
        }
    }

    // 無音区間の補正の強さを設定（0.0〜1.0、内部的には1.0を超える値も許可可能）
    setSilenceCorrectionStrength(strength) {
        this.silenceCorrectionStrength = Math.max(0.0, strength); // 上限を撤廃（1.0を超える値も許可）
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

        // リサンプリング後の長さが目標より短い場合は、無音部分の再生レートを下げて長くする
        if (resampledLength <= targetLength) {
            // 無音部分を検出して、無音区間ごとの経過時間に基づいて再生レートを下げる
            // 無音が始まったら、その無音区間内での経過時間で再生レートを下げていく
            // 音が鳴ったら再生レートを基本再生レートに戻す
            
            // 全体の不足を計算（補正の強さを決定するため）
            const totalShortage = targetLength - resampledLength;
            // 補正の強さを全体の不足に基づいて決定
            // 不足が大きいほど補正を強く、不足が小さいほど補正をほどほどに
            const relativeShortage = targetLength > 0 ? Math.min(totalShortage / targetLength, 1.0) : 0;
            // 補正の強さ係数（不足が大きいほど大きくなる、補正の強さパラメータも考慮）
            const correctionFactor = 0.3 + (relativeShortage * 0.7) * (1.0 + this.silenceCorrectionStrength);
            
            // 先頭から順に処理して、実際に必要な出力長さを計算
            const outputDataArrays = [];
            let maxOutputLength = 0;
            
            // 再生レート履歴を初期化
            this.rateHistory = [];

            for (let channel = 0; channel < numChannels; channel++) {
                const inputData = resampledBuffer.getChannelData(channel);
                const outputData = [];
                
                let outputIndex = 0;
                let inputIndex = 0;
                let currentRate = playbackRate;

                // 先頭から順に処理
                while (inputIndex < resampledLength) {
                    // 現在位置から無音部分を検出（ウィンドウサイズ分チェック）
                    const windowEnd = Math.min(inputIndex + this.windowSize, resampledLength);
                    const isSilent = this.isSilence(inputData, inputIndex, windowEnd);

                    if (isSilent) {
                        // 無音部分を検出
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
                        
                        // 無音区間内での経過時間に基づいて再生レートを下げる
                        const segmentSize = Math.max(128, Math.floor(this.windowSize / 4));
                        let silenceProcessedSamples = 0;
                        
                        while (silenceProcessedSamples < silenceLength) {
                            const currentSegmentSize = Math.min(segmentSize, silenceLength - silenceProcessedSamples);
                            const segmentEndInSilence = silenceProcessedSamples + currentSegmentSize;
                            
                            // 無音区間内での経過時間の割合（0.0〜1.0）
                            const progressInSilence = silenceProcessedSamples / silenceLength;
                            
                            // 経過時間に基づいた非線形比率を計算（2乗してより急激に減少）
                            const progressRatio = Math.pow(progressInSilence, 1.5);
                            
                            // 補正の強さを考慮（不足が大きいほど、補正の強さが強いほど、より速く最小値に到達）
                            const adjustedProgressRatio = Math.min(progressRatio * correctionFactor, 1.0);
                            
                            // 無音部分の再生レート倍率を計算（1.0より小さい値にする）
                            // 経過時間が進むほど、より速く最小再生レート倍率に到達
                            // minSilenceRateを直接使用（既に0.001倍まで下げられている可能性がある）
                            const minRateForExtension = Math.max(0.001, this.minSilenceRate); // 最小0.001倍
                            // 1.0からminRateForExtensionまでの範囲で再生レートを下げる
                            const silenceRate = 1.0 - (adjustedProgressRatio * (1.0 - minRateForExtension));
                            currentRate = playbackRate * silenceRate; // 実際の再生レート倍率（1.0より小さい）
                            
                            // このセグメントを再生レートでリサンプリング（拡張）
                            const segmentStartIndex = silenceStartIndex + silenceProcessedSamples;
                            const segmentEndIndex = silenceStartIndex + segmentEndInSilence;
                            const segmentOutputLength = Math.floor(currentSegmentSize / silenceRate);
                            
                            // セグメントをリサンプリング
                            for (let i = 0; i < segmentOutputLength; i++) {
                                const sourcePosition = segmentStartIndex + (i / segmentOutputLength) * currentSegmentSize;
                                const sourceIndex = Math.floor(sourcePosition);
                                const fraction = sourcePosition - sourceIndex;
                                
                                if (sourceIndex + 1 < segmentEndIndex && sourceIndex + 1 < inputData.length) {
                                    // 線形補間
                                    outputData[outputIndex] = inputData[sourceIndex] * (1 - fraction) + 
                                                               inputData[sourceIndex + 1] * fraction;
                                } else if (sourceIndex < segmentEndIndex && sourceIndex < inputData.length) {
                                    outputData[outputIndex] = inputData[sourceIndex];
                                } else {
                                    outputData[outputIndex] = 0;
                                }
                                
                                // 再生レート履歴を記録（チャンネル0のみ記録）
                                if (channel === 0) {
                                    const outputTime = outputIndex / sampleRate;
                                    this.rateHistory[outputIndex] = { time: outputTime, rate: currentRate };
                                }
                                
                                outputIndex++;
                            }
                            
                            silenceProcessedSamples += currentSegmentSize;
                        }
                        
                        // 入力位置を無音部分の終わりまで進める
                        inputIndex = silenceEndIndex;
                    } else {
                        // 有音部分はそのままコピー（基本再生レートに戻す）
                        currentRate = playbackRate;
                        
                        // 再生レート履歴を記録（チャンネル0のみ記録）
                        if (channel === 0) {
                            const outputTime = outputIndex / sampleRate;
                            this.rateHistory[outputIndex] = { time: outputTime, rate: currentRate };
                        }
                        
                        outputData[outputIndex] = inputData[inputIndex];
                        outputIndex++;
                        inputIndex++;
                    }
                }

                outputDataArrays.push(outputData);
                maxOutputLength = Math.max(maxOutputLength, outputData.length);
            }

            // 出力バッファを作成（実際に必要な長さ）
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

            // 再生レート履歴を実際の出力長さに合わせて調整
            if (this.rateHistory.length > maxOutputLength) {
                this.rateHistory = this.rateHistory.slice(0, maxOutputLength);
            }
            
            return outputBuffer;
        }

        // 無音部分を検出して、無音区間ごとの経過時間に基づいて再生レートを上げる
        // 無音が始まったら、その無音区間内での経過時間で再生レートを上げていく
        // 音が鳴ったら再生レートを基本再生レートに戻す
        // 次の無音区間になったら、その無音区間での経過時間で再生レートを上げていく
        
        // 全体の遅れを計算（補正の強さを決定するため）
        const totalOffset = resampledLength - targetLength;
        // 補正の強さを全体の遅れに基づいて決定
        // 遅れが大きいほど補正を強く、遅れが小さいほど補正をほどほどに
        // 元の長さに対する遅れの相対的な割合を計算
        const relativeOffset = targetLength > 0 ? Math.min(totalOffset / targetLength, 1.0) : 0;
        // 補正の強さ係数（遅れが大きいほど大きくなる、補正の強さパラメータも考慮）
        // 遅れが大きい場合は1.0に近づき、遅れが小さい場合は0.3に近づく
        // 補正の強さパラメータが大きいほど、より強く補正
        const correctionFactor = 0.3 + (relativeOffset * 0.7) * (1.0 + this.silenceCorrectionStrength);
        
        // 先頭から順に処理して、実際に必要な出力長さを計算
        // 各チャンネルで必要な出力長さを計算するため、一時配列を使用
        const outputDataArrays = [];
        let maxOutputLength = 0;
        
        // 再生レート履歴を初期化（最大出力長さ分の配列を作成、後で実際の長さに調整）
        this.rateHistory = [];

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = resampledBuffer.getChannelData(channel);
            const outputData = [];
            
            let outputIndex = 0; // 出力バッファのインデックス（目標の長さを保つための位置）
            let inputIndex = 0; // 入力バッファのインデックス（リサンプリング後のバッファでの位置）
            let currentRate = playbackRate; // 現在の再生レート（デフォルトは基本再生レート）

            // 先頭から順に処理
            while (inputIndex < resampledLength) {
                // 現在位置から無音部分を検出（ウィンドウサイズ分チェック）
                const windowEnd = Math.min(inputIndex + this.windowSize, resampledLength);
                const isSilent = this.isSilence(inputData, inputIndex, windowEnd);

                if (isSilent) {
                    // 無音部分を検出
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
                    
                    // 無音区間内での経過時間に基づいて再生レートを上げる
                    // 無音区間を小さなセグメントに分割して処理
                    const segmentSize = Math.max(128, Math.floor(this.windowSize / 4)); // セグメントサイズ
                    let silenceProcessedSamples = 0; // 無音区間内で処理したサンプル数
                    
                    while (silenceProcessedSamples < silenceLength) {
                        // 現在のセグメントのサイズ
                        const currentSegmentSize = Math.min(segmentSize, silenceLength - silenceProcessedSamples);
                        const segmentEndInSilence = silenceProcessedSamples + currentSegmentSize;
                        
                        // 無音区間内での経過時間の割合（0.0〜1.0）
                        const progressInSilence = silenceProcessedSamples / silenceLength;
                        
                        // 経過時間に基づいた非線形比率を計算（2乗してより急激に増加）
                        const progressRatio = Math.pow(progressInSilence, 1.5);
                        
                        // 補正の強さを考慮（遅れが大きいほど、補正の強さが強いほど、より速く最大値に到達）
                        const adjustedProgressRatio = Math.min(progressRatio * correctionFactor, 1.0);
                        
                        // 無音部分の再生レート倍率を計算
                        // 経過時間が進むほど、より速く最大再生レート倍率に到達
                        const silenceRate = this.minSilenceRate + (adjustedProgressRatio * (this.maxSilenceRate - this.minSilenceRate));
                        currentRate = playbackRate * silenceRate; // 実際の再生レート倍率
                        
                        // このセグメントを再生レートでリサンプリング
                        const segmentStartIndex = silenceStartIndex + silenceProcessedSamples;
                        const segmentEndIndex = silenceStartIndex + segmentEndInSilence;
                        const segmentOutputLength = Math.floor(currentSegmentSize / silenceRate);
                        
                        // セグメントをリサンプリング
                        for (let i = 0; i < segmentOutputLength; i++) {
                            const sourcePosition = segmentStartIndex + (i / segmentOutputLength) * currentSegmentSize;
                            const sourceIndex = Math.floor(sourcePosition);
                            const fraction = sourcePosition - sourceIndex;
                            
                            if (sourceIndex + 1 < segmentEndIndex && sourceIndex + 1 < inputData.length) {
                                // 線形補間
                                outputData[outputIndex] = inputData[sourceIndex] * (1 - fraction) + 
                                                           inputData[sourceIndex + 1] * fraction;
                            } else if (sourceIndex < segmentEndIndex && sourceIndex < inputData.length) {
                                outputData[outputIndex] = inputData[sourceIndex];
                            } else {
                                outputData[outputIndex] = 0;
                            }
                            
                            // 再生レート履歴を記録（チャンネル0のみ記録）
                            if (channel === 0) {
                                const outputTime = outputIndex / sampleRate;
                                this.rateHistory[outputIndex] = { time: outputTime, rate: currentRate };
                            }
                            
                            outputIndex++;
                        }
                        
                        silenceProcessedSamples += currentSegmentSize;
                    }
                    
                    // 入力位置を無音部分の終わりまで進める
                    inputIndex = silenceEndIndex;
                } else {
                    // 有音部分はそのままコピー（基本再生レートに戻す）
                    currentRate = playbackRate;
                    
                    // 再生レート履歴を記録（チャンネル0のみ記録）
                    if (channel === 0) {
                        const outputTime = outputIndex / sampleRate;
                        this.rateHistory[outputIndex] = { time: outputTime, rate: currentRate };
                    }
                    
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

        // 再生レート履歴を実際の出力長さに合わせて調整
        if (this.rateHistory.length > maxOutputLength) {
            this.rateHistory = this.rateHistory.slice(0, maxOutputLength);
        }
        
        return outputBuffer;
    }

    // 再生レート履歴を取得
    getRateHistory() {
        return this.rateHistory;
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

