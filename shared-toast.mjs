import {send,onMessage}from './client.mjs'
class SharedToast extends HTMLElement {
  constructor () {
    super()
    onMessage(function ( msg ) {
      if (msg && msg.topic=='toast') {
        var d = document.createElement('div')
        d.textContent = msg.payload
        document.body.appendChild(d)
        setTimeout(function () { document.body.removeChild(d) },3000)
      }
    })
    send({type:'SUB',topic:'toast'})
  }
}
customElements.define('shared-toast',SharedToast)