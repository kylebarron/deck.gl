import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import {COORDINATE_SYSTEM} from '@deck.gl/core';
import {load} from '@loaders.gl/core';
import {TerrainLoader} from '@loaders.gl/terrain';
import {TileLayer} from '@deck.gl/geo-layers';
import {TERRAIN_IMAGE, NAIP_IMAGE, SURFACE_IMAGE, ELEVATION_DECODER} from './util';
import {GeoJsonLayer} from '@deck.gl/layers';
import {MVTLoader} from '@loaders.gl/mvt';
import {Matrix4} from 'math.gl';

const MESH_MAX_ERROR = 10;
const DUMMY_DATA = [1];

function getTerrainUrl({x, y, z}) {
  return TERRAIN_IMAGE.replace('{x}', x)
    .replace('{y}', y)
    .replace('{z}', z);
}

function getTextureUrl({x, y, z}) {
  if (z >= 12) {
    return NAIP_IMAGE.replace('{x}', x)
      .replace('{y}', y)
      .replace('{z}', z);
  }

  return SURFACE_IMAGE.replace('{x}', x)
    .replace('{y}', y)
    .replace('{z}', z);
}

function getOpenMapTilesUrl({x, y, z}) {
  return `https://mbtiles.nst.guide/services/openmaptiles/own/tiles/${z}/${x}/${y}.pbf`;
}

export function TerrainTileLayer() {
  return new TileLayer({
    id: 'terrain-tiles',
    minZoom: 0,
    maxZoom: 17,
    getTileData,
    renderSubLayers
  });
}

function getTileData({x, y, z, bbox}) {
  const terrainUrl = getTerrainUrl({x, y, z});
  const textureUrl = getTextureUrl({x, y, z});
  const mvtUrl = getOpenMapTilesUrl({x, y, z});

  // minx, miny, maxx, maxy
  // This is used to flip the image so that the origin is at the top left
  const bounds = [0, 1, 1, 0];

  const mvttile = load(mvtUrl, MVTLoader);
  const terrain = loadTerrain({
    terrainImage: terrainUrl,
    bounds,
    elevationDecoder: ELEVATION_DECODER,
    meshMaxError: MESH_MAX_ERROR
  });
  const texture = textureUrl
    ? // If surface image fails to load, the tile should still be displayed
      load(textureUrl).catch(_ => null)
    : Promise.resolve(null);

  return Promise.all([terrain, texture, mvttile]);
}

function renderSubLayers(props) {
  const {data, tile} = props;
  let mesh = null;
  let texture = null;
  let geojsonFeatures = null;

  if (Array.isArray(data)) {
    mesh = data[0];
    texture = data[1];
    geojsonFeatures = data[2];
  } else if (data) {
    mesh = data.then(result => result && result[0]);
    texture = data.then(result => result && result[1]);
    geojsonFeatures = data.then(result => result && result[2]);
  }

  return [
    new SimpleMeshLayer(props, {
      id: `terrain-simple-mesh-layer-${tile.x}-${tile.y}-${tile.z}`,
      data: DUMMY_DATA,
      mesh,
      texture,
      getPolygonOffset: null,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      modelMatrix: getModelMatrix(tile),
      getPosition: d => [0, 0, 0],
      // Color to use if surfaceImage is unavailable
      getColor: [255, 255, 255]
    }),
    new GeoJsonLayer(props, {
      // NOTE: currently you need to set each sublayer id so they don't conflict
      id: `geojson-layer-${tile.x}-${tile.y}-${tile.z}`,
      data: geojsonFeatures.then(r => r),
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      modelMatrix: getModelMatrix(tile)
    })
  ];
}

// From https://github.com/uber/deck.gl/blob/b1901b11cbdcb82b317e1579ff236d1ca1d03ea7/modules/geo-layers/src/mvt-tile-layer/mvt-tile-layer.js#L41-L52
function getModelMatrix(tile) {
  const WORLD_SIZE = 512;
  const worldScale = Math.pow(2, tile.z);

  const xScale = WORLD_SIZE / worldScale;
  const yScale = -xScale;

  const xOffset = (WORLD_SIZE * tile.x) / worldScale;
  const yOffset = WORLD_SIZE * (1 - tile.y / worldScale);

  return new Matrix4().translate([xOffset, yOffset, 0]).scale([xScale, yScale, 1]);
}

function loadTerrain({terrainImage, bounds, elevationDecoder, meshMaxError, workerUrl}) {
  if (!terrainImage) {
    return null;
  }
  const options = {
    terrain: {
      bounds,
      meshMaxError,
      elevationDecoder
    }
  };
  if (workerUrl !== null) {
    options.terrain.workerUrl = workerUrl;
  }
  return load(terrainImage, TerrainLoader, options);
}
