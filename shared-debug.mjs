import {send,onMessage} from './client.mjs'
class SharedDebug extends HTMLElement {
  constructor () {
    super()
    var shadow = this.attachShadow({mode:'open'})
    var wrap = document.createElement('div')
    wrap.style.cssText = 'position:fixed;bottom:0;height:30%;width:100%;opacity:0.5;background:#000'
    var ta = document.createElement('textarea')
    ta.style.width = '100%'
    ta.style.height = '100%'
    wrap.appendChild(ta)
    shadow.appendChild(wrap)
    wrap.addEventListener('click',function () { wrap.style.display = wrap.style.display=='none'? 'block':'none' })
    onMessage(function ( msg ) {
      if ( msg && (msg.type=='BIR'||msg.type=='BYE'||msg.type=='ERR') ) {
        ta.value += JSON.stringify(msg)+'\n'
      }
    })
  }
}
customElements.define('shared-debug',SharedDebug)