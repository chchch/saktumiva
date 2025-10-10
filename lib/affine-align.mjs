import {charSplit, aksaraSplit, graphemeSplit, iast} from './split.mjs';
import {GridMixin} from './structurae/grid.js';

const Float32Grid = GridMixin(Float32Array);
const Uint8Grid = GridMixin(Uint8Array);

// TODO: substitution matrix
const scorechar = ({match = 1, mismatch = -1, missing = '‡'}) => (s1,i,s2,j) => {
    const a = s1[i];
    const b = s2[j];
    if(a === b) return match;
    //if(a === missing || b === missing) return mismatch/2; // TODO: specify this penalty?
    //if(a === '' && b === ' ') return 1;
    //if(a === ' ' && b === '') return 1;
    //if(a === '' || b === '') return -2;
    //if(a === ' ' || b === ' ') return -2;
    //if(iast.vowels.has(a) && iast.vowels.has(b)) return mismatch/2;
    return mismatch;
};

const scorearr = ({match = 1, mismatch = -1, gap_open = 0, gap_extend = -2, missing = '‡'}) => {
	const charfn = scorechar({match: match, mismatch: mismatch, missing: missing});
	const charconf = new charConfig(match,mismatch,gap_open,gap_extend,false);
    const arrEq = (a,b,len) => {
        var i;
        for(i = len; i-- !== 0;)
            if(a[i] !== b[i]) return false;
        return true;
    };

	return (s1,i,s2,j) => {
		const a = s1[i];
		const b = s2[j];
		const alen = a.length;
		const blen = b.length;
		if(alen === 0 && blen === 0) return match; // TODO: maybe something else
		//if(alen === 0 || blen === 0) return mismatch; // TODO: better idea?
        if(alen === blen && arrEq(a,b,alen)) return match;
		const score = alen === 1 && blen === 1 ?
			charfn(a,0,b,0) :
			affineAlign(a,b,charconf,{alignment: false});
		return score / Math.max(alen,blen);
	};
};

const scorearr_simple = ({match = 1, mismatch = -1, missing = '‡'}) => (s1,i,s2,j) => {
    const a = s1[i];
    const b = s2[j];
	const alen = a.length;
	const blen = b.length;
    if(alen === 0 && blen === 0) return match; // TODO: maybe something else
    //if(alen === 0 || blen === 0) return mismatch; // TODO: better idea?
    if(alen !== blen) return mismatch;

    if(a[0] === missing || b[0] === missing) return match/2; // TODO: specify this penalty

    for(let n=0;n<alen;n++)
        if(a[n] !== b[n]) return mismatch;

    return match;
};

const scoremsa = (scorefn) => (arr1,i,arr2,j) => {
    let score = 0;
    let divisor = 0;
    for(const s1 of arr1) {
        for(const s2 of arr2) { 
            const newscore = scorefn(s1,i,s2,j);
            score = score + newscore;
            divisor = divisor + 1;
        }
    }
    return score/divisor; // divisor shouldn't be 0
};

/*
const AlignConfig = function(scorefn, gap_open, gap_extend, gap_skip_initial) {
    this.scorefn = scorefn;
    this.gap = {
        open: gap_open,
        extend: gap_extend,
        skip_initial: gap_skip_initial
    };
};
*/
const arrConfig = function(match, mismatch, gap_open, gap_extend, gap_skip_initial) {
    this.scorefn = scorearr({
        match: match, 
        mismatch: mismatch, 
        gap_open: gap_open, 
        gap_extend: gap_extend
    });
    this.gap = {
        open: gap_open,
        extend: gap_extend,
        skip_initial: gap_skip_initial
    };
};
const arrMsaConfig = function(match, mismatch, gap_open, gap_extend, gap_skip_initial) {
    const scorefn = scorearr({
        match: match, 
        mismatch: mismatch, 
        gap_open: gap_open, 
        gap_extend: gap_extend
    });
    this.scorefn = scoremsa(scorefn);
    this.gap = {
        open: gap_open,
        extend: gap_extend,
        skip_initial: gap_skip_initial
    };
};
const simpleArrConfig = function(match, mismatch, gap_open, gap_extend, gap_skip_initial) {
    this.scorefn = scorearr_simple({match: match, mismatch: mismatch});
    this.gap = {
        open: gap_open,
        extend: gap_extend,
        skip_initial: gap_skip_initial
    };
};

const simpleArrMsaConfig = function(match, mismatch, gap_open, gap_extend, gap_skip_initial) {
    const scorefn = scorearr_simple({match: match, mismatch: mismatch});
    this.scorefn = scoremsa(scorefn);
    this.gap = {
        open: gap_open,
        extend: gap_extend,
        skip_initial: gap_skip_initial
    };
};
const charConfig = function(match, mismatch, gap_open, gap_extend, gap_skip_initial) {
    this.scorefn = scorechar({match: match, mismatch: mismatch});
    this.gap = {
        open: gap_open,
        extend: gap_extend,
        skip_initial: gap_skip_initial
    };
};
const charMsaConfig = function(match, mismatch, gap_open, gap_extend, gap_skip_initial) {
    const scorefn = scorechar({match: match, mismatch: mismatch});
    this.scorefn = scoremsa(scorefn);
    this.gap = {
        open: gap_open,
        extend: gap_extend,
        skip_initial: gap_skip_initial
    };
};

const affineAlign = (s1arr,
                     s2arr,
                     config = new charConfig(1,-1,-2,-0.25,false),
                     options = {
                         alignment: true,
                         matrix: false
                        }
                     ) => {
    const UP   = 1;
    const LEFT = 2;
    const UL   = 3;
    const START = -3.4e38;

    const s1len = s1arr.length;
    const s2len = s2arr.length;

    // initialize matrix
    const mat    = Float32Grid.create(s1len+1,s2len+1);
    const igap   = Float32Grid.create(s1len+1,s2len+1);
    const jgap   = Float32Grid.create(s1len+1,s2len+1);
    const direc  = Uint8Grid.create(s1len+1,s2len+1);

    for(let i=0; i<s1len+1; i++) {
        if(i === 0) {
            mat.setValue(0,0,0);
            igap.setValue(0,0,0);
            jgap.setValue(0,0,0);
            //direc.setValue(0,0,0); // 0 by default; should not be needed
        }
        else {
            const score = config.gap.skip_initial ?  
                config.gap.extend * i :
                config.gap.open + config.gap.extend * i;
            mat.setValue(i,0,score);
            igap.setValue(i,0,score);
            jgap.setValue(i,0,i === 0 ? 0 : START); //i === 0 ? 0 : null;
            direc.setValue(i,0,UP);
        }
    }
    for(let j=1; j<s2len+1; j++) {
        // no gap opening penalty at the beginning
        const score = config.gap.skip_initial ? 
            config.gap.extend * j :
            config.gap.open + config.gap.extend * j;
        mat.setValue(0,j,score);
        igap.setValue(0,j,START); // null;
        jgap.setValue(0,j,score);
        direc.setValue(0,j,LEFT);
    }

    // calculate scores
    for(let i=1; i<s1len+1; i++) {
        for(let j=1; j<s2len+1; j++) {
            const ulscore = mat.getValue(i-1,j-1) + config.scorefn(s1arr,i-1,s2arr,j-1);
            
            // no gap opening penalty at the bottom row
            const bottomrow = config.gap.skip_initial && j === s2len;
            const igapopen = bottomrow ? 
                mat.getValue(i-1,j) :
                mat.getValue(i-1,j) + config.gap.open;

            const previgap = igap.getValue(i-1,j);
            const igapmax = previgap !== START ?
                Math.max(igapopen,previgap) + config.gap.extend : igapopen + config.gap.extend;

            // no gap opening penalty at the last column
            const lastcol = config.gap.skip_initial && i === s1len;
            const jgapopen = lastcol ? 
                mat.getValue(i,j-1) :
                mat.getValue(i,j-1) + config.gap.open;
           
            const prevjgap = jgap.getValue(i,j-1);
            const jgapmax = prevjgap !== START ?
                Math.max(jgapopen,prevjgap) + config.gap.extend : jgapopen + config.gap.extend;

            const maxval = Math.max(ulscore,igapmax,jgapmax);

            mat.setValue(i,j,maxval);
            igap.setValue(i,j,igapmax);
            jgap.setValue(i,j,jgapmax);

            if(maxval === ulscore) direc.setValue(i,j,UL);
            else if(maxval === igapmax) direc.setValue(i,j,UP);
            else if(maxval === jgapmax) direc.setValue(i,j,LEFT);
        }
    }
    
    if(options.alignment !== true)
            return mat.getValue(s1len,s2len);
    // traceback
    const chars = [[],[]];
    var I = s1len;
    var J = s2len;
    let curpath = [s1len,s2len];
    const path = [curpath];
    while(I > 0 || J > 0) {
        switch (direc.getValue(I,J)) {
        case UP:
            I--;
            chars[0].push(s1arr[I]);
            chars[1].push('');
            if(options.matrix) {
				curpath = [curpath[0]-1,curpath[1]];
				path.push(curpath);
			}
            break;
        case LEFT:
            J--;
            chars[0].push('');
            chars[1].push(s2arr[J]);
			if(options.matrix) {
				curpath = [curpath[0],curpath[1]-1];
				path.push(curpath);
			}
            break;
        case UL:
            I--;
            J--;
            chars[0].push(s1arr[I]);
            chars[1].push(s2arr[J]);
			if(options.matrix) {
				curpath = [curpath[0]-1,curpath[1]-1];
				path.push(curpath);
			}
            break;
        default: break;
        }
    }
    chars[0].reverse();
    chars[1].reverse();
    path.reverse();

    // TODO: Semantic cleanup
    // 1. "syād vyutkramaḥ sthāno" vs "s________________thāno"
    //    move single characters preceded by space to other side of gap

    if(options.matrix)
        return [...chars,mat.getValue(s1len,s2len),mat.toArrays(),new Set(path.map(p => p.join(',')))];
    else
        return [...chars,mat.getValue(s1len,s2len)];
        
};

const scoreMsaGap = (arr,n,gapopen) => {
    let score = 0;
    for(const c of arr) {
        if(c[n] !== '') score = score + gapopen;
    }
    return score/arr.length;
};

const alignAlign = (p1arr,
                     p2arr,
                     config = new charMsaConfig(1,-1,-2,-0.25,false)
                   ) => {
    const UP   = 1;
    const LEFT = 2;
    const UL   = 3;
    const START = -3.4e38;

    const p1len = p1arr[0].length;
    const p2len = p2arr[0].length;

    // initialize matrix
    const mat    = Float32Grid.create(p1len+1,p2len+1);
    const igap   = Float32Grid.create(p1len+1,p2len+1);
    const jgap   = Float32Grid.create(p1len+1,p2len+1);
    const direc  = Uint8Grid.create(p1len+1,p2len+1);

    for(let i=0; i<p1len+1; i++) {
        if(i === 0) {
            mat.setValue(0,0,0);
            igap.setValue(0,0,0);
            jgap.setValue(0,0,0);
            //direc.setValue(0,0,0); // previously null
        }
        else {
            const score = config.gap.skip_initial ? 
                config.gap.extend * i :
                config.gap.open + config.gap.extend * i;
            mat.setValue(i,0,score);
            igap.setValue(i,0,score);
            jgap.setValue(i,0,i === 0 ? 0 : START);
            direc.setValue(i,0,UP);
        }
    }
    for(let j=1; j<p2len+1; j++) {
        // no gap opening penalty at the beginning
        const score = config.gap.skip_initial ? 
            config.gap.extend * j :
            config.gap.open + config.gap.extend * j;
        mat.setValue(0,j,score);
        igap.setValue(0,j,START);
        jgap.setValue(0,j,score);
        direc.setValue(0,j,LEFT);
    }

    // calculate scores
    for(let i=1; i<p1len+1; i++) {
        for(let j=1; j<p2len+1; j++) {
            const ulscore = mat.getValue(i-1,j-1) + config.scorefn(p1arr,i-1,p2arr,j-1);
            // no gap opening penalty at the bottom row

            const igapadd = scoreMsaGap(p1arr,i-1,config.gap.open);
            const bottomrow = config.gap.skip_initial && j === p2len;
            const igapopen = bottomrow ? 
                mat.getValue(i-1,j) :
                mat.getValue(i-1,j) + igapadd;

            const previgap = igap.getValue(i-1,j);
            const igapmax = previgap !== START ?
                Math.max(igapopen,previgap) + config.gap.extend : igapopen + config.gap.extend;
            
            // no gap opening penalty at the last column
            const jgapadd = scoreMsaGap(p2arr,j-1,config.gap.open);
            const lastcol = config.gap.skip_initial && i === p1len;
            const jgapopen = lastcol ? 
                mat.getValue(i,j-1) :
                mat.getValue(i,j-1) + jgapadd;
           
            const prevjgap = jgap.getValue(i,j-1);
            const jgapmax = prevjgap !== START ?
                Math.max(jgapopen,prevjgap) + config.gap.extend : jgapopen + config.gap.extend;
            
            const maxval = Math.max(ulscore,igapmax,jgapmax);

            mat.setValue(i,j,maxval);
            igap.setValue(i,j,igapmax);
            jgap.setValue(i,j,jgapmax);

            if( maxval === igapmax) direc.setValue(i,j,UP);
            else if( maxval === jgapmax) direc.setValue(i,j,LEFT);
            else if( maxval === ulscore) direc.setValue(i,j,UL);

        }
    }

    // traceback
    const chars1 = new Array(p1arr.length);
    for(let n=0;n<p1arr.length;n++)
        chars1[n] = [];
    const chars2 = new Array(p2arr.length);
    for(let n=0;n<p2arr.length;n++)
        chars2[n] = [];
    var I = p1len;
    var J = p2len;
    while(I > 0 || J > 0) {
        switch (direc.getValue(I,J)) {
        case UP:
            I--;
            for(let n=0;n<chars1.length;n++)
                chars1[n].unshift(p1arr[n][I]);
            for(const char2 of chars2)
                char2.unshift('');
            break;
        case LEFT:
            J--;
            for(const char1 of chars1)
                char1.unshift('');
            for(let n=0;n<chars2.length;n++)
                chars2[n].unshift(p2arr[n][J]);
            break;
        case UL:
            I--;
            J--;
            for(let n=0;n<chars1.length;n++)
                chars1[n].unshift(p1arr[n][I]);
            for(let n=0;n<chars2.length;n++)
                chars2[n].unshift(p2arr[n][J]);
            break;
        default: break;
        }
    }

    //return [[...chars1,...chars2],mat[p1len][p2len]];
    return [...chars1,...chars2];
        
};
export {affineAlign, alignAlign, charConfig, arrConfig, simpleArrConfig, arrMsaConfig, simpleArrMsaConfig, charMsaConfig };
