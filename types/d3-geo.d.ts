declare module "d3-geo" {
  export interface GeoProjection {
    (point: [number, number]): [number, number] | null;
    scale(): number;
    scale(scale: number): GeoProjection;
    translate(): [number, number];
    translate(translate: [number, number]): GeoProjection;
    center(): [number, number];
    center(center: [number, number]): GeoProjection;
    fitExtent(
      extent: [[number, number], [number, number]],
      object: unknown,
    ): GeoProjection;
    fitSize(size: [number, number], object: unknown): GeoProjection;
  }

  export function geoEqualEarth(): GeoProjection;
  export function geoEquirectangular(): GeoProjection;
  export function geoMercator(): GeoProjection;
  export function geoNaturalEarth1(): GeoProjection;
}
