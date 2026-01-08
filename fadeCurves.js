// フェードカーブ関数群
class FadeCurves {
    /**
     * フェード値を評価する
     * @param {string} mode - 'linear' | 'log' | 'exp' | 'custom'
     * @param {number} t - 0〜1 の正規化時間
     * @param {{controlX:number, controlY:number}|null} controlPoint
     * @param {boolean} isFadeOut - フェードアウトかどうか（デフォルト: false）
     */
    static evaluate(mode, t, controlPoint = null, isFadeOut = false) {
        const tt = Math.min(1, Math.max(0, t));

        if (mode === 'linear') {
            return tt;
        }

        if (mode === 'exp') {
            return this.exponential(tt);
        }

        if (mode === 'custom' && controlPoint) {
            return this.quadraticBezier(tt, controlPoint.controlX, controlPoint.controlY, isFadeOut);
        }

        // デフォルトはログフェード
        return this.logarithmic(tt);
    }

    // 緩やかに立ち上がるログカーブ
    static logarithmic(t) {
        const k = 4; // カーブのきつさ
        return Math.log1p(k * t) / Math.log1p(k);
    }

    // 立ち上がりが早いエクスポネンシャルカーブ
    static exponential(t) {
        const k = 4;
        const ekt = Math.exp(k * t);
        const ek = Math.exp(k);
        return (ekt - 1) / (ek - 1);
    }

    // 単一コントロールポイントを持つ2次ベジェ
    // P0 = (0,0), P1 = (cx, cy), P2 = (1,1)
    // controlXが小さい（左側）場合、アタックの立ち上がりが早くなる
    // isFadeOutがtrueの場合、フェードアウト用の動作（右側で垂直に下がる、左側で初期から垂直に下がる）
    static quadraticBezier(t, cx, cy, isFadeOut = false) {
        if (isFadeOut) {
            // フェードアウトの場合
            // 右側（controlXが大きい）→ 初期は1のままで、終盤で急に0に下がる（垂直に下がる）
            // 左側（controlXが小さい）→ 初期から急に0に下がる（垂直に下がる）
            let adjustedT = t;
            
            if (cx < 0.5) {
                // 左側（controlX < 0.5）の場合、初期から急に下がる
                // controlXが0に近いほど、初期から急に下がる（垂直に下がる）
                const leftFactor = 1 - (cx / 0.5); // 0〜1の範囲で、cxが0のとき1、0.5のとき0
                const minPower = 0.01; // 最小累乗（垂直に下がる）
                const maxPower = 1.0; // 最大累乗（通常のベジェカーブ）
                const power = maxPower - leftFactor * (maxPower - minPower);
                adjustedT = Math.pow(t, power);
            } else {
                // 右側（controlX >= 0.5）の場合、終盤で急に下がる
                // controlXが1に近いほど、終盤で急に下がる（垂直に下がる）
                const rightFactor = (cx - 0.5) / 0.5; // 0〜1の範囲で、cxが0.5のとき0、1のとき1
                // tを反転して（1-t）、それを累乗で急に下がるようにする
                const minPower = 0.01; // 最小累乗（垂直に下がる）
                const maxPower = 1.0; // 最大累乗（通常のベジェカーブ）
                const power = maxPower - rightFactor * (maxPower - minPower);
                const reversedT = 1 - t;
                adjustedT = 1 - Math.pow(reversedT, power);
            }
            
            // 調整された時間パラメータでベジェカーブを計算
            const adjustedU = 1 - adjustedT;
            const y = 2 * adjustedU * adjustedT * cy + adjustedT * adjustedT;
            return y;
        } else {
            // フェードインの場合
            // 左側（controlXが小さい）→ 初期から急に立ち上がる（垂直立ち上がり）
            // 右側（controlXが大きい）→ フェードイン終わり（終盤）で垂直に大きくなる（急に立ち上がる）
            let adjustedT = t;
            
            if (cx < 0.5) {
                // 左側（controlX < 0.5）の場合、初期の立ち上がりを急にする
                // controlXが0に近いほど、立ち上がりが急になる（垂直立ち上がりに近づく）
                const leftFactor = 1 - (cx / 0.5); // 0〜1の範囲で、cxが0のとき1、0.5のとき0
                // 初期部分をより急にするために、tを非線形に変換
                // controlXが最小値（0.1）のとき、累乗を0.01程度まで下げて垂直立ち上がりに近づける
                const minPower = 0.01; // 最小累乗（垂直立ち上がりに近い）
                const maxPower = 1.0; // 最大累乗（通常のベジェカーブ）
                const power = maxPower - leftFactor * (maxPower - minPower);
                adjustedT = Math.pow(t, power);
            } else {
                // 右側（controlX >= 0.5）の場合、終盤で急に立ち上がる
                // controlXが1に近いほど、終盤で急に立ち上がる（垂直立ち上がりに近づく）
                const rightFactor = (cx - 0.5) / 0.5; // 0〜1の範囲で、cxが0.5のとき0、1のとき1
                // tを反転して（1-t）、それを累乗で急に立ち上がるようにする
                const minPower = 0.01; // 最小累乗（垂直立ち上がりに近い）
                const maxPower = 1.0; // 最大累乗（通常のベジェカーブ）
                const power = maxPower - rightFactor * (maxPower - minPower);
                const reversedT = 1 - t;
                adjustedT = 1 - Math.pow(reversedT, power);
            }
            
            // 調整された時間パラメータでベジェカーブを計算
            const adjustedU = 1 - adjustedT;
            const y = 2 * adjustedU * adjustedT * cy + adjustedT * adjustedT;
            return y;
        }
    }
}


