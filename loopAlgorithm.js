// ループアルゴリズム基底クラス
class LoopAlgorithm {
    constructor(audioProcessor) {
        this.audioProcessor = audioProcessor;
    }

    /**
     * トラック1バッファを生成
     * @param {AudioBuffer} useRangeBuffer - 利用範囲バッファ
     * @param {object} params - アルゴリズム固有のパラメータ
     * @param {object} fadeSettings - フェード設定
     * @returns {AudioBuffer}
     */
    createTrack1Buffer(useRangeBuffer, params, fadeSettings) {
        throw new Error('createTrack1Buffer must be implemented by subclass');
    }

    /**
     * トラック2バッファを生成
     * @param {AudioBuffer} useRangeBuffer - 利用範囲バッファ
     * @param {number} track1Duration - トラック1の長さ
     * @param {object} params - アルゴリズム固有のパラメータ
     * @param {object} fadeSettings - フェード設定
     * @returns {AudioBuffer}
     */
    createTrack2Buffer(useRangeBuffer, track1Duration, params, fadeSettings) {
        throw new Error('createTrack2Buffer must be implemented by subclass');
    }

    /**
     * フェード範囲情報を取得（フェードUI用）
     * @param {string} track - 'track1' or 'track2'
     * @param {object} params - アルゴリズム固有のパラメータ
     * @param {number} trackDuration - トラックの長さ
     * @returns {{fadeStartX: number, fadeWidth: number}} - フェード範囲情報（0-1正規化）
     */
    getFadeRangeInfo(track, params, trackDuration) {
        throw new Error('getFadeRangeInfo must be implemented by subclass');
    }

    /**
     * レンダリングオプションを取得（波形表示用）
     * @param {object} params - アルゴリズム固有のパラメータ
     * @param {number} useRangeDuration - 利用範囲の長さ
     * @returns {object} - レンダリングオプション
     */
    getRenderOptions(params, useRangeDuration) {
        throw new Error('getRenderOptions must be implemented by subclass');
    }
}

// オーバーラップ率アルゴリズム
class OverlapRateAlgorithm extends LoopAlgorithm {
    createTrack1Buffer(useRangeBuffer, params, fadeSettings) {
        const overlapRate = params.overlapRate || 0;
        return this.audioProcessor.track1Processor.createSaveBuffer(
            useRangeBuffer,
            overlapRate,
            fadeSettings
        );
    }

    createTrack2Buffer(useRangeBuffer, track1Duration, params, fadeSettings) {
        const overlapRate = params.overlapRate || 0;
        return this.audioProcessor.track2Processor.createSaveBuffer(
            useRangeBuffer,
            overlapRate,
            track1Duration,
            fadeSettings
        );
    }

    getFadeRangeInfo(track, params, trackDuration) {
        const overlapRate = params.overlapRate || 0;
        if (overlapRate <= 0) {
            return { fadeStartX: 0, fadeWidth: 0 };
        }

        // オーバーラップ率 r(0〜50) のとき、フェード時間は元長の r% 、
        // トラック長は (100 - r)% → フェード長/トラック長 = r / (100 - r)
        const fadeWidthRatio = overlapRate / (100 - overlapRate);
        const fadeWidth = Math.min(1, Math.max(0, fadeWidthRatio));

        return {
            fadeStartX: 0, // 両方とも先頭から
            fadeWidth: fadeWidth
        };
    }

    getRenderOptions(params, useRangeDuration) {
        return {
            loopAlgorithm: 'overlap',
            showTailSection: false
        };
    }
}

// テール時間アルゴリズム
class TailTimeAlgorithm extends LoopAlgorithm {
    createTrack1Buffer(useRangeBuffer, params, fadeSettings) {
        const tailTime = params.tailTime || 0;
        const useRangeDuration = params.useRangeDuration || useRangeBuffer.duration;
        const clampedTailTime = Math.min(tailTime, useRangeDuration);
        return this.audioProcessor.track1Processor.createTailTimeBuffer(
            useRangeBuffer,
            clampedTailTime,
            fadeSettings
        );
    }

    createTrack2Buffer(useRangeBuffer, track1Duration, params, fadeSettings) {
        const tailTime = params.tailTime || 0;
        const useRangeEnd = params.useRangeEnd || 0;
        // テール時間の最大値は useRangeEnd から元波形の終端まで
        // ただし、useRangeBuffer は useRangeStart から useRangeEnd までの範囲なので、
        // 元波形全体を取得する必要がある
        // ここでは元波形全体を渡すために、loopMakerから取得する必要がある
        // ただし、このメソッドでは直接アクセスできないため、paramsから渡す
        const originalBuffer = params.originalBuffer;
        if (!originalBuffer) {
            // フォールバック: useRangeBufferを使用（後方互換性のため）
            const useRangeDuration = params.useRangeDuration || useRangeBuffer.duration;
            const clampedTailTime = Math.min(tailTime, useRangeDuration);
            return this.audioProcessor.track2Processor.createTailTimeBuffer(
                useRangeBuffer,
                0, // useRangeEndが未指定の場合は0（useRangeBufferの後半から）
                clampedTailTime,
                track1Duration,
                fadeSettings
            );
        }
        // テール時間の最大値は以下の小さい方
        // 1. トラック1の有効時間（track1Duration）
        // 2. 利用範囲エンドから元波形のエンドまでの時間
        const remainingDuration = originalBuffer.duration - useRangeEnd;
        const maxTailTime = Math.min(track1Duration, remainingDuration);
        const clampedTailTime = Math.min(tailTime, maxTailTime);
        return this.audioProcessor.track2Processor.createTailTimeBuffer(
            originalBuffer,
            useRangeEnd,
            clampedTailTime,
            track1Duration,
            fadeSettings
        );
    }

    getFadeRangeInfo(track, params, trackDuration) {
        const tailTime = params.tailTime || 0;
        if (tailTime <= 0 || trackDuration <= 0) {
            return { fadeStartX: 0, fadeWidth: 0 };
        }

        const fadeWidthRatio = Math.min(1, tailTime / trackDuration);
        const fadeWidth = Math.min(1, Math.max(0, fadeWidthRatio));

        // トラック1、トラック2ともに先頭から
        return {
            fadeStartX: 0,
            fadeWidth: fadeWidth
        };
    }

    getRenderOptions(params, useRangeDuration) {
        return {
            loopAlgorithm: 'tail',
            tailTime: params.tailTime || 0,
            useRangeDuration: useRangeDuration,
            showTailSection: true
        };
    }
}
