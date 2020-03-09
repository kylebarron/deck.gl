import {TerrainLayer as DeckTerrainLayer} from '@deck.gl/geo-layers';
import {landsatUrl, NAIP_IMAGE} from './util';
import {WebMercatorViewport} from '@deck.gl/core';
import {load} from '@loaders.gl/core';

export class TerrainLayer extends DeckTerrainLayer {
  getTiledTerrainData({bbox, x, y, z}) {
    const {terrainImage, elevationDecoder, meshMaxError, workerUrl} = this.props;
    const url = terrainImage
      .replace('{x}', x)
      .replace('{y}', y)
      .replace('{z}', z);

    let surfaceUrl;
    if (z <= 12) {
      surfaceUrl = landsatUrl()
        .replace('{x}', x)
        .replace('{y}', y)
        .replace('{z}', z);
    } else {
      surfaceUrl = NAIP_IMAGE.replace('{x}', x)
        .replace('{y}', y)
        .replace('{z}', z);
    }

    const viewport = new WebMercatorViewport({
      longitude: (bbox.west + bbox.east) / 2,
      latitude: (bbox.north + bbox.south) / 2,
      zoom: z
    });
    const bottomLeft = viewport.projectFlat([bbox.west, bbox.south]);
    const topRight = viewport.projectFlat([bbox.east, bbox.north]);
    const bounds = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]];

    const terrain = this.loadTerrain({
      terrainImage: url,
      bounds,
      elevationDecoder,
      meshMaxError,
      workerUrl
    });
    const texture = surfaceUrl
      ? // If surface image fails to load, the tile should still be displayed
        load(surfaceUrl).catch(_ => null)
      : Promise.resolve(null);

    return Promise.all([terrain, texture]);
  }
}
