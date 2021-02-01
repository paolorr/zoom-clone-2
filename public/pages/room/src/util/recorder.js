class Recorder {
  constructor(username, stream) {
    this.username = username
    this.stream = stream

    this.filename = `id:${username}-when:${Date.now()}`
    this.videoType = 'video/webm'

    this.mediaRecorder = {}
    this.recordedBlobs = []
    this.completedRecordings = []
    this.recordingActive = false
  }

  _setup() {
    const commonCodecs = [
      'codecs=vp9,opus',
      'codecs=vp8,opus',
      ''
    ]

    const options = commonCodecs
      .map(codec => ({ mimeType: `${this.videoType};${codec}` }))
      .find(options => MediaRecorder.isTypeSupported(options.mimeType))

    if (!options) {
      throw new Error(`none of the codecs: ${commonCodecs.join(',')} are supported`)
    }

    return options
  }

  startRecording() {
    const options = this._setup()
    // se nao estiver recebendo video ignora
    if (!this.stream.active) {
      console.log('no stream')
      return
    }

    this.mediaRecorder = new MediaRecorder(this.stream, options)
    console.log('created MediaRecorder', this.mediaRecorder, options)

    this.mediaRecorder.onstop = event => {
      console.log('recorded blobs', this.recordedBlobs)
    }

    this.mediaRecorder.ondataavailable = event => {
      if (!event.data || !event.data.size) {
        return
      }
      this.recordedBlobs.push(event.data)
    }

    this.mediaRecorder.start()
    console.log('media recording started', this.mediaRecorder)
    this.recordingActive = true
  }

  async stopRecording() {
    if (!this.recordingActive || this.mediaRecorder.state === 'inactive') {
      return
    }

    console.log('media recording stopped', this.username)
    this.mediaRecorder.stop()
    this.recordingActive = false
    // para dar tempo de renderizar o video
    await Util.sleep(200)
    this.completedRecordings.push([...this.recordedBlobs])
    this.recordedBlobs = []
  }

  getAllVideoURLs() {
    return this.completedRecordings.map(recording => {
      const superBuffer = new Blob(recording, { type: this.videoType })
      return window.URL.createObjectURL(superBuffer)
    })
  }

  download() {
    if (!this.completedRecordings.length) {
      return
    }

    for (const recording of this.completedRecordings) {
      const blob = new Blob(recording, { type: this.videoType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${this.filename}.webm`
      document.body.appendChild(a)
      a.click()
    }
  }
}