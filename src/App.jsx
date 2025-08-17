import React, { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [image, setImage] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 })
  const [blurIntensity, setBlurIntensity] = useState(10)
  const [mosaicSize, setMosaicSize] = useState(10)
  const [effectType, setEffectType] = useState('blur')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageRef = useRef(null)

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          setImage(img)
          saveToHistory(img)
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    }
  }

  const saveToHistory = (imageData) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (imageData instanceof Image) {
      canvas.width = imageData.width
      canvas.height = imageData.height
      ctx.drawImage(imageData, 0, 0)
    } else {
      canvas.width = canvasRef.current.width
      canvas.height = canvasRef.current.height
      ctx.putImageData(imageData, 0, 0)
    }
    
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      redrawCanvas(history[historyIndex - 1])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      redrawCanvas(history[historyIndex + 1])
    }
  }

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const link = document.createElement('a')
    link.download = 'edited-photo.png'
    link.href = canvas.toDataURL()
    link.click()
  }

  const redrawCanvas = (imageData) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.putImageData(imageData, 0, 0)
  }

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      canvas.width = image.width
      canvas.height = image.height
      ctx.drawImage(image, 0, 0)
    }
  }, [image])

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    }
  }

  const handleMouseDown = (event) => {
    if (!image) return
    const coords = getCanvasCoordinates(event)
    setDragStart(coords)
    setDragEnd(coords)
    setIsDragging(true)
  }

  const handleMouseMove = (event) => {
    if (!isDragging || !image) return
    const coords = getCanvasCoordinates(event)
    setDragEnd(coords)
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0)
    
    const x = Math.min(dragStart.x, coords.x)
    const y = Math.min(dragStart.y, coords.y)
    const width = Math.abs(coords.x - dragStart.x)
    const height = Math.abs(coords.y - dragStart.y)
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(x, y, width, height)
  }

  const applyBlur = (ctx, x, y, width, height) => {
    const imageData = ctx.getImageData(x, y, width, height)
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    
    tempCanvas.width = width
    tempCanvas.height = height
    tempCtx.putImageData(imageData, 0, 0)
    tempCtx.filter = `blur(${blurIntensity}px)`
    tempCtx.drawImage(tempCanvas, 0, 0)
    
    const blurredData = tempCtx.getImageData(0, 0, width, height)
    ctx.putImageData(blurredData, x, y)
  }

  const applyMosaic = (ctx, x, y, width, height) => {
    const imageData = ctx.getImageData(Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height))
    const data = imageData.data
    const w = Math.floor(width)
    const h = Math.floor(height)
    
    for (let py = 0; py < h; py += mosaicSize) {
      for (let px = 0; px < w; px += mosaicSize) {
        let r = 0, g = 0, b = 0, count = 0
        
        const blockWidth = Math.min(mosaicSize, w - px)
        const blockHeight = Math.min(mosaicSize, h - py)
        
        for (let dy = 0; dy < blockHeight; dy++) {
          for (let dx = 0; dx < blockWidth; dx++) {
            const idx = ((py + dy) * w + (px + dx)) * 4
            r += data[idx]
            g += data[idx + 1]
            b += data[idx + 2]
            count++
          }
        }
        
        if (count > 0) {
          r = Math.round(r / count)
          g = Math.round(g / count)
          b = Math.round(b / count)
          
          for (let dy = 0; dy < blockHeight; dy++) {
            for (let dx = 0; dx < blockWidth; dx++) {
              const idx = ((py + dy) * w + (px + dx)) * 4
              data[idx] = r
              data[idx + 1] = g
              data[idx + 2] = b
            }
          }
        }
      }
    }
    
    ctx.putImageData(imageData, Math.floor(x), Math.floor(y))
  }

  const handleMouseUp = () => {
    if (!isDragging || !image) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const x = Math.min(dragStart.x, dragEnd.x)
    const y = Math.min(dragStart.y, dragEnd.y)
    const width = Math.abs(dragEnd.x - dragStart.x)
    const height = Math.abs(dragEnd.y - dragStart.y)
    
    if (width > 5 && height > 5) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)
      
      if (effectType === 'blur') {
        applyBlur(ctx, x, y, width, height)
      } else {
        applyMosaic(ctx, x, y, width, height)
      }
      
      const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      saveToHistory(newImageData)
      
      const newImage = new Image()
      newImage.onload = () => setImage(newImage)
      newImage.src = canvas.toDataURL()
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)
    }
    
    setIsDragging(false)
  }

  return (
    <div className="app">
      <div className="controls">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />
        <button onClick={() => fileInputRef.current.click()}>
          이미지 선택
        </button>
        
        <div className="effect-controls">
          <label>
            효과 타입:
            <select value={effectType} onChange={(e) => setEffectType(e.target.value)}>
              <option value="blur">블러</option>
              <option value="mosaic">모자이크</option>
            </select>
          </label>
          
          {effectType === 'blur' ? (
            <label>
              블러 강도: {blurIntensity}px
              <input
                type="range"
                min="1"
                max="50"
                value={blurIntensity}
                onChange={(e) => setBlurIntensity(Number(e.target.value))}
              />
            </label>
          ) : (
            <label>
              모자이크 크기: {mosaicSize}px
              <input
                type="range"
                min="5"
                max="50"
                value={mosaicSize}
                onChange={(e) => setMosaicSize(Number(e.target.value))}
              />
            </label>
          )}
        </div>
        
        <div className="history-controls">
          <button onClick={undo} disabled={historyIndex <= 0}>
            실행 취소
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1}>
            다시 실행
          </button>
          <button onClick={downloadImage} disabled={!image}>
            다운로드
          </button>
        </div>
      </div>
      
      <div className="canvas-container">
        {image ? (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        ) : (
          <div className="placeholder">
            이미지를 선택해주세요
          </div>
        )}
      </div>
    </div>
  )
}

export default App