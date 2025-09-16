const popupHTML = 
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
</style>
<div id="variants-popup" class="popup">
<div class="popup-header">
    <span class="closeicon">
<svg height="32px" width="32px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" version="1.1" style="shape-rendering: geometricprecision; text-rendering: geometricprecision; image-rendering: optimizequality; width: 15px; height: 15px;" viewBox="0 0 847 847" x="0px" y="0px" fill-rule="evenodd" clip-rule="evenodd">
<g><path class="fil0" d="M423 272l217 -217c99,-99 251,53 151,152l-216 216 216 217c100,99 -52,251 -151,151l-217 -216 -216 216c-99,100 -251,-52 -152,-151l217 -217 -217 -216c-99,-99 53,-251 152,-152l216 217z"></path></g></svg>
    </span>
</div>
<div class="boxen">
    <fieldset>
        <legend>Blocks to collate</legend>
        <div id="blocklist"></div>
    </fieldset>
    <div>
        <fieldset style="margin-bottom: 1rem">
            <legend>Options</legend>
            <div id="variantsfileselect">
                <div>
                    <input type="checkbox" id="normlem" checked="true"/>
                    <label>Use normalized readings</label>
                </div>
                <div>
                    <input type="checkbox" id="mergerdgs" checked="true"/>
                    <label>Merge groups</label>
                </div>
            </div>
        </fieldset>
        <button id="collatebutton">Collate!</button>
        <div class="spinner"></div>
    </div>
</div>
</div>

<div id="export-popup" class="popup">
<div class="popup-header">
    <span class="closeicon">
<svg height="32px" width="32px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" version="1.1" style="shape-rendering: geometricprecision; text-rendering: geometricprecision; image-rendering: optimizequality; width: 15px; height: 15px;" viewBox="0 0 847 847" x="0px" y="0px" fill-rule="evenodd" clip-rule="evenodd">
<g><path class="fil0" d="M423 272l217 -217c99,-99 251,53 151,152l-216 216 216 217c100,99 -52,251 -151,151l-217 -216 -216 216c-99,100 -251,-52 -152,-151l217 -217 -217 -216c-99,-99 53,-251 152,-152l216 217z"></path></g></svg>
    </span>
</div>
<div class="boxen">
  <div>
  <div>
    <input type="checkbox" id="export-underline" checked="true"/>
    <label for="export-underline">Underline lemmata</label>
  </div>
  <div>
    <input type="checkbox" id="export-line-breaks"/>
    <label for="export-line-breaks">Include <code>lb</code> line breaks</label>
  </div>
  <div>
    <input type="checkbox" id="export-page-breaks"/>
    <label for="export-page-breaks">Include <code>pb</code> page breaks</label>
  </div>
  </div>
  <div>
    <button id="exportbutton">Export LaTeX</button>
  </div>
</div>
</div>
</div>
`;
export default popupHTML;
