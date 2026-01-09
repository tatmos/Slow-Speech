// レベルメーターコンポーネント
class LevelMeter {
    constructor(elementId, audioPlayer, isOriginal = false) {
        const meterId = elementId + '-level-meter';
        const barId = elementId + '-level-bar';
        this.levelMeter = document.getElementById(meterId);
        this.levelBar = document.getElementById(barId);
        this.audioPlayer = audioPlayer;
        this.isOriginal = isOriginal;
    }

    // レベルメーターを更新
    update() {
        if (!this.audioPlayer || !this.audioPlayer.isPlaying) {
            // 再生していない場合はレベルメータをリセット
            if (this.levelBar) {
                this.levelBar.style.height = '0%';
            }
            return;
        }

        // レベルデータを取得
        const levels = this.isOriginal 
            ? this.audioPlayer.getOriginalLevels()
            : this.audioPlayer.getProcessedLevels();

        if (levels && this.levelBar) {
            // 平均レベルを計算
            let sum = 0;
            for (let i = 0; i < levels.length; i++) {
                sum += levels[i];
            }
            const average = sum / levels.length;
            const levelPercent = (average / 255) * 100;
            this.levelBar.style.height = Math.min(100, levelPercent) + '%';
        } else if (this.levelBar) {
            this.levelBar.style.height = '0%';
        }
    }

    // レベルメーターをリセット
    reset() {
        if (this.levelBar) {
            this.levelBar.style.height = '0%';
        }
    }
}
