import {send,onMessage}from './client.mjs'
class SharedSlider extends HTMLElement {
  constructor () {
    super()
    var s = document.createElement('input')
    s.type = 'range'
    this.appendChild(s)
    s.addEventListener('input',function () {
      if (!this.id) return
      send({type:'PUB',topic:this.id+'/value',payload:s.value})
    }.bind(this))
    onMessage(function ( msg ) {
      if (!this.id) return
      if ( msg.topic==this.id+'/value' ) {
        s.value = msg.payload
      }
    }.bind(this))
  }
  connectedCallback () {
    if (!this.id) return
    send({type:'GET',topic:this.id+'/value'})
    send({type:'SUB',topic:this.id+'/value'})
  }
}
customElements.define('shared-slider',SharedSlider)