import {send,onMessage}from './client.mjs'
class SharedTabs extends HTMLElement {
  constructor () {
    super()
    var div = document.createElement('div')
    this.appendChild(div)
    onMessage(function ( msg ) {
      if (msg && msg.topic=='BIR' && msg.payload && msg.payload.clientID) {
        var id = msg.payload.clientID
        div.innerHTML += '<button>'+id+'</button>'
      }
    })
  }
  connectedCallback () {
    send({type:'GET',topic:'clients'})
    send({type:'SUB',topic:'BIR'})
  }
}
customElements.define('shared-tabs',SharedTabs)