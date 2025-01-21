import { loadDoc } from './utils.mjs';

const getXSLTSheet = async doc => {
    for(const n of doc.childNodes) {
        if(n.nodeName === 'xml-stylesheet') {
            const temp = doc.createElement('outer');
            temp.innerHTML = `<inner ${n.data}/>`;
            const href = temp.firstChild.getAttribute('href');
            return loadDoc(href,'default');
        }
    }
};

const compileImports = async (xsltsheet,prefix='') => {
    const imports = xsltsheet.querySelectorAll('import');
    if(!imports) return xsltsheet;
    for(const x of imports) {
        const href = prefix + x.getAttribute('href');
        const split = href.split('/');
        split.pop();
        const newprefix = split.join('/') + '/';
        const i = await loadDoc(href,'default');
        while(i.documentElement.firstChild) {

            if(i.documentElement.firstChild.nodeName === 'xsl:param') {
                if(xsltsheet.querySelector(`variable[name="${i.documentElement.firstChild.getAttribute('name')}"]`)) { 
                    i.documentElement.firstChild.remove();
                    continue;
                }
            }
            if(i.documentElement.firstChild.nodeName === 'xsl:import') {
                const ii = await loadDoc(newprefix + i.documentElement.firstChild.getAttribute('href'),'default');
                const embed = await compileImports(ii,newprefix);
                while(embed.documentElement.firstChild)
                        x.before(embed.documentElement.firstChild);
                i.documentElement.firstChild.remove();
                continue;
            }

            x.before(i.documentElement.firstChild);
        }
        x.remove();
    }
    return xsltsheet;
};

const XSLTransform = async (xsltsheet, doc) => {
    const xproc = new XSLTProcessor();
    const compiled = await compileImports(xsltsheet);
    xproc.importStylesheet(compiled);
    return xproc.transformToDocument(doc);
};

const previewDoc = async doc => {
    const sheet = await getXSLTSheet(doc);
    return await XSLTransform(sheet, doc);
};

export default previewDoc;
