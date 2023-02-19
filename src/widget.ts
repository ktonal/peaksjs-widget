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
        };
    }

    static serializers: ISerializers = {
        zoomview: {deserialize: unpack_models},
        overview: {deserialize: unpack_models},
        play_button: {deserialize: unpack_models},
        save_button: {deserialize: unpack_models},
        audio: {deserialize: unpack_models},
        ...DOMWidgetModel.serializers
    };

    static model_name = 'PeaksJSModel';
    static model_module = MODULE_NAME;
    static model_module_version = MODULE_VERSION;
    static view_name = 'PeaksJSView'; // Set to null if no view
    static view_module = MODULE_NAME; // Set to null if no view
    static view_module_version = MODULE_VERSION;
}

export class PeaksJSView extends DOMWidgetView {
    peaks: PeaksInstance;
    views: ViewList<DOMWidgetView>;
    audio: HTMLMediaElement;
    zoomview: JQuery;
    overview: JQuery;
    playBtn: JQuery;

    render() {
        super.render();
        this.model.on("change:zoomview", this.init_zoomview, this);
        this.model.on("change:overview", this.init_overview, this);
        this.model.on("change:play_button", this.init_play_button, this);
        this.model.on("change:save_button", this.init_save_button, this);
        this.model.on("change:audio", this.init_peaks, this);
        this.model.on("change:segments", this.segments_changed, this);
        this.model.on("change:points", this.points_changed, this);
        this.model.on("change:playing", this.toggle_playing, this);
        this.views = new ViewList(this.add_view, null, this);
        const _this = this;
        // this.listenTo(this.model, "change:zoomview", (model, value) => {
        //     _this.views.update([value,]);
        // });
        // this.listenTo(this.model, "change:overview", (model, value) => {
        //     _this.views.update([value,]);
        // });
        // this.listenTo(this.model, "change:play_button", (model, value) => {
        //     _this.views.update([value,]);
        // });
        // this.listenTo(this.model, "change:audio", (model, value) => {
        //     _this.views.update([value,]);
        // });
        this.listenTo(this.model, "change:segments", this.segments_changed);
        this.listenTo(this.model, "change:points", this.points_changed);

        this.displayed.then(() => {
            _this.init_zoomview();
            _this.init_overview();
            _this.init_play_button();
            _this.init_save_button();
            _this.init_peaks();
        });
        this.views.update(
            [
                this.model.get("zoomview"),
                this.model.get("overview"),
                this.model.get("play_button"),
                this.model.get("save_button"),
                this.model.get("audio")
            ]).then(r => r.map(v => v.render()));
        const elementId = this.model.get("element_id");
        $(this.el).attr("id", elementId);
    }

    add_view(child_model: DOMWidgetModel, index: number) {
        return this.create_child_view(child_model, {parent: this})
            .then(view => {
                view.trigger("displayed");
                return view;
            })
            .catch(err => {
                return err
            });
    }

    init_zoomview() {
        const that = this;
        const elementId = this.model.get("element_id");
        this.views.views[0].then(v => {
            that.zoomview = $(v.el)
                .text("\n")
                .attr("id", "zoomview-" + elementId)
                .attr("tabindex", "0")
                .css({width: '100%', height: '200px', 'white-space': 'pre'});
            if (that.model.get("as_container")) $(that.el).append(that.zoomview);
        });
    }

    init_overview() {
        const that = this;
        const elementId = this.model.get("element_id");
        this.views.views[1].then(v => {
            that.overview = $(v.el)
                .text("\n")
                .attr("id", "overview-" + elementId)
                .css({width: '100%', height: '15px', 'white-space': 'pre'});
            if (that.model.get("as_container")) $(that.el).append(that.overview);
        });
    }

    init_play_button() {
        const model = this.model;
        const that = this;
        this.views.views[2].then(v => {
            this.playBtn = $(v.el)
                .on("click", function () {
                    const playing = model.get('playing');
                    model.set('playing', !playing);
                    model.save_changes();
                    that.touch();
                    that.send({playing: !playing});
                });
            if (that.model.get("as_container")) $((this.el))
                .append(this.playBtn);
        })
    }

    init_save_button() {
        const that = this;
        this.views.views[3].then(v => {
            $(that.el).append($(v.el).on("click", function () {
                const link = document.createElement('a');
                link.href = that.audio.src;
                link.setAttribute('download', `${that.model.get("element_id")}.mp3`); //or any other extension
                document.body.appendChild(link);
                link.click();
            }));
        })
    }

    init_peaks() {
        const that = this;
        const audioContext = new AudioContext();
        const segments = this.model.get("segments");
        const points = this.model.get("points");
        Promise.all(this.views.views).then(v => {
            const a = v[4];
            const audioElement = a.el as HTMLMediaElement;
            const zoomview = v[0].el;
            const overview = v[1].el;
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
                points: points,
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
                * Ctrl + alt + click: edit segment's label
                * Ctrl + click: add point
                * Ctrl + SHIFT + click: remove point
                * Ctrl + wheel: zoom
                * Ctr + dbl-click: reset zoom
                * SHIFT + wheel: scroll wvaveform
                * */
                peaks.on("zoomview.click", (event) => {
                    if (event.evt.altKey && !event.evt.shiftKey && !event.evt.ctrlKey) {
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
                        that.send({newSegment: newSegment});
                    } else if (event.evt.ctrlKey && !event.evt.altKey && !event.evt.shiftKey) {
                        const newPoint = {
                            time: event.time
                        };
                        peaks.points.add(newPoint);
                        that.send({newPoint: newPoint});
                    }
                });
                peaks.on("segments.click", (event) => {

                    if (event.evt.altKey && event.evt.shiftKey) {
                        peaks.segments.removeById(<string>event.segment.id);
                        that.send({
                            removeSegment: {
                                startTime: event.segment.startTime,
                                endTime: event.segment.endTime,
                                id: event.segment.id,
                                color: event.segment.color,
                                labelText: event.segment.labelText
                            }
                        })

                    } else if (event.evt.ctrlKey && event.evt.altKey) {
                        const i = prompt("Enter cluster index", "0") as string;
                        event.segment.update({labelText: i});
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
                    } else {
                        that.send({
                            clickSegment: {
                                startTime: event.segment.startTime,
                                endTime: event.segment.endTime,
                                id: event.segment.id,
                                color: event.segment.color,
                                labelText: event.segment.labelText,
                                editable: event.segment.editable
                            }
                        })
                    }
                });
                peaks.on("segments.dragend", (event) => {
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
                            seconds: Math.min(audioElement.duration,
                                Math.max(newDuration, 0.356))
                        });
                        event.preventDefault();
                        that.send({
                            // @ts-ignore
                            updateZoomView: {startTime: zoomview.getStartTime(), endTime: zoomview.getEndTime()}
                        })
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

    segments_changed() {
        let segments = this.model.get("segments");
        this.peaks.segments.removeAll();
        this.peaks.segments.add(segments);
    }
    points_changed() {
        let points = this.model.get("points");
        this.peaks.points.removeAll();
        this.peaks.points.add(points);
    }

    toggle_playing() {
        const playing = this.model.get("playing");
        if (playing) {
            this.peaks.player.play();
            this.playBtn.children("i").removeClass("fa-play").addClass("fa-pause");
        } else {
            this.peaks.player.pause();
            this.playBtn.children("i").removeClass("fa-pause").addClass("fa-play");
        }
    }
}
