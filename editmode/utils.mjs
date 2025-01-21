const loadDoc = async (fn,cache='no-cache') => {
    const res = await fetch(fn, {cache: cache});
    const xmltext = await res.text();
    return (new DOMParser()).parseFromString(xmltext, 'text/xml');
};

export { loadDoc };
