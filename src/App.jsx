import React, { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

function App() {
  const [image, setImage] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 })
  const [blurIntensity, setBlurIntensity] = useState(25)
  const [mosaicSize, setMosaicSize] = useState(10)
  const [effectType, setEffectType] = useState('mosaic')
  const [editMode, setEditMode] = useState('drag')
  const [brushSize, setBrushSize] = useState(20)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [brushPath, setBrushPath] = useState([])
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [showBrushCursor, setShowBrushCursor] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
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
    link.download = 'edited-photo.jpg'
    link.href = canvas.toDataURL('image/jpeg', 0.9)
    link.click()
  }

  const redrawCanvas = (imageData) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.putImageData(imageData, 0, 0)

    const newImage = new Image()
    newImage.onload = () => setImage(newImage)
    newImage.src = canvas.toDataURL('image/jpeg', 0.95)
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

  const applyEffectAtPoint = (ctx, x, y, radius) => {
    const size = radius * 2
    const startX = Math.max(0, x - radius)
    const startY = Math.max(0, y - radius)
    const width = Math.min(size, ctx.canvas.width - startX)
    const height = Math.min(size, ctx.canvas.height - startY)

    if (width <= 0 || height <= 0) return

    if (effectType === 'blur') {
      applyBlur(ctx, startX, startY, width, height)
    } else {
      applyMosaic(ctx, startX, startY, width, height)
    }
  }

  const drawBrushPreview = (ctx, path, radius) => {
    if (path.length === 0) return

    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'

    for (let i = 0; i < path.length; i++) {
      ctx.beginPath()
      ctx.arc(path[i].x, path[i].y, radius, 0, 2 * Math.PI)
      ctx.fill()
    }

    ctx.restore()
  }

  const drawBrushCursor = (ctx, x, y, radius) => {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'
    ctx.lineWidth = 5
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)'
    ctx.lineWidth = 5
    ctx.setLineDash([5, 5])
    ctx.lineDashOffset = 5
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.stroke()

    ctx.restore()
  }

  const applyMosaicToBrushPath = (ctx, path, radius) => {
    if (path.length === 0) return

    const processedPixels = new Set()

    for (const point of path) {
      const centerX = Math.round(point.x)
      const centerY = Math.round(point.y)

      for (let y = centerY - radius; y <= centerY + radius; y++) {
        for (let x = centerX - radius; x <= centerX + radius; x++) {
          const dx = x - centerX
          const dy = y - centerY
          if (dx * dx + dy * dy <= radius * radius) {
            const blockX = Math.floor(x / mosaicSize) * mosaicSize
            const blockY = Math.floor(y / mosaicSize) * mosaicSize
            const blockKey = `${blockX},${blockY}`

            if (!processedPixels.has(blockKey) &&
              blockX >= 0 && blockY >= 0 &&
              blockX < ctx.canvas.width && blockY < ctx.canvas.height) {

              const blockWidth = Math.min(mosaicSize, ctx.canvas.width - blockX)
              const blockHeight = Math.min(mosaicSize, ctx.canvas.height - blockY)

              const imageData = ctx.getImageData(blockX, blockY, blockWidth, blockHeight)
              const data = imageData.data

              let r = 0, g = 0, b = 0, count = 0

              for (let i = 0; i < data.length; i += 4) {
                r += data[i]
                g += data[i + 1]
                b += data[i + 2]
                count++
              }

              if (count > 0) {
                r = Math.round(r / count)
                g = Math.round(g / count)
                b = Math.round(b / count)

                for (let i = 0; i < data.length; i += 4) {
                  data[i] = r
                  data[i + 1] = g
                  data[i + 2] = b
                }

                ctx.putImageData(imageData, blockX, blockY)
                processedPixels.add(blockKey)
              }
            }
          }
        }
      }
    }
  }

  const handleMouseDown = (event) => {
    if (!image) return
    const coords = getCanvasCoordinates(event)

    if (editMode === 'drag') {
      setDragStart(coords)
      setDragEnd(coords)
      setIsDragging(true)
    } else if (editMode === 'brush') {
      setIsDrawing(true)
      setLastPos(coords)
      setBrushPath([coords])
    }
  }

  const handleMouseMove = (event) => {
    if (!image) return
    const coords = getCanvasCoordinates(event)
    setMousePos(coords)

    if (editMode === 'drag' && isDragging) {
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
    } else if (editMode === 'brush' && isDrawing) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      const dx = coords.x - lastPos.x
      const dy = coords.y - lastPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.floor(distance / 5))

      const newPoints = []
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const x = lastPos.x + dx * t
        const y = lastPos.y + dy * t
        newPoints.push({ x, y })
      }

      const updatedPath = [...brushPath, ...newPoints]
      setBrushPath(updatedPath)

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)
      drawBrushPreview(ctx, updatedPath, brushSize / 2)

      setLastPos(coords)
    } else if (editMode === 'brush' && !isDrawing) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)
      drawBrushCursor(ctx, coords.x, coords.y, brushSize / 2)
    }
  }

  const applyBlur = useCallback((ctx, x, y, width, height) => {
    const actualX = Math.floor(x)
    const actualY = Math.floor(y)
    const actualWidth = Math.floor(width)
    const actualHeight = Math.floor(height)
    
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    
    tempCanvas.width = actualWidth
    tempCanvas.height = actualHeight
    
    const imageData = ctx.getImageData(actualX, actualY, actualWidth, actualHeight)
    tempCtx.putImageData(imageData, 0, 0)
    
    const scale = Math.max(0.05, 1 - (blurIntensity / 50))
    const blurredWidth = Math.max(1, Math.floor(actualWidth * scale))
    const blurredHeight = Math.max(1, Math.floor(actualHeight * scale))
    
    const blurCanvas = document.createElement('canvas')
    const blurCtx = blurCanvas.getContext('2d')
    blurCanvas.width = blurredWidth
    blurCanvas.height = blurredHeight
    
    blurCtx.imageSmoothingEnabled = true
    blurCtx.drawImage(tempCanvas, 0, 0, actualWidth, actualHeight, 0, 0, blurredWidth, blurredHeight)
    
    tempCtx.clearRect(0, 0, actualWidth, actualHeight)
    tempCtx.imageSmoothingEnabled = true
    tempCtx.drawImage(blurCanvas, 0, 0, blurredWidth, blurredHeight, 0, 0, actualWidth, actualHeight)
    
    const blurredData = tempCtx.getImageData(0, 0, actualWidth, actualHeight)
    ctx.putImageData(blurredData, actualX, actualY)
  }, [blurIntensity])

  const applyMosaic = useCallback((ctx, x, y, width, height) => {
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
  }, [mosaicSize])

  const handleMouseUp = () => {
    if (!image) return

    if (editMode === 'drag' && isDragging) {
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
        newImage.src = canvas.toDataURL('image/jpeg', 0.95)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0)
      }

      setIsDragging(false)
    } else if (editMode === 'brush' && isDrawing) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0)

      if (effectType === 'blur') {
        for (const point of brushPath) {
          applyEffectAtPoint(ctx, point.x, point.y, brushSize / 2)
        }
      } else {
        applyMosaicToBrushPath(ctx, brushPath, brushSize / 2)
      }

      const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      saveToHistory(newImageData)

      const newImage = new Image()
      newImage.onload = () => setImage(newImage)
      newImage.src = canvas.toDataURL('image/jpeg', 0.95)

      setIsDrawing(false)
      setBrushPath([])
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🛡️ Privacy Shield</h1>
        <p className="subtitle">개인정보 보호 이미지 편집기</p>
        <button 
          className="info-toggle" 
          onClick={() => setShowInfo(!showInfo)}
        >
          {showInfo ? '📋 사용법 및 개인정보 보호 안내 접기 ▲' : '📋 사용법 및 개인정보 보호 안내 펼치기 ▼'}
        </button>
        {showInfo && (
          <div className="info-section">
            <div className="usage-info">
              <h3>💡 사용법</h3>
              <ul>
                <li>📸 이미지를 선택하고 편집 모드를 선택하세요</li>
                <li>🖱️ <strong>드래그 모드</strong>: 영역을 드래그해서 선택</li>
                <li>✏️ <strong>펜 모드</strong>: 마우스로 자유롭게 그리기</li>
                <li>🔧 효과 타입과 강도를 조절할 수 있습니다</li>
              </ul>
            </div>
            <div className="privacy-info">
              <h3>🔒 개인정보 보호</h3>
              <p>• 모든 이미지는 브라우저에서만 처리됩니다</p>
              <p>• 서버에 업로드되거나 저장되지 않습니다</p>
              <p>• 100% 로컬 처리로 완전한 프라이버시 보장</p>
            </div>
          </div>
        )}
      </header>
      
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
            편집 모드:
            <select value={editMode} onChange={(e) => setEditMode(e.target.value)}>
              <option value="drag">드래그 선택</option>
              <option value="brush">펜 모드</option>
            </select>
          </label>

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

          {editMode === 'brush' && (
            <label>
              펜 굵기: {brushSize}px
              <input
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
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
            className={editMode === 'brush' ? 'brush-mode' : ''}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseEnter={() => editMode === 'brush' && setShowBrushCursor(true)}
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