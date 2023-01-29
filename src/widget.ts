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
import Peaks, {PeaksOptions, PeaksInstance, CreateSegmentMarkerOptions} from 'peaks.js';
import Konva from "konva";

class CustomSegmentMarker {
    protected _options: CreateSegmentMarkerOptions;
    protected _handle: Konva.Rect;
    protected _line: Konva.Line;
    protected handleHeight: number;

    constructor(options: CreateSegmentMarkerOptions) {
        this._options = options;
    }

    init(group: Konva.Group) {
        const handleWidth = 10;
        this.handleHeight = 20;
        const handleX = -(handleWidth / 2) + 0.5; // Place in the middle of the marker

        this._handle = new Konva.Rect({
            x: handleX,
            y: 0,
            width: handleWidth,
            height: this.handleHeight,
            fill: this._options.color as string
        });

        this._line = new Konva.Line({
            stroke: this._options.color as string,
            strokeWidth: 1
        });

        group.add(this._handle);
        group.add(this._line);

        this.fitToView();
    }

    fitToView() {
        const layer = this._options.layer;
        const height = layer.getHeight();
        this._handle.y(height / 2 - this.handleHeight / 2);
        this._line.points([0.5, 0, 0.5, height]);
    }

    timeUpdated() {
        // (optional, see below)
    }

    destroy() {
        // (optional, see below)
    }
}

function newSegmentMarker(options: CreateSegmentMarkerOptions) {
    return new CustomSegmentMarker(options);
}

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

    // static state_change: Promise<any>;

    static model_name = 'PeaksJSModel';
    static model_module = MODULE_NAME;
    static model_module_version = MODULE_VERSION;
    static view_name = 'PeaksJSView'; // Set to null if no view
    static view_module = MODULE_NAME; // Set to null if no view
    static view_module_version = MODULE_VERSION;
}

// function segmentsToObjects(segments: Segment[]) {
//     return segments.map(s => {
//         return {
//             startTime: s.startTime, endTime: s.endTime, color: s.color,
//             editable: s.editable, labelText: s.labelText, id: s.id
//         }
//     })
// }

export class PeaksJSView extends DOMWidgetView {
    peaks: PeaksInstance;
    views: ViewList<DOMWidgetView>;
    audio: HTMLMediaElement;
    zoomview: JQuery;
    overview: JQuery;
    playBtn: JQuery;

    add_view(child_model: DOMWidgetModel, index: number) {
        console.log("CHILD:", child_model);
        return this.create_child_view(child_model, {parent: this})
            .then(view => view)
            .catch(err => {
                console.log("...... err ......");
                return err
            });
    }

    segments_changed() {
        let segments = this.model.get("segments");
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
            // @ts-ignore
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
                segments: segments,
                // @ts-ignore
                createSegmentMarker: newSegmentMarker,
            };
            Peaks.init(options, function (err, peaks) {
                if (err || peaks === undefined || peaks === null) {
                    console.error('Failed to initialize Peaks instance: ' + err.message);
                    return;
                }
                that.peaks = peaks;
                const peaksZoomView = peaks.views.getView('zoomview')!;
                peaksZoomView.setZoom({seconds: Math.min(audioElement.duration, 180.)});
                /*
                * alt + click: add segment
                * alt + SHIFT + click: remove segment
                * Ctrl + click: edit segment's label
                * Ctrl + wheel: zoom
                * Ctr + dbl-click: reset zoom
                * SHIFT + wheel: scroll wvaveform
                * */
                peaks.on("zoomview.click", (event) => {
                    if (event.evt.altKey && !event.evt.shiftKey) {
                        const newSegment = {
                            startTime: event.time,
                            endTime: event.time + .1,
                            editable: true,
                            id: that.model.get("id_count"),
                            color: "#ff640e",
                            labelText: ''
                        };
                        peaks.segments.add(newSegment);
                        that.model.set("id_count", newSegment.id + 1);
                        that.touch();
                        // that.model.set("segments",
                        //     [...that.model.get("segments"),
                        //         newSegment], {updated_view: that});
                        // that.touch();
                        // that.model.save_changes();
                        that.send({newSegment: newSegment});
                    }
                    // zoomview.focus();
                });
                peaks.on("segments.click", (event) => {
                    console.log("segment-click", event);

                    if (event.evt.altKey && event.evt.shiftKey) {
                        peaks.segments.removeById(<string>event.segment.id);
                        // that.model.set("segments", [...segmentsToObjects(peaks.segments.getSegments())],
                        //     {updated_view: that});
                        // that.model.save_changes();
                        // that.touch();
                        that.send({
                            removeSegment: {
                                startTime: event.segment.startTime,
                                endTime: event.segment.endTime,
                                id: event.segment.id,
                                color: event.segment.color,
                                labelText: event.segment.labelText
                            }
                        })

                    } else if (event.evt.ctrlKey) {
                        const i = prompt("Enter cluster index", "0") as string;
                        event.segment.update({labelText: i});
                        // that.model.set("segments", [...segmentsToObjects(peaks.segments.getSegments())]);
                        // that.touch();
                        that.send({
                            editSegment: {
                                startTime: event.segment.startTime,
                                endTime: event.segment.endTime,
                                id: event.segment.id,
                                color: event.segment.color,
                                labelText: i,
                                editable: true
                            }
                        })
                    }
                    // that.playBtn.trigger("focus");
                });
                peaks.on("segments.dragend", (event) => {
                    // that.model.set("segments", [...segmentsToObjects(peaks.segments.getSegments())]);
                    // that.touch();
                    // console.log("_---->", event.segment);
                    that.send({
                        editSegment: {
                            startTime: event.segment.startTime,
                            endTime: event.segment.endTime,
                            id: event.segment.id,
                            color: event.segment.color,
                            labelText: event.segment.labelText,
                            editable: true
                        }
                    });
                });
                peaks.on("player.seeked", (event) => {
                    console.log("player-seeked", event)
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

                    if (event.ctrlKey) {
                        // @ts-ignore
                        const startTime = zoomview.getStartTime();
                        // @ts-ignore
                        const endTime = zoomview.getEndTime();
                        // @ts-ignore
                        const newDuration = (endTime - startTime) * (event.wheelDelta > 0 ? 1.1 : .9);
                        zoomview.setZoom({
                            seconds: Math.max(newDuration, 0.356)
                        });
                        event.preventDefault();
                    }
                });
                zoomview.addEventListener("dblclick", (event) => {
                    if (event.ctrlKey) {
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

        this.model.on("change:audio", this.init_peaks, this);
        this.model.on("change:segments", this.segments_changed, this);
        this.model.on("change:playing", this.toggle_playing, this);
        this.views = new ViewList(this.add_view, null, this);
        const _this = this;
        this.listenTo(this.model, "change:audio", (model, value) => {
            _this.views.update(value).then(r => console.log("THEN:", r));
            // @ts-ignore
        });
        this.listenTo(this.model, "change:segments", this.segments_changed);
        this.displayed.then(() => {
            _this.init_peaks();
            _this.send({init: "INIT"})
        });
        this.views.update(this.model.get("audio")).then(r => r);
        // super.render();
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
                that.model.save_changes();
                that.touch();
                that.send({playing: "click"});
            });

        $((this.el)).append(this.zoomview).append(this.overview).append(this.playBtn);
    }
}
