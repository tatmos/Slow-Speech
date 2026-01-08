// フェードカーブUIコントローラ（波形上にオーバーレイ表示）
class FadeUIController {
    /**
     * @param {LoopMaker} loopMaker
     * @param {HTMLCanvasElement} canvas1 - トラック1用フェードUIキャンバス
     * @param {HTMLCanvasElement} canvas2 - トラック2用フェードUIキャンバス
     * @param {HTMLCanvasElement} canvasOriginal - 元波形用フェードUIキャンバス
     */
    constructor(loopMaker, canvas1, canvas2, canvasOriginal) {
        this.loopMaker = loopMaker;
        this.canvas1 = canvas1;
        this.canvas2 = canvas2;
        this.canvasOriginal = canvasOriginal;
        this.ctx1 = canvas1.getContext('2d');
        this.ctx2 = canvas2.getContext('2d');
        this.ctxOriginal = canvasOriginal ? canvasOriginal.getContext('2d') : null;

        // ドラッグ状態
        this.dragging = null; // 'track1' | 'track2' | 'original-track1' | 'original-track2' | null

        this.setupEventListeners();
        this.updateCanvasSize();
    }

    lockScroll() {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
            if (document.documentElement) {
                document.documentElement.style.overflow = 'hidden';
            }
        }
    }

    unlockScroll() {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
            if (document.documentElement) {
                document.documentElement.style.overflow = '';
            }
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.render();
        });

        const handlePointerDown = (track, clientX, clientY, e) => {
            const canvas = track === 'track1' ? this.canvas1 : this.canvas2;
            const rect = canvas.getBoundingClientRect();
            const xPx = clientX - rect.left;
            const yPx = clientY - rect.top;

            // アンカー上かどうかを判定
            const onAnchor = this.isOnAnchor(track, xPx, yPx);

            if (onAnchor) {
                // フェードコントローラとして動作（アンカーのみドラッグ可能）
                const { nx, ny } = this.getNormalizedCoordinates(track, xPx, yPx, rect.width, rect.height);
                if (nx !== null && ny !== null) {
                    this.setControlPoint(track, nx, ny);
                    this.dragging = track;
                    this.lockScroll();
                    if (e) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }
            } else {
                // アンカー以外は波形クリックとして扱い、再生位置移動
                if (this.loopMaker && this.loopMaker.track1Buffer && this.loopMaker.audioPlayer && this.loopMaker.audioPlayer.isPlaying) {
                    const duration = this.loopMaker.track1Buffer.duration;
                    if (duration > 0) {
                        const ratio = Math.min(1, Math.max(0, xPx / rect.width));
                        const targetTime = duration * ratio;
                        this.loopMaker.seekTo(targetTime);
                    }
                }
            }
        };

        const handlePointerMove = (clientX, clientY) => {
            if (!this.dragging) return;
            
            // 元波形用のドラッグ処理は無効化（表示のみ）
            // トラック1、2用のドラッグ処理
            const canvas = this.dragging === 'track1' ? this.canvas1 : this.canvas2;
            const rect = canvas.getBoundingClientRect();
            const xPx = clientX - rect.left;
            const yPx = clientY - rect.top;
            
            // フェード範囲内の正規化座標を計算
            const { nx, ny } = this.getNormalizedCoordinates(this.dragging, xPx, yPx, rect.width, rect.height);
            if (nx !== null && ny !== null) {
                this.setControlPoint(this.dragging, nx, ny);
            }
        };

        const handlePointerUp = () => {
            if (this.dragging) {
                this.dragging = null;
                this.unlockScroll();
            }
        };

        // マウス
        this.canvas1.addEventListener('mousedown', (e) => handlePointerDown('track1', e.clientX, e.clientY, e));
        this.canvas2.addEventListener('mousedown', (e) => handlePointerDown('track2', e.clientX, e.clientY, e));
        
        // 元波形用のマウスイベント（オーバーラップ率モードの時のみ）
        if (this.canvasOriginal) {
            this.canvasOriginal.addEventListener('mousemove', (e) => {
                if (this.dragging === 'original-track1' || this.dragging === 'original-track2') {
                    handlePointerMove(e.clientX, e.clientY);
                }
            });
        }
        
        window.addEventListener('mousemove', (e) => {
            handlePointerMove(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', handlePointerUp);

        // タッチ（iOS対応）
        const onTouchStart = (track, e) => {
            const touch = e.touches[0];
            if (!touch) return;
            const wasDragging = this.dragging !== null;
            handlePointerDown(track, touch.clientX, touch.clientY, e);
            // ドラッグが開始された場合のみ preventDefault
            if (this.dragging !== null && !wasDragging) {
                e.preventDefault();
            }
        };

        const onTouchMove = (e) => {
            const touch = e.touches[0];
            if (!touch) return;
            // ドラッグ中のみ preventDefault
            if (this.dragging !== null) {
                e.preventDefault();
            }
            handlePointerMove(touch.clientX, touch.clientY);
        };

        const onTouchEnd = () => {
            handlePointerUp();
        };

        const onTouchCancel = () => {
            // タッチがキャンセルされた場合も確実に解除
            handlePointerUp();
        };

        this.canvas1.addEventListener('touchstart', (e) => onTouchStart('track1', e), { passive: false });
        this.canvas2.addEventListener('touchstart', (e) => onTouchStart('track2', e), { passive: false });
        
        // 元波形用のイベントリスナー（オーバーラップ率モードの時のみ有効）
        if (this.canvasOriginal) {
            this.canvasOriginal.addEventListener('mousedown', (e) => this.handleOriginalPointerDown(e));
            this.canvasOriginal.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                if (!touch) return;
                const wasDragging = this.dragging !== null;
                this.handleOriginalPointerDown(touch);
                if (this.dragging !== null && !wasDragging) {
                    e.preventDefault();
                }
            }, { passive: false });
        }
        
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchCancel);
    }
    
    handleOriginalPointerDown(e) {
        if (this.loopMaker.loopAlgorithm !== 'overlap') return;
        if (!this.loopMaker.originalBuffer) return;
        
        const canvas = this.canvasOriginal;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        const xPx = clientX - rect.left;
        const yPx = clientY - rect.top;
        
        // 元波形の時間座標を計算
        const width = canvas.offsetWidth;
        const duration = this.loopMaker.originalBuffer.duration;
        const timeAtX = (xPx / width) * duration;
        
        const useRangeStart = this.loopMaker.useRangeStart;
        const useRangeEnd = this.loopMaker.useRangeEnd;
        const overlapRate = this.loopMaker.overlapRate || 0;
        
        if (overlapRate <= 0) return;
        
        const useRangeDuration = useRangeEnd - useRangeStart;
        const overlapDuration = useRangeDuration * (overlapRate / 100);
        
        // トラック1のフェードイン範囲: 開始位置から、オーバーラップ率の長さまで
        const track1FadeStart = useRangeStart;
        const track1FadeEnd = useRangeStart + overlapDuration;
        
        // トラック2のフェードアウト範囲: 終了位置からオーバーラップ率の長さを引いた位置から、終了位置まで
        const track2FadeStart = useRangeEnd - overlapDuration;
        const track2FadeEnd = useRangeEnd;
        
        // どの範囲内にクリックされたか判定
        let track = null;
        let fadeStartTime = 0;
        let fadeEndTime = 0;
        
        if (timeAtX >= track1FadeStart && timeAtX <= track1FadeEnd) {
            track = 'original-track1';
            fadeStartTime = track1FadeStart;
            fadeEndTime = track1FadeEnd;
        } else if (timeAtX >= track2FadeStart && timeAtX <= track2FadeEnd) {
            track = 'original-track2';
            fadeStartTime = track2FadeStart;
            fadeEndTime = track2FadeEnd;
        }
        
        if (!track) {
            // フェード範囲外の場合は、元波形の範囲操作を実行できるようにする
            // フェードUIキャンバスを一時的に無効化して元波形キャンバスにイベントを伝播させる
            if (this.loopMaker.originalWaveformViewer && this.loopMaker.originalWaveformViewer.canvas) {
                // 元波形キャンバスの座標系に変換
                const originalRect = this.loopMaker.originalWaveformViewer.canvas.getBoundingClientRect();
                const originalX = clientX - originalRect.left;
                const originalY = clientY - originalRect.top;
                
                // 元波形キャンバスと同じ位置のイベントを作成
                const syntheticEvent = {
                    clientX: clientX,
                    clientY: clientY,
                    touches: e.touches || [],
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };
                this.loopMaker.originalWaveformViewer.handleMouseDown(syntheticEvent);
            }
            return;
        }
        
        // 元波形上のフェードUIは表示のみで、アンカー操作は無効化
        // フェード範囲内でも、元波形の範囲操作を実行できるようにする
        // フェードUIキャンバスを一時的に無効化して元波形キャンバスにイベントを伝播させる
        if (this.loopMaker.originalWaveformViewer && this.loopMaker.originalWaveformViewer.canvas) {
            // 元波形キャンバスの座標系に変換
            const originalRect = this.loopMaker.originalWaveformViewer.canvas.getBoundingClientRect();
            const originalX = clientX - originalRect.left;
            const originalY = clientY - originalRect.top;
            
            // 元波形キャンバスと同じ位置のイベントを作成
            const syntheticEvent = {
                clientX: clientX,
                clientY: clientY,
                touches: e.touches || [],
                preventDefault: () => {},
                stopPropagation: () => {}
            };
            this.loopMaker.originalWaveformViewer.handleMouseDown(syntheticEvent);
        }
    }
    
    isOnOriginalAnchor(track, xPx, yPx, width, height) {
        if (this.loopMaker.loopAlgorithm !== 'overlap') return false;
        if (!this.loopMaker.originalBuffer) return false;
        
        const settings = track === 'original-track1'
            ? this.loopMaker.fadeSettingsTrack1
            : this.loopMaker.fadeSettingsTrack2;
        
        if (!settings) return false;
        
        const useRangeStart = this.loopMaker.useRangeStart;
        const useRangeEnd = this.loopMaker.useRangeEnd;
        const overlapRate = this.loopMaker.overlapRate || 0;
        
        if (overlapRate <= 0) return false;
        
        const duration = this.loopMaker.originalBuffer.duration;
        const useRangeDuration = useRangeEnd - useRangeStart;
        const overlapDuration = useRangeDuration * (overlapRate / 100);
        const timeScale = width / duration;
        
        let fadeStartTime = 0;
        let fadeEndTime = 0;
        
        if (track === 'original-track1') {
            fadeStartTime = useRangeStart;
            fadeEndTime = useRangeStart + overlapDuration;
        } else {
            fadeStartTime = useRangeEnd - overlapDuration;
            fadeEndTime = useRangeEnd;
        }
        
        const fadeStartX = fadeStartTime * timeScale;
        const fadeEndX = fadeEndTime * timeScale;
        const fadeWidth = fadeEndX - fadeStartX;
        
        if (fadeWidth <= 0) return false;
        
        const mode = settings.mode;
        const cp = { controlX: settings.controlX, controlY: settings.controlY };
        
        // アンカー位置（t=0.5 のカーブ上）
        const tMid = 0.5;
        let vMid = FadeCurves.evaluate(mode, tMid, cp);
        if (track === 'original-track2') {
            // トラック2はフェードアウト表示なので反転
            vMid = 1 - vMid;
        }
        const xMid = fadeStartX + (tMid * fadeWidth);
        const yMid = (1 - vMid) * height;
        
        const dx = xPx - xMid;
        const dy = yPx - yMid;
        const distSq = dx * dx + dy * dy;
        const radius = 18; // ピクセル
        return distSq <= radius * radius;
    }
    
    setOriginalControlPoint(track, nx, ny) {
        // キャンバス座標（左上0,0）→ フェード値（x 0〜1, y 0〜1 上が1）
        const clampedX = Math.min(0.9, Math.max(0.1, nx));
        const clampedY = Math.min(0.9, Math.max(0.1, ny));
        const valueY = 1 - clampedY;
        
        if (track === 'original-track1') {
            this.loopMaker.fadeSettingsTrack1.controlX = clampedX;
            this.loopMaker.fadeSettingsTrack1.controlY = valueY;
            this.loopMaker.fadeSettingsTrack1.mode = 'custom';
        } else {
            this.loopMaker.fadeSettingsTrack2.controlX = clampedX;
            this.loopMaker.fadeSettingsTrack2.controlY = valueY;
            this.loopMaker.fadeSettingsTrack2.mode = 'custom';
        }
        
        // バッファを再生成して再描画
        this.loopMaker.updateBuffers();
        this.loopMaker.drawWaveforms();
        this.render();
    }

    updateCanvasSize() {
        [this.canvas1, this.canvas2].forEach((canvas) => {
            if (canvas) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }
        });
        if (this.canvasOriginal) {
            this.canvasOriginal.width = this.canvasOriginal.offsetWidth;
            this.canvasOriginal.height = this.canvasOriginal.offsetHeight;
        }
    }

    /**
     * キャンバス座標からフェード範囲内の正規化座標を取得
     */
    getNormalizedCoordinates(track, xPx, yPx, width, height) {
        let fadeWidth = 0;
        let fadeStartX = 0;
        
        // アルゴリズムクラスからフェード範囲情報を取得
        if (!this.loopMaker.currentAlgorithm || !this.loopMaker.track1Buffer || !this.loopMaker.track2Buffer) {
            return { nx: null, ny: null };
        }

        const trackDuration = track === 'track1' ? this.loopMaker.track1Buffer.duration : this.loopMaker.track2Buffer.duration;
        const useRangeDuration = this.loopMaker.useRangeEnd - this.loopMaker.useRangeStart;
        const params = this.loopMaker.loopAlgorithm === 'overlap' 
            ? { overlapRate: this.loopMaker.overlapRate }
            : { tailTime: this.loopMaker.tailTime, useRangeDuration: useRangeDuration };
        
        const fadeInfo = this.loopMaker.currentAlgorithm.getFadeRangeInfo(track, params, trackDuration);
        
        if (fadeInfo.fadeWidth <= 0) return { nx: null, ny: null };
        
        fadeWidth = width * fadeInfo.fadeWidth;
        fadeStartX = fadeInfo.fadeStartX * width;
        
        // フェード範囲外の場合はnullを返す
        if (xPx < fadeStartX || xPx > fadeStartX + fadeWidth) {
            return { nx: null, ny: null };
        }
        
        // フェード範囲内の正規化座標（x: 0〜1, y: 0〜1）
        const nx = (xPx - fadeStartX) / fadeWidth;
        const ny = yPx / height;
        
        return { nx, ny };
    }

    /**
     * コントロールポイント設定（0〜1正規化座標）
     */
    setControlPoint(track, nx, ny) {
        // キャンバス座標（左上0,0）→ フェード値（x 0〜1, y 0〜1 上が1）
        const clampedX = Math.min(0.9, Math.max(0.1, nx));
        const clampedY = Math.min(0.9, Math.max(0.1, ny));
        
        // フェードイン（track1）: 上にドラッグ→早く立ち上がる（controlYが大きい）
        // フェードアウト（track2）: 上にドラッグ→早くフェードアウト（controlYが大きい）
        // どちらも同じ動作にするため、フェードアウトは反転しない
        const valueY = track === 'track1' ? (1 - clampedY) : clampedY;

        if (track === 'track1') {
            this.loopMaker.fadeSettingsTrack1.controlX = clampedX;
            this.loopMaker.fadeSettingsTrack1.controlY = valueY;
            // アンカーを動かしたらカスタムカーブとして扱う
            this.loopMaker.fadeSettingsTrack1.mode = 'custom';
        } else {
            this.loopMaker.fadeSettingsTrack2.controlX = clampedX;
            this.loopMaker.fadeSettingsTrack2.controlY = valueY;
            // アンカーを動かしたらカスタムカーブとして扱う
            this.loopMaker.fadeSettingsTrack2.mode = 'custom';
        }

        // バッファを再生成して再描画
        this.loopMaker.updateBuffers();
        this.loopMaker.drawWaveforms();
        this.render();
    }

    render() {
        this.drawTrackFade(this.ctx1, this.canvas1, 'track1', true);
        this.drawTrackFade(this.ctx2, this.canvas2, 'track2', false);
        // オーバーラップ率モードまたはテール時間モードの時、元波形にフェードUIを表示
        if ((this.loopMaker.loopAlgorithm === 'overlap' || this.loopMaker.loopAlgorithm === 'tail') && this.canvasOriginal && this.ctxOriginal) {
            this.drawOriginalFade();
        } else if (this.canvasOriginal && this.ctxOriginal) {
            // その他の場合は非表示
            this.ctxOriginal.clearRect(0, 0, this.canvasOriginal.width, this.canvasOriginal.height);
            this.canvasOriginal.style.pointerEvents = 'none';
        }
    }

    /**
     * アンカー上かどうかのヒットテスト（キャンバス座標）
     */
    isOnAnchor(track, xPx, yPx) {
        const canvas = track === 'track1' ? this.canvas1 : this.canvas2;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        const settings = track === 'track1'
            ? this.loopMaker.fadeSettingsTrack1
            : this.loopMaker.fadeSettingsTrack2;

        if (!settings) return false;

        // アルゴリズムクラスからフェード範囲情報を取得
        if (!this.loopMaker.currentAlgorithm || !this.loopMaker.track1Buffer || !this.loopMaker.track2Buffer) {
            return false;
        }

        const trackDuration = track === 'track1' ? this.loopMaker.track1Buffer.duration : this.loopMaker.track2Buffer.duration;
        const useRangeDuration = this.loopMaker.useRangeEnd - this.loopMaker.useRangeStart;
        const params = this.loopMaker.loopAlgorithm === 'overlap' 
            ? { overlapRate: this.loopMaker.overlapRate }
            : { tailTime: this.loopMaker.tailTime, useRangeDuration: useRangeDuration };
        
        const fadeInfo = this.loopMaker.currentAlgorithm.getFadeRangeInfo(track, params, trackDuration);
        
        if (fadeInfo.fadeWidth <= 0) return false;
        
        const fadeWidth = width * fadeInfo.fadeWidth;
        const anchorX = fadeInfo.fadeStartX * width + (0.5 * fadeWidth);

        const mode = settings.mode;
        const cp = { controlX: settings.controlX, controlY: settings.controlY };

        // アンカー位置（t=0.5 のカーブ上）
        const tMid = 0.5;
        let vMid = FadeCurves.evaluate(mode, tMid, cp);
        if (track === 'track2') {
            // トラック2はフェードアウト表示なので反転
            vMid = 1 - vMid;
        }
        const xMid = anchorX;
        const yMid = (1 - vMid) * height;

        const dx = xPx - xMid;
        const dy = yPx - yMid;
        const distSq = dx * dx + dy * dy;
        // タッチ環境でも掴みやすいように少し大きめの半径
        const radius = 18; // ピクセル
        return distSq <= radius * radius;
    }

    drawTrackFade(ctx, canvas, track, isFadeIn) {
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, width, height);

        const settings = track === 'track1'
            ? this.loopMaker.fadeSettingsTrack1
            : this.loopMaker.fadeSettingsTrack2;

        if (!settings) return;

        // アルゴリズムクラスからフェード範囲情報を取得
        if (!this.loopMaker.currentAlgorithm || !this.loopMaker.track1Buffer || !this.loopMaker.track2Buffer) {
            return;
        }

        const trackDuration = track === 'track1' ? this.loopMaker.track1Buffer.duration : this.loopMaker.track2Buffer.duration;
        const useRangeDuration = this.loopMaker.useRangeEnd - this.loopMaker.useRangeStart;
        const params = this.loopMaker.loopAlgorithm === 'overlap' 
            ? { overlapRate: this.loopMaker.overlapRate }
            : { tailTime: this.loopMaker.tailTime, useRangeDuration: useRangeDuration };
        
        const fadeInfo = this.loopMaker.currentAlgorithm.getFadeRangeInfo(track, params, trackDuration);
        
        if (fadeInfo.fadeWidth <= 0) return;
        
        const fadeWidth = width * fadeInfo.fadeWidth;
        const fadeStartX = fadeInfo.fadeStartX * width;

        const mode = settings.mode;
        const cp = { controlX: settings.controlX, controlY: settings.controlY };

        // カーブ描画
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = track === 'track1' ? 'rgba(102, 126, 234, 0.9)' : 'rgba(118, 75, 162, 0.9)';
        ctx.beginPath();
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            let v = FadeCurves.evaluate(mode, t, cp);
            if (!isFadeIn) {
                v = 1 - v; // フェードアウトは逆カーブ
            }
            const x = fadeStartX + (t * fadeWidth);
            const y = (1 - v) * height;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // コントロールポイントを描画（カーブ上の t=0.5 相当位置）
        const tMid = 0.5;
        let vMid = FadeCurves.evaluate(mode, tMid, cp);
        if (!isFadeIn) {
            vMid = 1 - vMid;
        }
        const xMid = fadeStartX + (tMid * fadeWidth);
        const yMid = (1 - vMid) * height;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(xMid, yMid, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
    
    /**
     * 元波形用のフェードUIを描画（オーバーラップ率モードまたはテール時間モードの時）
     */
    drawOriginalFade() {
        if (this.loopMaker.loopAlgorithm !== 'overlap' && this.loopMaker.loopAlgorithm !== 'tail') return;
        if (!this.canvasOriginal || !this.ctxOriginal || !this.loopMaker.originalBuffer) return;
        
        const width = this.canvasOriginal.width = this.canvasOriginal.offsetWidth;
        const height = this.canvasOriginal.height = this.canvasOriginal.offsetHeight;
        this.ctxOriginal.clearRect(0, 0, width, height);
        
        // 元波形上のフェードUIは表示のみで、操作は無効化
        // イベントを元波形キャンバスに通すため、pointer-eventsをnoneにする
        if (this.canvasOriginal) {
            this.canvasOriginal.style.pointerEvents = 'none';
        }
        
        const duration = this.loopMaker.originalBuffer.duration;
        const useRangeStart = this.loopMaker.useRangeStart;
        const useRangeEnd = this.loopMaker.useRangeEnd;
        const timeScale = width / duration;
        
        let track1FadeStart = 0;
        let track1FadeEnd = 0;
        let track2FadeStart = 0;
        let track2FadeEnd = 0;
        
        if (this.loopMaker.loopAlgorithm === 'overlap') {
            // オーバーラップ率モード
            const overlapRate = this.loopMaker.overlapRate || 0;
            if (overlapRate <= 0) {
                // オーバーラップ率が0の場合は、フェードUIキャンバスを無効化して元波形の範囲操作を有効にする
                if (this.canvasOriginal) {
                    this.canvasOriginal.style.pointerEvents = 'none';
                }
                return;
            }
            
            const useRangeDuration = useRangeEnd - useRangeStart;
            const overlapDuration = useRangeDuration * (overlapRate / 100);
            
            // トラック1のフェードイン範囲: 開始位置から、オーバーラップ率の長さまで
            track1FadeStart = useRangeStart;
            track1FadeEnd = useRangeStart + overlapDuration;
            
            // トラック2のフェードアウト範囲: 終了位置からオーバーラップ率の長さを引いた位置から、終了位置まで
            track2FadeStart = useRangeEnd - overlapDuration;
            track2FadeEnd = useRangeEnd;
        } else if (this.loopMaker.loopAlgorithm === 'tail') {
            // テール時間モード
            const tailTime = this.loopMaker.tailTime || 0;
            if (tailTime <= 0) {
                return;
            }
            
            // トラック1のフェードイン範囲: 利用範囲の開始位置から、テール時間分の長さまで
            track1FadeStart = useRangeStart;
            track1FadeEnd = useRangeStart + tailTime;
            
            // トラック2のフェードアウト範囲: 利用範囲の終了位置から、テール時間分の長さ（元波形の終端まで）
            track2FadeStart = useRangeEnd;
            track2FadeEnd = Math.min(duration, useRangeEnd + tailTime);
        }
        
        const track1FadeStartX = track1FadeStart * timeScale;
        const track1FadeEndX = track1FadeEnd * timeScale;
        const track1FadeWidth = track1FadeEndX - track1FadeStartX;
        
        const track2FadeStartX = track2FadeStart * timeScale;
        const track2FadeEndX = track2FadeEnd * timeScale;
        const track2FadeWidth = track2FadeEndX - track2FadeStartX;
        
        if (track1FadeWidth > 0) {
            this.drawOriginalFadeCurve('original-track1', track1FadeStartX, track1FadeWidth, height, true);
        }
        
        if (track2FadeWidth > 0) {
            this.drawOriginalFadeCurve('original-track2', track2FadeStartX, track2FadeWidth, height, false);
        }
    }
    
    /**
     * 元波形用のフェードカーブを描画
     */
    drawOriginalFadeCurve(track, fadeStartX, fadeWidth, height, isFadeIn) {
        const settings = track === 'original-track1'
            ? this.loopMaker.fadeSettingsTrack1
            : this.loopMaker.fadeSettingsTrack2;
        
        if (!settings) return;
        
        const mode = settings.mode;
        const cp = { controlX: settings.controlX, controlY: settings.controlY };
        const ctx = this.ctxOriginal;
        
        // カーブ描画
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = track === 'original-track1' ? 'rgba(102, 126, 234, 0.9)' : 'rgba(118, 75, 162, 0.9)';
        ctx.beginPath();
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            let v = FadeCurves.evaluate(mode, t, cp);
            if (!isFadeIn) {
                v = 1 - v; // フェードアウトは逆カーブ
            }
            const x = fadeStartX + (t * fadeWidth);
            const y = (1 - v) * height;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // 元波形上のフェードUIは表示のみで、アンカーは非表示
        // （元波形は範囲指定が主目的のため）
        
        ctx.restore();
    }
}


