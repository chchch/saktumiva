import guideTree from '../lib/tree.mjs';

onmessage = function(e) {
    const guidetree = guideTree(...e.data);
    postMessage(guidetree.toMatrix());
};
