// Script to generate PWA icons from SVG
// Run: node generate-icons.js
// Requires: npm install sharp

import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

// Simple canvas-based icon generator
function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#6366f1')
  grad.addColorStop(1, '#a855f7')

  // Rounded rect
  const r = size * 0.22
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Lightning bolt emoji
  ctx.font = `${size * 0.55}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⚡', size / 2, size / 2)

  writeFileSync(outputPath, canvas.toBuffer('image/png'))
  console.log(`Generated ${outputPath}`)
}

generateIcon(192, 'public/icon-192.png')
generateIcon(512, 'public/icon-512.png')
generateIcon(180, 'public/apple-touch-icon.png')
