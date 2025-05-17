import {send,onMessage} from './client.mjs'
class SharedCheckbox extends HTMLElement {
  constructor () {
    super()
    var shadow = this.attachShadow({mode:'open'})
    var cb = document.createElement('input')
    cb.type = 'checkbox'
    shadow.appendChild(cb)
    cb.addEventListener('change',function () {
      if (!this.id) return
      send({type:'PUB',topic:this.id+'/checked',payload:this.checked})
      send({type:'GET',topic:this.id+'/checked'})
    }.bind(this))
    onMessage(function ( msg ) {
      if (!this.id) return
      if ( msg.topic == this.id+'/checked' ) {
        cb.checked = msg.payload
      }
    }.bind(this))
  }
  connectedCallback () {
    if (!this.id) return
    var t = this.id+'/checked'
    send({type:'GET',topic:t})
    send({type:'SUB',topic:t})
  }
}
customElements.define('shared-checkbox',SharedCheckbox)