import {send} from './client.mjs'

document.addEventListener('DOMContentLoaded', function () {
  var clientID = window.location.pathname.split('/').pop()
  send({type:'BIR',payload:{clientID}})
  send({type:'GET',topic:'HOT'})

  var btn = document.getElementById('toastBtn')
  if (btn) {
    btn.addEventListener('click', function () {
      send({type:'PUB',topic:'toast',payload:'Hello from Demo!'})
    })
  }
})