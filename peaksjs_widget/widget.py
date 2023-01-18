#!/usr/bin/env python
# coding: utf-8

# Copyright (c) AntoineDaurat.
# Distributed under the terms of the Modified BSD License.

"""
TODO: Add module docstring
"""

from ipywidgets import DOMWidget, Widget, widget_serialization, Audio, Layout
from ipywidgets.widgets.trait_types import InstanceDict
from traitlets import Unicode, Int, Dict, List, Bool, Instance
from ._frontend import module_name, module_version
import pydub
import numpy as np
from io import BytesIO


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


class PeaksJSWidget(DOMWidget):
    _model_name = Unicode('PeaksJSModel').tag(sync=True)
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode('PeaksJSView').tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)
    audio = List(Instance(Widget)).tag(sync=True, **widget_serialization)
    element_id = Unicode().tag(sync=True)
    segments = List(Dict()).tag(sync=True)
    playing = Bool().tag(sync=True)
    selected = List(Int()).tag(sync=True)
    layout = InstanceDict(Layout).tag(sync=True, **widget_serialization)

    def __init__(self, array, sr, segments=[]):
        value = to_mp3_buffer(array, sr)
        audio = [Audio(value=value, format="mp3", autoplay=False,
                       loop=False, controls=False)]
        super().__init__(audio=audio,
                         element_id="audio_456",
                         segments=segments,
                         playing=False,
                         selected=list(range(len(segments)))
                         )
        self.audio = audio
