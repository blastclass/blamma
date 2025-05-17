import {send,onMessage}from './client.mjs'
class BrokerTelemetry extends HTMLElement {
  constructor () {
    super()
    var pre = document.createElement('pre')
    this.appendChild(pre)
    send({type:'SUB',pattern:'$SYS/*'})
    onMessage(function ( msg ) {
      if (msg && msg.topic && msg.topic.indexOf('$SYS/')==0 ) {
        pre.textContent = JSON.stringify(msg)+'\n'+pre.textContent
      }
    })
  }
}
customElements.define('broker-telemetry',BrokerTelemetry)