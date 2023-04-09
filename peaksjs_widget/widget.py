#!/usr/bin/env python
# coding: utf-8

# Copyright (c) AntoineDaurat.
# Distributed under the terms of the Modified BSD License.

"""
TODO: Add module docstring
"""

from ipywidgets import DOMWidget, HTML, widget_serialization, Audio, CallbackDispatcher, register, Button, HBox
from ipywidgets.widgets.trait_types import InstanceDict
from traitlets import Unicode, Int, Dict, List, Bool, Instance
from ._frontend import module_name, module_version
import pydub
import numpy as np
from io import BytesIO
import dataclasses as dtc
from typing import Optional


@dtc.dataclass
class Segment:
    startTime: float
    endTime: float
    id: int
    color: str = '#ff640e'
    labelText: str = ""
    editable: bool = True
    duration: Optional[float] = None

    def __post_init__(self):
        if self.duration is None:
            self.duration = self.endTime - self.startTime

    def dict(self):
        return dtc.asdict(self)


@dtc.dataclass
class Point:
    time: float
    editable: bool = True
    color: str = "#ff640e"
    labelText: str = ""
    id: Optional[str] = None

    def dict(self):
        return dtc.asdict(self)


def to_mp3_buffer(audio, sr):
    audio = audio / np.abs(audio).max()
    y = np.int16(audio * 2 ** 15)
    segment = pydub.AudioSegment(y.tobytes(),
                                 frame_rate=sr,
                                 sample_width=2,
                                 channels=1)
    with BytesIO() as f:
        segment.export(f, format="mp3", bitrate="320k")
        buffer = f.getvalue()
    return buffer


@register
class PeaksJSWidget(DOMWidget):
    _model_name = Unicode('PeaksJSModel').tag(sync=True)
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode('PeaksJSView').tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)
    element_id = Unicode().tag(sync=True)
    segments = List(Dict()).tag(sync=True)
    points = List(Dict()).tag(sync=True)
    playing = Bool().tag(sync=True)
    id_count = Int().tag(sync=True)
    zoomview = InstanceDict(DOMWidget).tag(sync=True, **widget_serialization)
    overview = InstanceDict(DOMWidget).tag(sync=True, **widget_serialization)
    play_button = InstanceDict(DOMWidget).tag(sync=True, **widget_serialization)
    save_button = InstanceDict(DOMWidget).tag(sync=True, **widget_serialization)
    audio = Instance(Audio).tag(sync=True, **widget_serialization)
    as_container = Bool().tag(sync=True)

    def __init__(self,
                 value=None,
                 array=None,
                 sr=None,
                 filename=None,
                 format=None,
                 autoplay=False,
                 loop=False,
                 controls=False,
                 element_id=None,
                 zoomview=None,
                 overview=None,
                 play_button=None,
                 save_button=None,
                 id_count=0,
                 segments=None,
                 points=None,
                 as_container=True,
                 **kwargs
                 ):
        if value is None:
            if array is not None and sr is not None:
                value = to_mp3_buffer(array, sr)
                audio = Audio(value=value, format="mp3", autoplay=False,
                              loop=False, controls=False)
            elif filename is not None and format is not None:
                audio = Audio(filename=filename, format=format, autoplay=autoplay,
                              loop=loop, controls=controls)
            else:
                raise ValueError("either 'array' and 'sr', or 'filename' and 'format' should be both not None.")
        else:
            audio = Audio(value=value, format=format, autoplay=autoplay, loop=loop,
                          controls=controls)
        if zoomview is None:
            zoomview = HBox(layout=dict(height="300px", width='100%'))
        if overview is None:
            overview = HBox(layout=dict(height="30px", width='100%'))
        if play_button is None:
            play_button = Button(icon="fa-play", layout=dict(width="100%", height="30px"))
        if save_button is None:
            save_button = Button(icon="fa-download", layout=dict(width="100%", height="30px"))
        if segments is None:
            segments = []
        if points is None:
            points = []
        super().__init__(element_id=element_id if element_id is not None else '',
                         id_count=id_count,
                         segments=segments,
                         points=points,
                         playing=False,
                         zoomview=zoomview,
                         overview=overview,
                         play_button=play_button,
                         save_button=save_button,
                         audio=audio,
                         as_container=as_container,
                         **kwargs
                         )
        self.audio = audio
        self._add_segment_cb = CallbackDispatcher()
        self._edit_segment_cb = CallbackDispatcher()
        self._remove_segment_cb = CallbackDispatcher()
        self._add_point_cb = CallbackDispatcher()
        self._edit_point_cb = CallbackDispatcher()
        self._remove_point_cb = CallbackDispatcher()
        self.on_msg(self._dispatch_msg)

    def add_segment(self, seg):
        new_seg = Segment(**seg).dict()
        self.segments = [*self.segments, new_seg]
        return self

    def edit_segment(self, seg):
        self.segments = [s if s["id"] != seg["id"] else Segment(**seg).dict() for s in self.segments]
        return self

    def remove_segment(self, seg):
        self.segments = [*filter(lambda s: s["id"] != seg["id"], self.segments)]
        return self

    def add_point(self, point):
        new_point = Point(**point).dict()
        self.points = [*self.points, new_point]
        return self

    def edit_point(self, point):
        self.points = [p if p["id"] != point["id"] else Point(**point).dict() for p in self.points]
        return self

    def remove_point(self, seg):
        self.points = [*filter(lambda s: s["id"] != seg["id"], self.points)]
        return self

    def _dispatch_msg(self, _, content, buffers):
        """Handle a msg from the front-end.

        Parameters
        ----------
        content: dict
            Content of the msg.
        """
        if "newSegment" in content:
            self._add_segment_cb(self, content["newSegment"])
        if "editSegment" in content:
            self._edit_segment_cb(self, content["editSegment"])
        if "removeSegment" in content:
            self._remove_segment_cb(self, content["removeSegment"])
        if "newPoint" in content:
            self._add_point_cb(self, content["newPoint"])
        if "editPoint" in content:
            self._edit_point_cb(self, content["editPoint"])
        if "removePoint" in content:
            self._remove_point_cb(self, content["removePoint"])

    def on_new_segment(self, func):
        self._add_segment_cb.register_callback(func, False)
        return self

    def on_edit_segment(self, func):
        self._edit_segment_cb.register_callback(func, False)
        return self

    def on_remove_segment(self, func):
        self._remove_segment_cb.register_callback(func, False)
        return self

    def on_new_point(self, func):
        self._add_point_cb.register_callback(func, False)
        return self

    def on_edit_point(self, func):
        self._edit_point_cb.register_callback(func, False)
        return self

    def on_remove_point(self, func):
        self._remove_point_cb.register_callback(func, False)
        return self
