import { useState, useRef, useEffect } from 'react'
import { Upload, Settings2, Type, Layers, Video, Move } from 'lucide-react'
import './App.css'

function App() {
  // Video States
  const [userVideoSrc, setUserVideoSrc] = useState(null)

  // Transform States for User Video
  const [videoX, setVideoX] = useState(0)
  const [videoY, setVideoY] = useState(0)
  const [videoZoom, setVideoZoom] = useState(1)
  const [videoWidth, setVideoWidth] = useState(100) // Percentage
  const [videoHeight, setVideoHeight] = useState(100) // Percentage
  const [videoDuration, setVideoDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(10)

  // Text States
  const [text, setText] = useState('এখানে আপনার লেখা দিন')
  const [textX, setTextX] = useState(0)
  const [textY, setTextY] = useState(0)
  const [textSize, setTextSize] = useState(24)
  const [textColor, setTextColor] = useState('#ffffff')
  const [textShadow, setTextShadow] = useState(true)
  const [textBold, setTextBold] = useState(false)
  const [textFont, setTextFont] = useState('SolaimanLipi')
  const [textAlign, setTextAlign] = useState('center')

  // Frame States
  const [frameAssetSrc, setFrameAssetSrc] = useState(null)
  const [frameAssetType, setFrameAssetType] = useState('video') // 'video' or 'image'
  const [frameBlendMode, setFrameBlendMode] = useState('normal')
  const [frameZoom, setFrameZoom] = useState(1)
  const [frameX, setFrameX] = useState(0)
  const [frameY, setFrameY] = useState(0)

  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const fileInputRef = useRef(null)
  const frameInputRef = useRef(null)
  const userVideoRef = useRef(null)
  const assetVideoRef = useRef(null)
  const canvasRef = useRef(null)

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setUserVideoSrc(url)
      // Reset trim when new video uploaded
      setTrimStart(0)
    }
  }

  const onVideoLoad = (e) => {
    const duration = e.target.duration
    setVideoDuration(duration)
    setTrimEnd(duration)
  }

  const handleFrameUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setFrameAssetSrc(url)
      if (file.type.startsWith('image/')) {
        setFrameAssetType('image')
      } else {
        setFrameAssetType('video')
      }
    }
  }

  const exportVideo = async () => {
    if (!userVideoSrc) {
      alert("Please upload a video first!")
      return
    }

    setIsExporting(true)
    setExportProgress(0)

    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext('2d')

    const userVid = userVideoRef.current
    const assetVid = assetVideoRef.current
    const stream = canvas.captureStream(30) // 30 FPS

    // Setup audio from user video
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const dest = audioCtx.createMediaStreamDestination()
    if (userVid.captureStream) {
      const userStream = userVid.captureStream()
      userStream.getAudioTracks().forEach(track => {
        const source = audioCtx.createMediaStreamSource(new MediaStream([track]))
        source.connect(dest)
      })
    }

    const combinedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ])

    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
      ? 'video/mp4;codecs=avc1'
      : 'video/webm;codecs=vp9';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 12000000 // 12 Mbps for High Quality
    })

    const chunks = []

    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = () => {
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reels-video.${extension}`
      a.click()
      setIsExporting(false)
    }

    // Reset videos to start from trim point
    userVid.currentTime = trimStart
    if (assetVid) assetVid.currentTime = 0

    await userVid.play()
    if (assetVid) await assetVid.play()

    recorder.start()

    const renderFrame = () => {
      if (userVid.paused || userVid.ended || userVid.currentTime >= trimEnd) {
        recorder.stop()
        userVid.pause()
        if (assetVid) assetVid.pause()
        return
      }

      const previewEl = document.querySelector('.preview-container')
      const pWidth = previewEl.clientWidth
      const pHeight = previewEl.clientHeight
      const scaleX = canvas.width / pWidth
      const scaleY = canvas.height / pHeight

      // 1. Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 2. Draw User Video
      ctx.save()
      const centerX = canvas.width / 2 + videoX * scaleX
      const centerY = canvas.height / 2 + videoY * scaleY
      const vidScale = videoZoom * (videoWidth / 100)
      ctx.translate(centerX, centerY)
      ctx.scale(vidScale, vidScale)
      ctx.drawImage(userVid, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
      ctx.restore()

      // 3. Draw Frame
      if (frameAssetSrc) {
        ctx.save()
        if (frameBlendMode !== 'normal') ctx.globalCompositeOperation = frameBlendMode === 'screen' ? 'screen' : (frameBlendMode === 'multiply' ? 'multiply' : 'overlay')

        const fCenterX = canvas.width / 2 + frameX * scaleX
        const fCenterY = canvas.height / 2 + frameY * scaleY
        ctx.translate(fCenterX, fCenterY)
        ctx.scale(frameZoom, frameZoom)

        if (frameAssetType === 'video' && assetVid) {
          ctx.drawImage(assetVid, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
        } else if (frameAssetType === 'image') {
          const img = document.querySelector('.asset-video')
          if (img) ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
        }
        ctx.restore()
      }

      // 4. Draw Text
      ctx.save()
      const exportTextSize = textSize * scaleX
      if (textFont === 'Noto Serif Bengali Black') {
        ctx.font = `900 ${exportTextSize}px "Noto Serif Bengali"`
      } else if (textFont === 'Noto Serif Bengali Bold') {
        ctx.font = `700 ${exportTextSize}px "Noto Serif Bengali"`
      } else {
        ctx.font = `${textBold ? 'bold ' : ''}${exportTextSize}px ${textFont}`
      }

      ctx.fillStyle = textColor
      ctx.textAlign = textAlign === 'left' ? 'left' : (textAlign === 'right' ? 'right' : 'center')
      ctx.textBaseline = 'middle'

      if (textShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.9)'
        ctx.shadowBlur = 10 * scaleX
        ctx.shadowOffsetX = 2 * scaleX
        ctx.shadowOffsetY = 2 * scaleX
      }

      const tX = canvas.width / 2 + textX * scaleX
      const tY = canvas.height / 2 + textY * scaleY

      const lines = text.split('\n')
      const lineHeight = exportTextSize * 1.3
      const totalHeight = lines.length * lineHeight

      // Adjust tY to start from top of the block to match flex centering
      const startY = tY - (totalHeight / 2) + (lineHeight / 2)

      // Calculate max line width for alignment adjustment
      let maxWidth = 0
      lines.forEach(line => {
        const metrics = ctx.measureText(line)
        if (metrics.width > maxWidth) maxWidth = metrics.width
      })

      lines.forEach((line, i) => {
        let drawX = tX
        if (textAlign === 'left') {
          drawX = tX - (maxWidth / 2)
        } else if (textAlign === 'right') {
          drawX = tX + (maxWidth / 2)
        }
        ctx.fillText(line, drawX, startY + (i * lineHeight))
      })
      ctx.restore()

      setExportProgress(((userVid.currentTime - trimStart) / (trimEnd - trimStart)) * 100)
      requestAnimationFrame(renderFrame)
    }

    renderFrame()
  }

  // Sync play state
  useEffect(() => {
    const handlePlay = () => {
      if (assetVideoRef.current) {
        assetVideoRef.current.play().catch(e => console.log("Asset video play prevented:", e))
      }
    }
    const handlePause = () => {
      if (assetVideoRef.current) {
        assetVideoRef.current.pause()
      }
    }

    if (userVideoRef.current) {
      userVideoRef.current.addEventListener('play', handlePlay)
      userVideoRef.current.addEventListener('pause', handlePause)
      userVideoRef.current.addEventListener('timeupdate', () => {
        if (userVideoRef.current.currentTime >= trimEnd) {
          userVideoRef.current.currentTime = trimStart
        }
        if (userVideoRef.current.currentTime < trimStart) {
          userVideoRef.current.currentTime = trimStart
        }
      })
      userVideoRef.current.addEventListener('seeking', () => {
        if (assetVideoRef.current) assetVideoRef.current.currentTime = userVideoRef.current.currentTime - trimStart
      })
    }

    if (assetVideoRef.current) {
      assetVideoRef.current.play().catch(e => console.log("Auto-play blocked"))
    }

    return () => {
      if (userVideoRef.current) {
        userVideoRef.current.removeEventListener('play', handlePlay)
        userVideoRef.current.removeEventListener('pause', handlePause)
      }
    }
  }, [userVideoSrc, frameAssetSrc])

  return (
    <div className="app-container">
      {/* Sidebar Controls */}
      <div className="sidebar">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <h1>MIT Reels Maker</h1>
          </div>
          <p>Composite video & text with custom frame</p>
        </div>

        <div className="control-group">
          <h2 className="control-title"><Video size={16} /> Upload Video</h2>
          <input
            type="file"
            accept="video/*"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden-input"
          />
          <button className="upload-btn" onClick={() => fileInputRef.current.click()}>
            <Upload size={18} /> Choose Video
          </button>
        </div>

        <div className="control-group">
          <h2 className="control-title"><Move size={16} /> User Video Controls</h2>
          <div className="control-row">
            <label>Zoom (Scale): <span>{videoZoom}x</span></label>
            <input type="range" min="0.1" max="5" step="0.05" value={videoZoom} onChange={(e) => setVideoZoom(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Position X: <span>{videoX}px</span></label>
            <input type="range" min="-1000" max="1000" value={videoX} onChange={(e) => setVideoX(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Position Y: <span>{videoY}px</span></label>
            <input type="range" min="-1000" max="1000" value={videoY} onChange={(e) => setVideoY(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Width %: <span>{videoWidth}%</span></label>
            <input type="range" min="10" max="300" value={videoWidth} onChange={(e) => setVideoWidth(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Height %: <span>{videoHeight}%</span></label>
            <input type="range" min="10" max="300" value={videoHeight} onChange={(e) => setVideoHeight(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Trim Range (Timeline)</label>
            <div className="timeline-container">
              <div className="timeline-base">
                <div
                  className="timeline-range"
                  style={{
                    left: `${(trimStart / videoDuration) * 100}%`,
                    width: `${((trimEnd - trimStart) / videoDuration) * 100}%`
                  }}
                />
                <div
                  className="timeline-progress"
                  style={{ left: `${(userVideoRef.current?.currentTime / videoDuration) * 100}%` }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px' }}>Start: {trimStart.toFixed(1)}s</label>
                <input
                  type="range"
                  min="0"
                  max={videoDuration}
                  step="0.1"
                  value={trimStart}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const newStart = Math.min(val, trimEnd - 0.1);
                    setTrimStart(newStart);
                    if (userVideoRef.current) userVideoRef.current.currentTime = newStart;
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px' }}>End: {trimEnd.toFixed(1)}s</label>
                <input
                  type="range"
                  min="0"
                  max={videoDuration}
                  step="0.1"
                  value={trimEnd}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const newEnd = Math.max(val, trimStart + 0.1);
                    setTrimEnd(newEnd);
                    if (userVideoRef.current) userVideoRef.current.currentTime = newEnd;
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="control-group">
          <h2 className="control-title"><Type size={16} /> Text Settings (Bangla)</h2>
          <div className="control-row">
            <label>Text Content</label>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="বাংলা টেক্সট লিখুন..."
            />
          </div>
          <div className="control-row">
            <label>Font Size: <span>{textSize}px</span></label>
            <input type="range" min="10" max="200" value={textSize} onChange={(e) => setTextSize(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Position X: <span>{textX}px</span></label>
            <input type="range" min="-500" max="500" value={textX} onChange={(e) => setTextX(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Position Y: <span>{textY}px</span></label>
            <input type="range" min="-800" max="800" value={textY} onChange={(e) => setTextY(e.target.value)} />
          </div>
          <div className="control-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ margin: 0 }}>Color</label>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ padding: 0, width: '40px', height: '30px' }} />
          </div>
          <div className="control-row">
            <label>Font Family</label>
            <select value={textFont} onChange={(e) => setTextFont(e.target.value)}>
              <option value="SolaimanLipi">SolaimanLipi</option>
              <option value="Noto Serif Bengali">Noto Serif Bengali Regular</option>
              <option value="Noto Serif Bengali Bold">Noto Serif Bengali Bold</option>
              <option value="Noto Serif Bengali Black">Noto Serif Bengali Black</option>
            </select>
          </div>
          <div className="control-row">
            <label>Text Alignment</label>
            <select value={textAlign} onChange={(e) => setTextAlign(e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="control-row" style={{ flexDirection: 'row', gap: '15px' }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={textShadow} onChange={(e) => setTextShadow(e.target.checked)} />
              Shadow
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={textBold} onChange={(e) => setTextBold(e.target.checked)} />
              Bold
            </label>
          </div>
        </div>

        <div className="control-group">
          <h2 className="control-title"><Layers size={16} /> Frame Controls</h2>
          <input
            type="file"
            accept="image/*,video/*"
            ref={frameInputRef}
            onChange={handleFrameUpload}
            className="hidden-input"
          />
          <button className="upload-btn" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }} onClick={() => frameInputRef.current.click()}>
            <Upload size={18} /> Upload Frame (PNG/MOV)
          </button>

          <div className="control-row">
            <label>Blend Mode</label>
            <select value={frameBlendMode} onChange={(e) => setFrameBlendMode(e.target.value)}>
              <option value="normal">Normal (Default)</option>
              <option value="screen">Screen (Transparent Black)</option>
              <option value="multiply">Multiply (Transparent White)</option>
              <option value="overlay">Overlay</option>
            </select>
          </div>
          <div className="control-row">
            <label>Frame Zoom: <span>{frameZoom}x</span></label>
            <input type="range" min="0.1" max="5" step="0.01" value={frameZoom} onChange={(e) => setFrameZoom(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Frame X: <span>{frameX}px</span></label>
            <input type="range" min="-1000" max="1000" value={frameX} onChange={(e) => setFrameX(e.target.value)} />
          </div>
          <div className="control-row">
            <label>Frame Y: <span>{frameY}px</span></label>
            <input type="range" min="-1000" max="1000" value={frameY} onChange={(e) => setFrameY(e.target.value)} />
          </div>
        </div>

        <button
          className="upload-btn"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            marginTop: 'auto',
            padding: '16px'
          }}
          onClick={exportVideo}
          disabled={isExporting}
        >
          {isExporting ? `Exporting ${Math.round(exportProgress)}%...` : 'Export & Download Video'}
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="main-content">
        <div className="preview-container">

          {/* Layer 1: User Video */}
          <div className="layer-user-video">
            {userVideoSrc ? (
              <video
                ref={userVideoRef}
                src={userVideoSrc}
                className="user-video"
                onLoadedMetadata={onVideoLoad}
                controls
                loop
                style={{
                  transform: `translate(${videoX}px, ${videoY}px) scale(${videoZoom})`,
                  width: `${videoWidth}%`,
                  height: `${videoHeight}%`,
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{ color: '#475569', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                <Video size={48} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                Please upload a video to preview
              </div>
            )}
          </div>

          {/* Layer 2: Asset Frame (Image or Video) */}
          <div
            className="layer-asset"
            style={{
              mixBlendMode: frameBlendMode,
              transform: `translate(${frameX}px, ${frameY}px) scale(${frameZoom})`
            }}
          >
            {frameAssetSrc ? (
              frameAssetType === 'video' ? (
                <video
                  ref={assetVideoRef}
                  src={frameAssetSrc}
                  className="asset-video"
                  loop
                  muted
                  autoPlay
                  playsInline
                  onError={(e) => {
                    console.error("Frame Video Error:", e);
                    const errorEl = document.getElementById('frame-error');
                    if (errorEl) errorEl.style.display = 'flex';
                  }}
                />
              ) : (
                <img
                  src={frameAssetSrc}
                  className="asset-video"
                  alt="Frame"
                  style={{ objectFit: 'contain' }}
                />
              )
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                No frame uploaded
              </div>
            )}

            {/* Fallback error UI */}
            <div
              id="frame-error"
              style={{
                display: 'none',
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(255,0,0,0.2)',
                color: 'white',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '20px',
                fontSize: '12px',
                backdropFilter: 'blur(4px)'
              }}
            >
              <span style={{ fontWeight: 'bold', marginBottom: '8px' }}>Frame Error!</span>
              <span>আপনার .mov ফাইলটি ব্রাউজারে সাপোর্ট করছে না। অনুগ্রহ করে এটিকে .mp4 ফরম্যাটে কনভার্ট করুন।</span>
            </div>
          </div>

          {/* Layer 3: Text Overlay */}
          <div className="layer-text">
            <div
              className="bengali-text"
              style={{
                transform: `translate(${textX}px, ${textY}px)`,
                fontSize: `${textSize}px`,
                fontFamily: textFont.includes('Noto') ? '"Noto Serif Bengali"' : textFont,
                fontWeight: textFont.includes('Black') ? 900 : (textFont.includes('Bold') || textBold ? 'bold' : 'normal'),
                textAlign: textAlign,
                color: textColor,
                textShadow: textShadow ? '0 2px 10px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.5)' : 'none'
              }}
            >
              {text}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}


export default App
