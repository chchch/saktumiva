import OpenSeadragon from './openseadragon/openseadragon.min.mjs';

const processManifest = data => {
  if(data.items) 
    return data.items.map(c => { // v3
      const m = c.items[0].items[0].body.service[0];
      m['@context'] = 'http://iiif.io/api/image/3/context.json';
      m.protocol = 'http://iiif.io/api/image';
      m.height = c.height;
      m.width = c.width;
      return m;
  });
  if(data.sequences) 
    return data.sequences[0].canvases.map(c => {
      if(c.images[0].resource.service) { // v2
        const m = c.images[0].resource.service;
        m['@context'] = 'http://iiif.io/api/image/2/context.json';
        m.protocol = 'http://iiif.io/api/image';
        m.width = c.width;
        m.height = c.height;
        m.protocol = 'http://iiif.io/api/image';
        return m;
      }
      const m = c.images[0].resource; // v1
      m['@context'] = 'http://iiif.io/api/image/1/context.json';
      m.protocol = 'http://iiif.io/api/image';
      return m;
    });
};

const initViewer = async (el,page) => {
  const res = await fetch(el.dataset.manifest);
  const manif = await res.json();
  const tiles = processManifest(manif);
  const osd = OpenSeadragon({
    element: el,
    prefixUrl: 'openseadragon/images/',
    preserveViewport: true,
    visibilityRatio: 1,
    //minZoomLevel: 1,
    maxZoomLevel: 3,
    sequenceMode: true,
    tileSources: tiles,
    initialPage: page || 0
  });
  
  const rc = el.getRootNode().querySelector('#recordcontainer');
  rc.addEventListener('click',changeImage.bind(null,osd));
  return osd;
};

const changeImage = (osd,e) => {
  const el = e.target.closest('[data-loc]');
  if(el && !e.target.closest('.app')) {
    const loc = el.dataset.loc.split(':')[0] - 1;
    //TODO: do annotations
    if(osd.currentPage() !== loc)
      osd.goToPage(loc);
  }
};

export default initViewer;

