// Copyright (c) AntoineDaurat
// Distributed under the terms of the Modified BSD License.

import {MODULE_NAME, MODULE_VERSION} from './version';

// Import the CSS
import '../css/widget.css';
import {
    DOMWidgetModel,
    DOMWidgetView,
    ISerializers,
    unpack_models,
    ViewList,
} from "@jupyter-widgets/base";
import Peaks, {PeaksOptions, Segment, PeaksInstance} from 'peaks.js';

export class PeaksJSModel extends DOMWidgetModel {

    defaults() {
        return {
            ...super.defaults(),
            _model_name: PeaksJSModel.model_name,
            _model_module: PeaksJSModel.model_module,
            _model_module_version: PeaksJSModel.model_module_version,
            _view_name: PeaksJSModel.view_name,
            _view_module: PeaksJSModel.view_module,
            _view_module_version: PeaksJSModel.view_module_version,
            audio: [],
        };
    }

    static serializers: ISerializers = {
        audio: {deserialize: unpack_models},
        layout: {deserialize: unpack_models},
        ...DOMWidgetModel.serializers
    };

    static state_change: Promise<any>;

    static model_name = 'PeaksJSModel';
    static model_module = MODULE_NAME;
    static model_module_version = MODULE_VERSION;
    static view_name = 'PeaksJSView'; // Set to null if no view
    static view_module = MODULE_NAME; // Set to null if no view
    static view_module_version = MODULE_VERSION;
}

function segmentsToObjects(segments: Segment[]) {
    return segments.map(s => {
        return {
            startTime: s.startTime, endTime: s.endTime, color: s.color,
            editable: s.editable, labelText: s.labelText
        }
    })
}

export class PeaksJSView extends DOMWidgetView {
    peaks: PeaksInstance;
    views: ViewList<DOMWidgetView>;
    audio: HTMLMediaElement;
    zoomview: JQuery;
    overview: JQuery;
    playBtn: JQuery;

    initialize() {
        super.initialize(this);
        this.views = new ViewList(this.add_view, null, this);
        this.options = {};
        const _this = this;
        this.listenTo(this.model, "change:audio", (model, value) => {
            _this.views.update(value).then(r => console.log("THEN:", r));
            // @ts-ignore
        });
        this.displayed.then(() => {
            _this.init_peaks();
        })
    }

    add_view(child_model: DOMWidgetModel, index: number) {
        console.log("CHILD:", child_model);
        return this.create_child_view(child_model, {parent: this})
            .then(view => view)
            .catch(err => {
                console.log("...... err ......")
                return err
            });
    }

    segments_changed() {
        const selected = this.model.get("selected");
        const segments = this.model.get("segments")
            .filter((s: Segment, i: number) => selected.includes(i));
        this.peaks.segments.removeAll();
        this.peaks.segments.add(segments);
    }

    toggle_playing() {
        const playing = this.model.get("playing");
        if (playing) {
            this.peaks.player.play();
            this.playBtn.removeClass("fa-play").addClass("fa-pause");
        } else {
            this.peaks.player.pause();
            this.playBtn.removeClass("fa-pause").addClass("fa fa-play");
        }
    }

    init_peaks() {
        const that = this;
        const audioContext = new AudioContext();
        const segments = this.model.get("segments");
        const zoomview = $(this.zoomview)[0];
        const overview = $(this.overview)[0];
        this.views.views[0].then(a => {
            const audioElement = a.el as HTMLMediaElement;
            $(that.el).append(audioElement);
            that.audio = audioElement;
            const options: PeaksOptions = {
                zoomview: {
                    container: zoomview,
                    waveformColor: 'rgba(0,100,255,0.95)',
                    playheadColor: '#000000',
                    wheelMode: "scroll"
                },
                overview: {
                    container: overview,
                    waveformColor: 'rgba(0,100,255,0.95)',
                    playheadColor: '#000000',
                    showAxisLabels: false,
                    //                 highlightColor: "rgba(64,94,103,0.51)",
                    highlightOffset: 0,
                },
                zoomLevels: [16],
                mediaElement: audioElement,
                webAudio: {
                    audioContext: audioContext,
                    scale: 16,
                    multiChannel: false
                },
                // Bind keyboard controls
                keyboard: false,

                // Keyboard nudge increment in seconds (left arrow/right arrow)
                nudgeIncrement: 1.,
                segments: segments
            };
            Peaks.init(options, function (err, peaks) {
                if (err || peaks === undefined || peaks === null) {
                    console.error('Failed to initialize Peaks instance: ' + err.message);
                    return;
                }
                that.peaks = peaks;
                const peaksZoomView = peaks.views.getView('zoomview')!;
                peaksZoomView.setZoom({seconds: Math.min(audioElement.duration, 180.)});
//                     peaks.views.getView('zoomview').enableSegmentDragging(true);
//                     peaks.views.getView('zoomview').setSegmentDragMode('compress');
                peaks.on("zoomview.click", (event) => {
                    console.log("zoomview-click", event);
                    if (event.evt.altKey && !event.evt.shiftKey) {
                        const newIndex = that.model.get("segments").length;
                        that.model.set("selected", [...that.model.get("selected"), newIndex]);
                        that.model.set("segments",
                            [...that.model.get("segments"),
                                {
                                    startTime: event.time,
                                    endTime: event.time + .1,
                                    editable: true,
                                }]);
                        that.touch();
                    }
                    zoomview.focus()
//                         that.bm.focus()
                });
                peaks.on("segments.click", (event) => {
                    console.log("segment-click", event);

                    if (event.evt.altKey && event.evt.shiftKey) {
                        const segmentIndex = peaks.segments.getSegments().map(s => s.id).indexOf(event.segment.id);
                        const newSelected = that.model.get("selected")
                            .filter((s: number, i: number) => {
                                return i != segmentIndex;
                            })
                            .map((i: number) => i > segmentIndex ? i - 1 : i);
                        peaks.segments.removeById(<string>event.segment.id);
                        that.model.set("selected", [...newSelected]);
                        that.touch();
                        that.model.set("segments", [...segmentsToObjects(peaks.segments.getSegments())]);
                        that.touch()


                    } else if (event.evt.metaKey) {
                        const i = prompt("Enter cluster index", "0") as string;
                        event.segment.update({labelText: i});
                        that.model.set("segments", [...segmentsToObjects(peaks.segments.getSegments())]);
                        that.touch()
                    }
                    that.playBtn.trigger("focus");
                });
                peaks.on("segments.dragend", (event) => {
                    that.model.set("segments", [...segmentsToObjects(peaks.segments.getSegments())]);
                    that.touch()
//                         that.bm.focus()
                });
                peaks.on("player.seeked", (event) => {
                    console.log("player-seeked", event)
//                         that.bm.focus()
                });

                zoomview.addEventListener("keydown", (e) => {
                    if (e.code === 'Space') {
                        that.playBtn.trigger("click");
                        e.preventDefault();
                    } else if (e.code.includes("Arrow")) {
                        const currentTime = peaks.player.getCurrentTime();
                        const zoomview = peaks.views.getView('zoomview')!;
                        // @ts-ignore
                        const scale = zoomview.getEndTime() - zoomview.getStartTime();
                        let factor = 1 / 500;
                        if (e.shiftKey) {
                            factor = 1 / 50;
                        }
                        if (e.code === "ArrowRight") {
                            peaks.player.seek(currentTime + (scale * factor))
                        } else if (e.code === "ArrowLeft") {
                            peaks.player.seek(currentTime - (scale * factor))
                        }
                    }
                });

                zoomview.addEventListener("wheel", (event) => {
                    const zoomview = peaks.views.getView('zoomview');

                    if (!zoomview) return;

                    if (event.shiftKey && event.altKey) {
                        // @ts-ignore
                        const maxScale = zoomview._getScale(Math.min(peaks.player.getDuration(), 180.));

                        zoomview.setZoom({
                            // @ts-ignore
                            scale: Math.max(Math.min(zoomview._scale * (event.wheelDelta > 0 ? 1.1 : .9), maxScale), 8),
                        });
                        event.preventDefault();
                    }
                });
                zoomview.addEventListener("dblclick", (event) => {
                    if (event.altKey && event.shiftKey) {
                        peaks.views.getView('zoomview')!.setZoom({seconds: peaks.player.getDuration()})
                    } else if (!event.altKey) {
                        that.playBtn.trigger("click");
                    }
                })
            });
        })
    }

    render() {
        const model = this.model;
        const that = this;

        this.views.update(this.model.get("audio")).then(r => r);

        this.model.on("change:audio", this.init_peaks, this);
        this.model.on("change:segments", this.segments_changed, this);
        this.model.on("change:playing", this.toggle_playing, this);
        this.model.on("change:selected", this.segments_changed, this);

        super.render();
        const elementId = this.model.get("element_id");
        $(this.el).attr("id", elementId);

        this.zoomview = $("<div>")
            .text("\n")
            .attr("id", "zoomview-" + elementId)
            .attr("tabindex", "0")
            .css({width: '100%', height: '200px', 'white-space': 'pre'});

        this.overview = $("<div>")
            .text("\n")
            .attr("id", "overview-" + elementId)
            .css({width: '100%', height: '15px', 'white-space': 'pre'});

        // play button
        this.playBtn = $('<button class="fa fa-play lm-widget p-widget jupyter-widgets jupyter-button widget-button"/>')
            .text(' ')
            .css({margin: "8px auto", width: '100%', height: '30px'})
            .on("click", function () {
                const playing = model.get('playing');
                model.set('playing', !playing);
                that.touch();
            });

        $((this.el)).append(this.zoomview).append(this.overview).append(this.playBtn);
    }
}
