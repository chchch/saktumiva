const alignHTML = 
`
<style>
.popup {
    width: 80%;
    min-height: 50%;
    display: flex;
    height: fit-content;
    max-height: 100vh;
    background: rgba(255,255,248,0.7);
    padding: 1rem;
    margin: 1rem;
    font-size: 1.1rem;
    flex-direction: column;
    border-radius: 0.3rem;
    display: none;
}
.popup-header {
    display: flex;
    justify-content: flex-end;
}

.closeicon {
    cursor: pointer;
}
.closeicon svg {
    fill: rgba(133,133,133,0.8);
}
.closeicon:hover svg {
    fill: #ff9900;
}

.boxen {
    flex-grow: 1;
    display: flex;
    flex-direction: row;
}

.boxen > * {
    flex-grow: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
}
fieldset {
    background: white;
}
#blocklist {
    overflow-y: scroll;
    max-height: 85vh;
}
.popup button {
    width: max-content;
    padding: 0.5rem;
    align-self: center;
}
.checklist label {
    margin-right: 1rem;
}
input:disabled+label {
    opacity: 0.5;
}
.spinner {
    display: none;
    width: 3rem;
    height: 3rem;
    border: 1px solid rgba(0,0,0,.3);
    border-radius: 50%;
    border-top-color: rgb(0,0,0);
    animation: spin 1s linear infinite;
    align-self: center;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}
    th {
        text-align: left;
    }
    figure {
    	margin: revert;
    }
    figcaption {
    	float: initial;
    	clear: initial;
    	max-width: initial;
    }
.options {
    display: none;
    flex-direction: row;
    justify-content: space-around;
    padding: 0;
    margin: 0;
    width: 85%;
}

label {
    font-size: 1.2rem;
    padding: 0.5rem;
}
.input-box {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    padding: 1rem;
    width: 85%;
}

input[type="text"] {
    flex-grow: 1;
    height: 2rem;
    font-size: 1.2rem;
    padding: 0.5rem;
}

input[type="number"] {
    width: 3.5rem;
}

details {
    width: 33%;
    margin-bottom: 1.5rem;
    margin-left: 2rem;
    margin-right: 2rem;
}

details > details {
    width: unset;
    margin-right: 0;
}

details > details summary {
    font-size: 1.3rem;
}

details > :not(summary) {
    margin-left: 1rem;
}
summary {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
}

.horizontal {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
}

.horizontal > label {
    width: 4rem;
}

details details > div {
    width: 15rem;
}

input[name="language"] {
    margin-top: 0.6rem;
}

input[name="language"] ~ details {
    margin-top: 0.3rem;
}
input[name="language"] ~ details summary {
    height: 0;
}

input[name="language"]:not(:checked) ~ details {
    display: none;
}
#scoring label {
    display: inline-block;
    width: 9.5rem;
}

#guidetree label {
    width: fit-content;
}

#results {
    width: fit-content;
}
#results td, #matrix td {
padding: 0.5rem;
text-align: center;
border: 1px dotted black;
line-height: 200%;
word-break: keep-all;
}

#matrix td {
padding: 0.2rem;
line-height: 110%;
}
#matrix td:first-child, #matrix tr:first-child {
    background: lightgrey;
    font-weight: bold;
}

#results td:empty {
background: grey;
}

rt {
    font-size: 1.1rem;
    color: darkorchid;
}
.highlit {
    background: yellow;
}

#inputboxen {
    display: flex;
    flex-direction: row;
    width: 85%;
    justify-content: space-between;
}

#xml-ids-box {
    width: 45%;
    height: 20em;
    overflow-y: scroll;
    background: white;
    padding: 0;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
}
#teifiles {
    opacity: 0;
    width: 0;
    height: 0;
}
button, label[for="teifiles"] {
    background-color: rgb(240,202,121);
    border-color: rgb(240,202,121);
    border-radius: 0.3rem;
    font-size: 1.2rem;
    padding: 0.5rem;
    box-shadow: rgba(0,0,0,0.24) 0px 3px 8px;
}
button:hover, label[for="teifiles"]:hover {
    background: #eeee99;
    border-color: #eeee99;
}
#alignsubmit {
    font-size: 1.2rem;
    padding: 0.5rem;
    margin-top:1rem;
    margin-bottom:1rem;
    display: none;
}

.checklist {
    flex-grow: 1;
}

</style>
<div id="aligner-popup" class="popup">
<div class="popup-header">
    <span class="closeicon">
<svg height="32px" width="32px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" version="1.1" style="shape-rendering: geometricprecision; text-rendering: geometricprecision; image-rendering: optimizequality; width: 15px; height: 15px;" viewBox="0 0 847 847" x="0px" y="0px" fill-rule="evenodd" clip-rule="evenodd">
<g><path class="fil0" d="M423 272l217 -217c99,-99 251,53 151,152l-216 216 216 217c100,99 -52,251 -151,151l-217 -216 -216 216c-99,100 -251,-52 -152,-151l217 -217 -217 -216c-99,-99 53,-251 152,-152l216 217z"></path></g></svg>
    </span>
</div>
<div class="boxen">
            <div id="inputboxen">
                <fieldset id="file-input-box"><legend>Texts to align</legend>
                    <div class="checklist"></div>
                    <label for="teifiles">Upload your TEI XML files</label><input type="file" autocomplete="off" id="teifiles" name="teifiles" accept=".xml" multiple/>
                </fieldset>
                <fieldset id="xml-ids-box"><legend>Blocks to align</legend><div class="checklist"></div></fieldset>
            </div>
            <div style="display: flex; width: 85%; justify-content: flex-end">
                <button id="alignsubmit">Align</button>
            </div>
            <fieldset class="options">
                <legend>Options</legend>
                <details id="scoring" open>
                    <summary>Scoring</summary>
                    <details id="guidetree">
                        <summary>Guide tree</summary>
                        <div>
                            <input type="radio" name="input_treetype" id="treetype_ncd" value="ncd" />
                            <label for="treetype_ncd"><abbr title="Normalized compression distance">NCD</abbr></label>
                        </div>
                        <div>
                            <input type="radio" name="input_treetype" id="treetype_ngrams" value="ngrams" checked />
                            <label for="treetype_ngrams">Ngrams</label>
                            <input type="number" id="tree_ngramsize" value="3"/>
                        </div>
                    </details>
                    <div><label for="input_match">Match score</label><input class="score" id="input_match" type="number" value="1"/></div>
                    <div><label for="input_mismatch">Mismatch score</label><input class="score" id="input_mismatch" type="number" value="-1"/></div>
                    <div><label for="input_gapopen">Gap opening score</label><input class="score" id="input_gapopen" type="number" value="-2"/></div>
                    <div><label for="input_gapext">Gap extension score</label><input class="score" id="input_gapext" type="number" value="-0.25"/></div>
                    <div><input type="checkbox" id="input_scalegap" /><label style="text-decoration: 2px gray dotted underline" title="Automatically scale gap scores based on text similarity and length" for="input_scalegap">Autoscale gap scores</label></div>
                    <div><input type="checkbox" id="check_recursive" checked /><label style="text-decoration: 2px gray dotted underline" title="When scoring akṣaras or larger units, recursively score the consonants and vowels within them" for="check_recursive">Recursive scoring</label></div>
                    <div><label for="input_realigndepth" style="text-decoration: 2px gray dotted underline" title="Number of iterative re-alignments to perform, starting from the leaves and moving up the guide tree">Re-alignment depth</label><input class="score" id="input_realigndepth" type="number" value="20"/></div>
                </details>
                <details open>
                    <summary>Tokenization</summary>
                    <div>
                        <input type="radio" name="tokenization" value="whitespace" id="radio_whitespace"/><label for="radio_whitespace">Whitespace-delimited</label>
                    </div>
                    <div>
                        <input type="radio" name="tokenization" value="aksara" id="radio_aksara"/><label for="radio_aksara">Akṣara (conjuncts and vowels together)</label>
                    </div>
                    <div>
                        <input type="radio" name="tokenization" value="grapheme" id="radio_grapheme" checked/><label for="radio_grapheme">Eḻuttu (without conjuncts)</label>
                    </div>
                    <div>
                        <input type="radio" name="tokenization" id="radio_character" value="character"/><label for="radio_character">Consonants and vowels separate</label>
                    </div>
                    <div>
                        <select name="targetedition" id="targetedition"></select><label for="targetedition">Target edition</label>
                    </div>
                </details>
                <details id="normalization" open>
                    <summary>Normalization</summary>
                    <!--div><input type="checkbox"><label>Remove whitespace</label></div-->
                    <div class="horizontal">
                        <input type="checkbox" name="language" id="check_tamil" autocomplete="off"/><label for="check_tamil">Tamil</label>
                        <details class="tamil">
                            <summary></summary>
                        </details>
                    </div>
                    <div class="horizontal">
                        <input type="checkbox" name="language" id="check_sanskrit" autocomplete="off"/><label for="check_sanskrit">Sanskrit</label>
                        <details class="sanskrit">
                            <summary></summary>
                        </details>
                    </div>
                    <div class="horizontal">
                        <input type="checkbox" name="language" id="check_pali" autocomplete="off"/><label for="check_pali">Pali</label>
                        <details class="pali">
                            <summary></summary>
                        </details>
                    </div>
                </details>
                <details id="xmltags">
                    <summary>XML Tags</summary>
                </details>
            </fieldset>
  </div>
</div>
`;
export default alignHTML;
