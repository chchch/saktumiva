import tuftecss from '../tst/css/tufte.css' with { type: 'css' };
import fontscss from '../tst/css/fonts.css' with { type: 'css' };
import tstcss from '../tst/css/tst.css' with { type: 'css' };
import headercss from '../tst/css/header.css' with { type: 'css' };
import transcriptioncss from '../tst/css/transcription.css' with {type: 'css'};
import apparatuscss from '../tst/css/apparatus.css' with {type: 'css'};
import { TSTViewer } from '../tst/js/tst.mjs';
import { loadDoc, compileImports, XSLTransform } from './utils.mjs';
import initViewer from './osdwrapper.mjs';

const _state = {
  edStyle: null,
  appid: null,
  transid: null
};

const loadXSLT = async fn => {
  const doc = await loadDoc(fn);
  return await compileImports(doc);
};

const shadowpreview = async (path, doc, params) => {
  if(!_state.edStyle) _state.edStyle = await loadXSLT('./edition.xsl');
  
  const html = await XSLTransform(_state.edStyle,doc);

  const host = document.createElement('article');
  host.className = 'shadowbox';
  host.dataset.path = path;

  const shadow = host.attachShadow({ mode: 'open'});
  const rc = html.getElementById('recordcontainer');
  rc.lang = 'en';
  shadow.appendChild(rc);
  const togglers = html.getElementById('togglers');
  if(togglers) shadow.appendChild(togglers);
  shadow.adoptedStyleSheets = [tuftecss,fontscss,tstcss,headercss,transcriptioncss,apparatuscss];

  document.querySelector('article').appendChild(host);
  TSTViewer.init(null,shadow);
  
  const appchannel = new BroadcastChannel('apparatus');
  appchannel.addEventListener('message',e => {
    if(e.data.uuid) shadow.querySelector('#recordcontainer').dataset.appid = e.data.uuid;
    appchannel.close();
  });
  appchannel.postMessage({uuid: null, from: 'shadowpreview'});

  const transchannel = new BroadcastChannel('transliterator');
  transchannel.addEventListener('message',e => {
    if(e.data.uuid) shadow.querySelector('#recordcontainer').dataset.transid = e.data.uuid;
    transchannel.close();
  });
  transchannel.postMessage({uuid: null, from: 'shadowpreview'});

  const [facs, scrollel] = TSTViewer.checkParams(shadow,params);

  const viewer = html.getElementById('viewer');
  if(viewer) {
    shadow.appendChild(viewer);
    const page = facs !== undefined ? facs : viewer.dataset.start;
    const osd = initViewer(viewer,page);
    return {shadow: shadow, scrollel: scrollel, osd: osd};
  }
  return {shadow: shadow, scrollel: scrollel};
};

const shadowrefresh = async (path, doc) => {
  if(!_state.edStyle) _state.edStyle = await loadXSLT('./edition.xsl');

  const html = await XSLTransform(_state.edStyle,doc);

  const host = document.querySelector(`.shadowbox[data-path="${path}"`);;

  const shadow = host.shadowRoot;
  const rec = html.querySelector('#recordcontainer > .record');
  const existing = shadow.querySelector('#recordcontainer > .record');
  existing.replaceWith(rec);
  const appchannel = new BroadcastChannel('apparatus');
  const appid = shadow.querySelector('#recordcontainer').dataset.appid;
  appchannel.postMessage({uuid: appid});
  appchannel.close();

  const transchannel = new BroadcastChannel('transliterator');
  const transid = shadow.querySelector('#recordcontainer').dataset.transid;
  transchannel.postMessage({uuid: transid});
  transchannel.close();

  if(!shadow.getElementById('togglers')) {
  const togglers = html.getElementById('togglers');
  if(togglers) shadow.appendChild(togglers);
  }

  const viewer = html.getElementById('viewer');
  if(viewer) {
    const existingviewer = shadow.querySelector('#viewer');
    if(!existingviewer || existingviewer.dataset.manifest !== viewer.dataset.manifest) {
      if(existingviewer) existingviewer.replaceWith(viewer);
      else shadow.appendChild(viewer);
      const page = viewer.dataset.start;
      const osd = initViewer(viewer,page);
      return {shadow: shadow, osd: osd};
    }
    else { // no change in manifest
      existingviewer.dataset.start = viewer.dataset.start;
      return {shadow: shadow};
    }
  }
  return {shadow: shadow};
}

export { shadowpreview, shadowrefresh };
