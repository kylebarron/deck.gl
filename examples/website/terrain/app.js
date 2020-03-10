/* eslint-disable max-statements */
import React from 'react';
import {render} from 'react-dom';
import DeckGL from '@deck.gl/react';

import {TileLayer} from '@deck.gl/geo-layers';
import {StaticMap} from 'react-map-gl';
import {GeoJsonLayer} from '@deck.gl/layers';
import {load} from '@loaders.gl/core';
import {WebMercatorViewport} from '@deck.gl/core';
import {MVTLoader} from '@loaders.gl/mvt';
import {TerrainLoader} from '@loaders.gl/terrain';

import {TERRAIN_IMAGE, ELEVATION_DECODER} from './util';
import {snapFeaturesToTerrain} from '@kylebarron/snap-features-to-mesh';
import {TerrainTileLayer} from './terrain-tile-layer';

const INITIAL_VIEW_STATE = {
  latitude: 46.21,
  longitude: -122.18,
  zoom: 11.5,
  bearing: 140
  // pitch: 60
};

const getTiledTerrainData = ({bbox, x, y, z, options}) => {
  const {
    terrainImage = TERRAIN_IMAGE,
    elevationDecoder = ELEVATION_DECODER,
    meshMaxError = 10
  } = options;
  const url = terrainImage
    .replace('{x}', x)
    .replace('{y}', y)
    .replace('{z}', z);

  const viewport = new WebMercatorViewport({
    longitude: (bbox.west + bbox.east) / 2,
    latitude: (bbox.north + bbox.south) / 2,
    zoom: z
  });
  const bottomLeft = viewport.projectFlat([bbox.west, bbox.south]);
  const topRight = viewport.projectFlat([bbox.east, bbox.north]);
  const bounds = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]];

  const terrainOptions = {
    terrain: {
      bounds,
      meshMaxError,
      elevationDecoder
    }
  };
  const terrain = load(url, TerrainLoader, terrainOptions);
  const mvturl = `https://mbtiles.nst.guide/services/openmaptiles/own/tiles/${z}/${x}/${y}.pbf`;
  const loaderOptions = {
    mvt: {
      coordinates: 'wgs84',
      tileIndex: {
        x,
        y,
        z
      }
    }
  };
  const mvttile = load(mvturl, MVTLoader, loaderOptions);
  return Promise.all([terrain, mvttile]);
};

export default function App() {
  const testRaisedMvt = new TileLayer({
    id: 'testraisedmvt',
    minZoom: 0,
    maxZoom: 14,
    getTileData: ({x, y, z, bbox}) => {
      getTiledTerrainData({bbox, x, y, z, options: {}}).then(data => {
        const [terrain, features] = data;
        const viewport = new WebMercatorViewport({
          longitude: (bbox.west + bbox.east) / 2,
          latitude: (bbox.north + bbox.south) / 2,
          zoom: z
        });
        // console.log((bbox.west + bbox.east) / 2);
        // console.log((bbox.north + bbox.south) / 2);
        // console.log(z);

        const newFeatures = snapFeaturesToTerrain({terrain, features, viewport});
        console.log(newFeatures);
        // console.log(data);
        return data[1];
      });
    }
  });

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={[TerrainTileLayer(), testRaisedMvt]}
      // onHover={x => console.log(x)}
      // pickingRadius={5}
    >
      <StaticMap
        mapStyle="https://raw.githubusercontent.com/kylebarron/fiord-color-gl-style/master/style.json"
        mapOptions={{hash: true}}
      />
    </DeckGL>
  );
}

export function renderToDOM(container) {
  render(<App />, container);
}
