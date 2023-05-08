// @ts-nocheck

export function zoom(peaks, zoomview, event, minScale, resolution) {
    const data = zoomview._data;
    const prevWidth = data.length;
    let factor = event.wheelDelta > 0 ? 0.95 : 1.05;
    // if (zoomview._scale < 1000) factor = Math.pow(factor, 2);
    // if (zoomview._scale < 100) factor = Math.pow(factor, 2);
    // if (zoomview._scale < 10) factor = Math.pow(factor, 2);
    const currentTime = peaks.player.getCurrentTime();
    let apexTime;
    let playheadOffsetPixels = zoomview._playheadLayer.getPlayheadOffset();
    if (playheadOffsetPixels >= 0 && playheadOffsetPixels < zoomview._width) {
        apexTime = currentTime;
    } else {
        playheadOffsetPixels = Math.floor(zoomview._width / 2);
        apexTime = zoomview.pixelOffsetToTime(playheadOffsetPixels);
    }
    const w = Math.max(Math.min(prevWidth * factor, data.duration * data.sample_rate / minScale), data.duration * zoomview._width / Math.min(180, data.duration));
    let scale = Math.floor(data.duration * data.sample_rate / w);
    if (factor > 1) {
        scale = Math.floor(scale / resolution) * resolution;
    } else {
        scale = Math.ceil(scale / resolution) * resolution;
        if (scale === zoomview._scale) scale += resolution;
    }
    zoomview._resampleData({scale: scale});
    zoomview._updateWaveform(zoomview.timeToPixels(apexTime) - playheadOffsetPixels);
    zoomview._playheadLayer.zoomLevelChanged(zoomview._framOffset);
    zoomview._playheadLayer.updatePlayheadTime(currentTime);
}

export async function cacheResampledData(zoomview, nCached, step, minScale) {
    const cache = async function (i: number) {
        i = step * i;
        if (i > minScale) {
            let sourceWaveform;
            if (zoomview._waveformData.has(i - step)) {
                sourceWaveform = zoomview._waveformData.get(i - step);
            } else {
                sourceWaveform = zoomview._originalWaveformData;
            }
            zoomview._waveformData.set(i, sourceWaveform.resample({scale: i}));
            zoomview._waveformScales.push(i);
        }
    };
    await Promise.all([...Array(nCached+1).keys()].map(i => setTimeout(() => cache(i), 0)))
        .then(r => zoomview._waveformScales.sort(function (a, b) {
            return a - b;
        }));
}