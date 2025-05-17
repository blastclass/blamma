import {send,onMessage}from './client.mjs'
class SharedTheme extends HTMLElement {
  constructor () {
    super()
    var sel = document.createElement('select')
    ;['gruvbox','light','dark'].forEach(function ( t ) {
      sel.innerHTML += '<option>'+t+'</option>'
    })
    this.appendChild(sel)
    sel.addEventListener('change',function () {
      send({type:'PUB',topic:'theme',payload:sel.value})
    })
    onMessage(function ( msg ) {
      if (msg && msg.topic=='theme') {
        document.documentElement.setAttribute('data-theme',msg.payload)
      }
    })
    send({type:'GET',topic:'theme'})
    send({type:'SUB',topic:'theme'})
  }
}
customElements.define('shared-theme',SharedTheme)