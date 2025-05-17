import {send}from './client.mjs'
class HotkeySensor extends HTMLElement {
  constructor () {
    super()
    var combo = this.getAttribute('combo')
    window.addEventListener('keydown',function ( e ) {
      if ( combo && e.key == combo ) {
        send({type:'PUB',topic:'hotkey/'+combo,payload:{}})
      }
    })
  }
}
customElements.define('hotkey-sensor',HotkeySensor)