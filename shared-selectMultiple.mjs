import {send,onMessage}from './client.mjs'
class SharedSelectMultiple extends HTMLElement {
  constructor () {
    super()
    var sel = document.createElement('select')
    sel.multiple = true
    this.appendChild(sel)
    onMessage(function ( msg ) {
      if (msg && msg.topic=='HOT' && Array.isArray(msg.payload)) {
        sel.innerHTML = msg.payload.map(function ( t ) { return '<option>'+t+'</option>' }).join('')
      }
    })
    sel.addEventListener('change',function () {
      Array.from(sel.selectedOptions).forEach(function ( opt ) {
        send({type:'SUB',topic:opt.value})
      })
    })
  }
  connectedCallback () {
    send({type:'GET',topic:'HOT'})
  }
}
customElements.define('shared-selectMultiple',SharedSelectMultiple)