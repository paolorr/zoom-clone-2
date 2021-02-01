class Business {
  constructor({ room, media, view, socketBuilder, peerBuilder }) {
    this.room = room
    this.media = media
    this.view = view

    this.socketBuilder = socketBuilder
    this.peerBuilder = peerBuilder

    this.socket - {}
    this.currentStream = {}
    this.currentPeer = {}

    this.peers = new Map()
    this.userRecordings = new Map()
  }

  static initialize(deps) {
    const instance = new Business(deps)
    return instance._init()
  }

  async _init() {
    this.view.configureRecordButton(this.onRecordPress.bind(this))
    this.view.configureLeaveButton(this.onLeavePress.bind(this))

    this.currentStream = await this.media.getCamera() //.getCamera()
    this.socket = this.socketBuilder
      .setOnUserConnected(this.onUserConnected())
      .setOnUserDisconnected(this.onUserDisconnected())
      .build()
    this.currentPeer = await this.peerBuilder
      .setOnError(this.onPeerError())
      .setOnConnectionOpened(this.onPeerConnectionOpened())
      .setOnCallReceived(this.onPeerCallReceived())
      .setOnPeerStreamReceived(this.onPeerStreamReceived())
      .setOnCallError(this.onPeerCallError())
      .setOnCallClose(this.onPeerCallClose())
      .build()
    this.addVideoStream(this.currentPeer.id)
  }

  addVideoStream(userId, stream = this.currentStream) {
    const recorderInstance = new Recorder(userId, stream)
    this.userRecordings.set(recorderInstance.filename, recorderInstance)
    if (this.recordingEnabled) {
      recorderInstance.startRecording()
    }

    const isCurrentId = false
    this.view.renderVideo({
      userId,
      // muted: false,
      stream,
      isCurrentId
    })
  }

  // nao usa direto uma arrow function pois, assim, pode-se usar o this (se necessario) sem ter que usar bind
  onUserConnected = function () {
    return userId => {
      console.log('user connected!', userId)
      //quem faz a ligacao de video nao eh o usuario que entrou, mas os usuarios que ja estavam na sala quando recebem a notificacao do socket que o usuario conectou. Ou seja, o novo usuario recebe ligacao de todos que ja estao na sala
      this.currentPeer.call(userId, this.currentStream)
    }
  }

  onUserDisconnected = function () {
    return userId => {
      console.log('user disconnected!', userId)

      if (this.peers.has(userId)) {
        this.peers.get(userId).call.close()
        this.peers.delete(userId)
      }

      this.view.setParticipants(this.peers.size)
      this.stopRecording(userId)
      this.view.removeVideoElement(userId)
    }
  }

  onPeerError = function () {
    return error => {
      console.error('error on peer!', error)
    }
  }

  onPeerConnectionOpened = function () {
    return peer => {
      const id = peer.id
      console.log('peer!', peer);
      this.socket.emit('join-room', this.room, id)
    }
  }

  onPeerCallReceived = function () {
    return call => {
      console.log('answering call', call);
      call.answer(this.currentStream)
    }
  }

  onPeerStreamReceived = function () {
    return (call, stream) => {
      const callerId = call.peer
      this.addVideoStream(callerId, stream)
      this.peers.set(callerId, { call })
      this.view.setParticipants(this.peers.size)
    }
  }

  onPeerCallError = function () {
    return (call, error) => {
      console.log('an call error ocurred!', error)
      this.view.removeVideoElement(call.peer)
    }
  }

  onPeerCallClose = function () {
    return call => {
      console.log('call closed!', call.peer)
    }
  }

  // diferentemente dos outros eventos, este nao esta em forma de closure, por isso que ao passa-lo na funcao _init() foi necessario usar o bind
  // poderia ter sido feito em forma de closure, mas nao foi feito so para mostrar as duas possibilidades
  onRecordPress(recordingEnabled) {
    this.recordingEnabled = recordingEnabled
    console.log('pressionou!!', recordingEnabled)
    for (const [key, value] of this.userRecordings) {
      if (this.recordingEnabled) {
        value.startRecording()
        continue
      }
      this.stopRecording(key)
    }
  }

  // se o usuario entrar e sair da call durante uma gravacao
  // precisamos para as gravaoes anteriores dele
  async stopRecording(userId) {
    const userRecordings = this.userRecordings
    for (const [key, value] of userRecordings) {
      const isContextUser = key.includes(userId)
      if (!isContextUser) {
        continue
      }

      const rec = value
      const isRecordingActive = rec.recordingActive
      if (!isRecordingActive) {
        continue
      }

      await rec.stopRecording()
      this.playRecordings(key)
    }
  }

  playRecordings(userId) {
    const user = this.userRecordings.get(userId)
    const videoURLs = user.getAllVideoURLs()
    videoURLs.map(url => {
      this.view.renderVideo({ url, userId })
    })
  }

  onLeavePress() {
    this.userRecordings.forEach((value, key) => value.download())
  }
}