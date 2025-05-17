import {send}from './client.mjs'
class ModeLine extends HTMLElement {
  constructor () {
    super()
    var inp = document.createElement('input')
    inp.placeholder = 'topic'
    this.appendChild(inp)
    inp.addEventListener('keydown',function ( e ) {
      if ( e.key=='Enter' && inp.value ) {
        send({type:'PUB',topic:inp.value,payload:null})
      }
    })
  }
}
customElements.define('mode-line',ModeLine)