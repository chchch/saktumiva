import { Sanscript } from './sanscript.mjs';
import EwtsConverter from './EwtsConverter.mjs';

const UTF8 = str => String.fromCodePoint(`0x${str}`);

const _state = Object.seal({
    scriptToIso: new Map([
        ['tamil','Taml'],
        ['bengali','Beng'],
        ['devanagari','Deva'],
        ['grantha','Gran'],
        ['malayalam','Mlym'],
        ['newa','Newa'],
        ['sarada','Shrd'],
        ['sinhala','Sinh'],
        ['telugu','Telu'],
        ['kannada','Knda'],
        ['nandinagari','Nand'],
        ['dbumed','Tibt'],
        ['dbucan','Tibt'],
    ]),
    isoToScript: new Map(),
});

const to = {

    smush: function(text,d_conv = false) {
        // d_conv is DHARMA convention
        if(!d_conv) text = text.toLowerCase();
    
        // remove space between word-final consonant and word-initial vowel
        text = text.replace(/([gḍdrmvynhs])\s+([aāiīuūṛeēoōêô])/g, '$1$2');
    
        if(d_conv) text = text.toLowerCase();
    
        // remove space between word-final consonant and word-intial consonant
        text = text.replace(/([kgcjñḍtdnpbmrlyẏvśṣsṙ]) ([kgcjṭḍtdnpbmyẏrlvśṣshḻ])/g, '$1$2');

        // join final o/e/ā and avagraha/anusvāra
        text = text.replace(/([oōeēā]) ([ṃ'])/g,'$1$2');

        text = text.replace(/ü/g,'\u200Cu');
        text = text.replace(/ï/g,'\u200Ci');

        text = text.replace(/_{1,2}(?=\s*)/g, function(match) {
            if(match === '__') return '\u200D';
            else if(match === '_') return '\u200C';
        });

        return text;
    },
    
    nums: text => {
        const newarr = [];
        const rev = text.split('').reverse();
        let offset = 0;
        for(let i=0; i < rev.length; i++) {
            const num = rev[i];
            const reps = i - offset;
            if(/[23456789]/.test(num))
                newarr.unshift(num + '⁰'.repeat(reps));
            else if(num === '1') {
                if(reps === 0) newarr.unshift('1');
                else newarr.unshift('\u200c'+'⁰'.repeat(reps));
            }
            else if(num !== '0') {
                newarr.unshift(num);
                offset = i+1;
            }
            if(reps === 3) offset = i+1; // only goes up to 1000
        }
        return newarr.join('');
    },

    iast: function(text,from) {
        const f = from || 'tamil';
        const literated = Sanscript.t(text,f,'iast')
            .replace(/^⁰|([^\d⁰])⁰/g,'$1¹⁰');
            //.replace(/l̥/g,'ḷ');
        if(f !== 'tamil')
            return literated.replace(/e/g,'ĕ')
                            .replace(/ē/g,'e')
                            .replace(/o(?!ṁ)/g,'ǒ')
                            .replace(/ō/g,'o');
        else return literated;
    },
    
    ewts: text => {
        const ewts = new EwtsConverter({fix_spacing: true, pass_through: true,fix_sloppy: false});
        return ewts.to_ewts(text.toLowerCase()
                   .replaceAll('ༀ','om̐'))
                   .replaceAll(/[rl]-[iI]/g,(m) => {
                        switch (m) {
                            case 'r-i':
                                return 'ṛ';
                            case 'r-I':
                                return 'ṝ';
                            case 'l-i': 
                                return 'l̥';
                            default:
                                return 'l̥̄';
                        }
                   }).replaceAll(/([gṭḍbd])\+h/g,'$1h');
    },
    dbumed: text => {
        const ewts = new EwtsConverter();
        return ewts.to_unicode(text);
    },
    dbucan: text => {
        const ewts = new EwtsConverter();
        return ewts.to_unicode(text);
    },
    tamil: text => {
        const txt = to.smush(text);
        const grv = new Map([
            ['\u0B82',UTF8('11300')],
            ['\u0BBE',UTF8('1133E')],
            ['\u0BBF',UTF8('1133F')],
            ['\u0BC0',UTF8('11340')],
            ['\u0BC1',UTF8('11341')],
            ['\u0BC2',UTF8('11342')],
            ['\u0BC6',UTF8('11347')],
            ['\u0BC7',UTF8('11347')],
            ['\u0BC8',UTF8('11348')],
            ['\u0BCA',UTF8('1134B')],
            ['\u0BCB',UTF8('1134B')],
            ['\u0BCC',UTF8('1134C')],
            ['\u0BCD',UTF8('1134D')],
            ['\u0BD7',UTF8('11357')]
        ]);
        const grc = [UTF8('11316'),UTF8('11317'),UTF8('11318'),UTF8('1131B'),UTF8('1131D'),UTF8('11320'),UTF8('11321'),UTF8('11322'),UTF8('11325'),UTF8('11326'),UTF8('11327'),UTF8('1132B'),UTF8('1132C'),UTF8('1132D')];

        const smushed = text
            .replace(/([kṅcñṭṇtnpmyrlvḻḷṟṉ])\s+([aāiīuūeēoō])/g, '$1$2')
            //.replace(/ḷ/g,'l̥')
            .replace(/(^|\s)_ā/g,'$1\u0B85\u200D\u0BBE')
            .replace(/(\S)([AĀIĪUŪEĒOŌ])/g,'$1\u200C$2')
            .replace(/(\S)·/g,'$1\u200C')
            .toLowerCase();
        const rgex = new RegExp(`([${grc.join('')}])([${[...grv.keys()].join('')}])`,'g');
        const pretext = Sanscript.t(smushed,'iast','tamil');
        return pretext.replace(rgex, function(m,p1,p2) {
            return p1+grv.get(p2); 
        });
    },
    grantha: function(txt) {
        const grv = new Map([
            [UTF8('11300'),'\u0B82'],
            [UTF8('1133E'),'\u0BBE'],
            [UTF8('1133F'),'\u0BBF'],
            [UTF8('11340'),'\u0BC0'],
            [UTF8('11341'),'\u0BC1'],
            [UTF8('11342'),'\u0BC2'],
            [UTF8('11347'),'\u0BC6'],
            [UTF8('11348'),'\u0BC8'],
            [UTF8('1134B'),'\u0BCA'],
            [UTF8('1134C'),'\u0BCC'],
            [UTF8('1134D'),'\u0BCD'],
            [UTF8('11357'),'\u0BD7']
        ]);
        const tmc = ['\u0BA9','\u0BB1','\u0BB3','\u0BB4'];
        const rgex = new RegExp(`([${tmc.join('')}])([${[...grv.keys()].join('')}])`,'gu');
        //const smushed = txt
        //    .replace(/([kṅcñṭṇtnpmyrlvḻ])\s+([aāiīuūeēoō])/g, '$1$2')
        //    .toLowerCase()
        const smushed = to.smush(txt,true)
            .replace(/e/g,'ē')
            .replace(/o(?![ṁḿ])/g,'ō')
            //.replace(/ḿ/g,'ṁ') // no Jaina oṃkāra
            .replace(/(\S)·/g,'$1\u200C');
            //.replace(/ḷ/g,'l̥');
        const pretext = Sanscript.t(smushed,'iast','grantha');
        return pretext.replace(rgex, function(m,p1,p2) {
            return p1+grv.get(p2); 
        });
    },
    malayalam: function(txt) {
        const chillu = {
            'ക':'ൿ',
            'ണ':'ൺ',
            'ത':'ൽ',
            'ന':'ൻ',
            'മ':'ൔ',
            'ര':'ർ',
            'ല':'ൽ',
            'ള':'ൾ'
        };

        const smushed = to.smush(txt,true)
            .replace(/(^|\s)_ā/,'$1\u0D3D\u200D\u0D3E')
            //.replace(/(^|\s)_r/,"$1\u0D3D\u200D\u0D30\u0D4D");
            //FIXME (replaced by chillu r right now)
            .replace(/ŭ/g,'u\u0D4D')
            .replace(/(\S)·/g,'$1\u200C');
        
        const newtxt = Sanscript.t(smushed,'iast','malayalam')
            // use chillu final consonants	
            .replaceAll(/([കണതനമരലള])്(?![^\s\u200C,—’―])/g, function(match,p1) {
                return chillu[p1];
            });

        /*
        const replacedtxt = _state.features.has('dotReph') ?
            // use dot reph
            newtxt.replace(/(^|[^്])ര്(?=\S)/g,'$1ൎ') :
            newtxt;
        */
        const replacedtxt = newtxt.replace(/(^|[^്])ര്(?=\S)/g,'$1ൎ');

        return replacedtxt;
    },
    
    devanagari: function(txt) {

        const pretext = txt//.replace(/ṙ/g, 'r')
            .replace(/e/g,'ē')
            .replace(/o(?![ṁḿ])/g,'ō')
            .replace(/([^aāiīuūeēoōṛṝl̥l̥̄])ṃ/,'$1\'\u200Dṃ') // standalone anusvāra
            .replace(/([^aāiīuūeēoōṛṝl̥l̥̄])ḥ/,'$1\'\u200Dḥ') // standalone visarga
            .replace(/(^|\s)_y/,'$1\'\u200Dy') // half-form of ya
            .replace(/(^|\s)_ā/g,'$1\u093D\u200D\u093E')
            .replace(/(^|\s)_r/g,'$1\u093D\u200D\u0930\u094D');

        const smushed = to.smush(pretext);

        const text = Sanscript.t(smushed,'iast','devanagari')
            .replace(/¯/g, 'ꣻ');

        return text;
    },

    bengali: function(txt) {

        const pretext = txt//.replace(/ṙ/g, 'r')
            .replace(/e/g,'ē')
            .replace(/o(?![ṁḿ])/g,'ō')
            .replace(/(^|\s)_ā/g,'$1\u093D\u200D\u093E')
            .replace(/(^|\s)_r/g,'$1\u093D\u200D\u0930\u094D');

        const smushed = to.smush(pretext);

        const text = Sanscript.t(smushed,'iast','bengali')
            .replace(/ত্(?=\s)|ত্$/g,'ৎ');
        return text;
    },

    telugu: function(txt) {

        const pretext = txt.replace(/(^|\s)_ā/,'$1\u0C3D\u200D\u0C3E')
            .replace(/(^|\s)_r/,'$1\u0C3D\u200D\u0C30\u0C4D');
        // FIXME: should be moved to the right of the following consonant cluster

        const smushedtext = to.smush(pretext);
        //const replacedtext = _state.features.has('valapalagilaka') ?
        //    smushedtext.replace(/r(?=[kgcjṭḍṇtdnpbmyvlh])/,'ṙ') : smushedtext;
        const replacedtext = smushedtext.replace(/r(?=[kgcjṭḍṇtdnpbmyvlh])/,'ṙ');

        const posttext = replacedtext//.replace(/ê/g,'e') // no pṛṣṭhamātrās
            //.replace(/ô/g,'o') // same with o
            .replace(/ṙ/g,'r\u200D'); // valapalagilaka
            //.replace(/ṁ/g,'ṃ') // no telugu oṃkāra sign
            //.replace(/ḿ/g,'ṃ')
            //.replace(/î/g,'i') // no pṛṣṭhamātrās
            //.replace(/û/g,'u');

        return Sanscript.t(posttext,'iast','telugu');
    },

    kannada: txt => {

        const smushedtext = to.smush(txt);
        const replacedtext = smushedtext.replace(/r(?=[kgcjṭḍṇtdnpbmyvlh])/,'ṙ');

        return Sanscript.t(replacedtext,'iast','kannada');
    },
    

    newa: function(txt) {

        const pretext = txt//.replace(/ṙ/g, 'r')
            .replace(/e/g,'ē')
            .replace(/o(?![ṁḿ])/g,'ō');

        const smushed = to.smush(pretext);

        const text = Sanscript.t(smushed,'iast','newa');

        return text;
    },

    sarada: function(txt) {

        const pretext = txt//.replace(/ṙ/g, 'r')
            .replace(/e/g,'ē')
            .replace(/o(?![ṁḿ])/g,'ō');

        const smushed = to.smush(pretext);

        const text = Sanscript.t(smushed,'iast','sarada')
            .replace(/¯/g, UTF8('111DC'));
        return text;
    },
    
    sinhala: function(txt) {

        const smushed = to.smush(txt);

        return Sanscript.t(smushed,'iast','sinhala');
    },

    nandinagari: function(txt) {

        const pretext = txt//.replace(/ṙ/g, 'r')
            .replace(/e/g,'ē')
            .replace(/o(?![ṁḿ])/g,'ō');

        const smushed = to.smush(pretext);

        const text = Sanscript.t(smushed,'iast','nandinagari')
            .replace(/¯/g, UTF8('119E3'));
        return text;
    },
};

for(const [key, val] of _state.scriptToIso) {
    to[val] = to[key];
}

const Transliterate = Object.freeze({
    to: to
});

export default Transliterate;
