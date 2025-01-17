
# peaksjs-widget

ipywidget to interact with audio waveforms through peaks.js

![preview](widget-review.png)

## Installation

You can install using `pip`:

```shell script
pip install peaksjs_widget
```

## Shortcuts

you can interact with the waveform/widgets with following shortcuts:

- Navigation:
    * `Ctrl + wheel`: zoom
    * `SHIFT + dbl-click`: reset zoom
    * `SHIFT + wheel`: scroll waveform
    * `arrow left/right`: move playhead left/right
    * `SHIFT + arrow left/right`: move playhead left/right a lot.
- Controls:
    * `dbl-click`: play from there
    * `SPACE BAR`: play/pause 
- Segments:
    * `alt + click`: add segment
    * `SHIFT + click` on a segment: remove segment
    * `Ctrl + alt + click` on a segment: edit segment's label
- Points:
    * `Ctrl + click`: add point
    * `SHIFT + click` on a point: remove point
    * `Ctrl + alt + click` on a point: edit point's label

you can also drag points and segments' boundaries with the mouse to edit their position

## Development Installation

Create a dev environment:
```shell script
conda create -n peaksjs_widget-dev -c conda-forge nodejs yarn python jupyterlab
conda activate peaksjs_widget-dev
```

Install the python. This will also build the TS package.
```shell script
pip install -e ".[test]"
```

When developing your extensions, you need to manually enable your extensions with the
lab frontend. This is done by the command:

```bash
jupyter labextension develop --overwrite .
yarn run build
```

### How to see your changes
#### Typescript:
If you use JupyterLab to develop then you can watch the source directory and run JupyterLab at the same time in different
terminals to watch for changes in the extension's source and automatically rebuild the widget.

```shell script
# Watch the source directory in one terminal, automatically rebuilding when needed
yarn run watch
# Run JupyterLab in another terminal
jupyter lab
```

After a change wait for the build to finish and then refresh your browser and the changes should take effect.

#### Python:
If you make a change to the python code then you will need to restart the notebook kernel to have it take effect.

## Updating the version

To update the version, install tbump and use it to bump the version.
By default it will also create a tag.

```shell script
pip install tbump
tbump <new-version>
```

## Publish the package
on npm
````shell script
npm login 
npm publish
````
on pypi
```shell script
rm -rf dist/
pyproject-build .
twine upload dist/peaksjs* -u k-tonal
```