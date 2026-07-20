import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, TEXT_RESOLUTION } from './constants.js'
import { t } from './i18n.js'

// 로켓 게임의 dodgeflyer-* 키와 절대 겹치지 않도록 이 게임만의 별도 localStorage 키를 쓴다
// (기존 유저의 코인/스킨 데이터를 건드리지 않기 위함).
const FISHING_COINS_KEY = 'fishing-coins'
const FISHING_BEST_KEY = 'fishing-best-catch'
const FISHING_ROD_TIER_KEY = 'fishing-rod-tier'

const DOCK_Y = 70
const DESCEND_SPEED = 170 // px/sec
const ASCEND_SPEED = 230 // 내려가는 것보다 빨리 올라와야 손맛이 산다
const HOOK_CATCH_RADIUS = 28
const ROUND_DURATION_MS = 50000

// 단계가 오를수록 더 깊이 내려갈 수 있어서(=더 희귀/고가치 물고기 구간에 도달) 코인으로 강화한다.
const UPGRADE_TIERS = [
  { cost: 0, maxDepth: 220 },
  { cost: 40, maxDepth: 320 },
  { cost: 100, maxDepth: 420 },
  { cost: 220, maxDepth: 520 },
  { cost: 400, maxDepth: 560 },
]

// 이모지 대신 로켓/구름/운석처럼 이 코드베이스의 방식대로 Graphics로 직접 그린 실루엣을 쓴다
// (몸통 타원 + 꼬리/등지느러미 삼각형 + 눈). minDepth 이상 강화해야 그 구간에 출현.
const FISH_TYPES = [
  { id: 'small', radius: 11, body: 0x8fd3ff, fin: 0x4fc3f7, minDepth: 70, maxDepth: 260, value: 2, speed: 70 },
  { id: 'medium', radius: 14, body: 0xffa64d, fin: 0xcc7a1a, minDepth: 180, maxDepth: 380, value: 5, speed: 90 },
  { id: 'large', radius: 17, body: 0xffe066, fin: 0xd4a017, minDepth: 300, maxDepth: 480, value: 12, speed: 110 },
  { id: 'rare', radius: 20, body: 0xb388ff, fin: 0x7c4dff, minDepth: 420, maxDepth: 560, value: 30, speed: 130 },
]

export class FishingScene extends Phaser.Scene {
  constructor() {
    super('FishingScene')
  }

  create(data) {
    this.state = 'ready'
    this.totalCoins = Number(localStorage.getItem(FISHING_COINS_KEY) || 0)
    this.bestCatch = Number(localStorage.getItem(FISHING_BEST_KEY) || 0)
    this.rodTier = Number(localStorage.getItem(FISHING_ROD_TIER_KEY) || 0)
    this.holding = false
    this.hookY = DOCK_Y
    this.tripValue = 0
    this.roundCoins = 0
    this.roundTimeLeft = ROUND_DURATION_MS

    this.drawBackground()
    this.createUI()

    this.input.on('pointerdown', (pointer, currentlyOver) => this.handlePointerDown(currentlyOver))
    this.input.on('pointerup', () => this.handlePointerUp())
    this.input.keyboard.on('keydown-SPACE', () => this.handlePointerDown([]))
    this.input.keyboard.on('keyup-SPACE', () => this.handlePointerUp())

    this.fishGroup = this.physics.add.group()
    this.hazardGroup = this.physics.add.group()

    this.fishSpawnTimer = this.time.addEvent({
      delay: this.getFishInterval(),
      loop: true,
      paused: true,
      callback: () => {
        this.spawnFish()
        this.fishSpawnTimer.delay = this.getFishInterval()
      },
    })
    this.hazardSpawnTimer = this.time.addEvent({
      delay: this.getHazardInterval(),
      loop: true,
      paused: true,
      callback: () => {
        this.spawnHazard()
        this.hazardSpawnTimer.delay = this.getHazardInterval()
      },
    })

    if (data && data.autoStart) this.startGame()
  }

  drawBackground() {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1e5a8a, 0x1e5a8a, 0x02121f, 0x02121f, 1)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.fillStyle(0x6b4423, 1)
    bg.fillRect(0, 50, GAME_WIDTH, 24)
  }

  createUI() {
    const textStyle = {
      fontFamily: 'system-ui, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: TEXT_RESOLUTION,
    }

    this.readyTitleText = this.add
      .text(GAME_WIDTH / 2, 60, t('fishingReadyTitle'), { ...textStyle, fontSize: '26px' })
      .setOrigin(0.5)
    this.readyDescText = this.add
      .text(GAME_WIDTH / 2, 150, t('fishingReadyDesc', { coins: this.totalCoins, best: this.bestCatch }), {
        ...textStyle,
        fontSize: '14px',
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: GAME_WIDTH - 60 },
      })
      .setOrigin(0.5)

    this.upgradeButtonBg = this.add
      .rectangle(GAME_WIDTH / 2, 250, 240, 40, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0x4fc3f7)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.purchaseUpgrade())
    this.upgradeButtonBg.isUiButton = true
    this.upgradeButtonText = this.add
      .text(GAME_WIDTH / 2, 250, '', { ...textStyle, fontSize: '14px' })
      .setOrigin(0.5)

    this.readyCtaText = this.add
      .text(GAME_WIDTH / 2, 320, t('fishingReadyCta'), { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)

    // 로켓 게임과 동일한 스타일/위치의 허브 복귀 버튼.
    this.hubButtonBg = this.add
      .rectangle(40, 20, 72, 28, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0xff8a4f)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.state !== 'ready') return
        this.scene.start('HubScene')
      })
    this.hubButtonBg.isUiButton = true
    this.hubButtonText = this.add.text(40, 20, t('hubButtonLabel'), { ...textStyle, fontSize: '12px' }).setOrigin(0.5)

    this.refreshReadyTexts()

    // 플레이 중 UI
    this.timerText = this.add
      .text(GAME_WIDTH / 2, 25, '', { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false)
    this.tripText = this.add
      .text(0, 0, '', { ...textStyle, fontSize: '15px', color: '#ffe066' })
      .setOrigin(0, 0.5)
      .setVisible(false)
    this.lineGraphics = this.add.graphics()
    this.hookGraphics = this.add.graphics()

    // 라운드 종료 화면
    this.roundOverTitleText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, '', { ...textStyle, fontSize: '20px', align: 'center' })
      .setOrigin(0.5)
      .setVisible(false)
    this.roundOverBestText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, '', { ...textStyle, fontSize: '16px' })
      .setOrigin(0.5)
      .setVisible(false)
    this.roundOverNewBestText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 6, t('fishingNewBest'), { ...textStyle, fontSize: '16px', color: '#ffe066' })
      .setOrigin(0.5)
      .setVisible(false)
    this.restartYesText = this.add
      .text(GAME_WIDTH / 2 - 45, GAME_HEIGHT / 2 + 80, t('restartYes'), { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.time.delayedCall(0, () => this.scene.restart({ autoStart: true })))
    this.restartYesText.isUiButton = true
    this.restartNoText = this.add
      .text(GAME_WIDTH / 2 + 45, GAME_HEIGHT / 2 + 80, t('restartNo'), { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.time.delayedCall(0, () => this.scene.restart()))
    this.restartNoText.isUiButton = true
  }

  refreshReadyTexts() {
    this.readyDescText.setText(t('fishingReadyDesc', { coins: this.totalCoins, best: this.bestCatch }))
    const nextTier = this.rodTier + 1
    if (nextTier < UPGRADE_TIERS.length) {
      this.upgradeButtonText.setText(t('fishingUpgradeLabel', { cost: UPGRADE_TIERS[nextTier].cost }))
    } else {
      this.upgradeButtonText.setText(t('fishingUpgradeMax'))
    }
  }

  purchaseUpgrade() {
    if (this.state !== 'ready') return
    const nextTier = this.rodTier + 1
    if (nextTier >= UPGRADE_TIERS.length) return
    const cost = UPGRADE_TIERS[nextTier].cost
    if (this.totalCoins < cost) {
      this.showFloatPopup(GAME_WIDTH / 2, 290, t('shopNotEnoughCoins'), '#ff6b4a')
      return
    }
    this.totalCoins -= cost
    this.rodTier = nextTier
    localStorage.setItem(FISHING_COINS_KEY, String(this.totalCoins))
    localStorage.setItem(FISHING_ROD_TIER_KEY, String(this.rodTier))
    this.refreshReadyTexts()
  }

  maxDepthForTier() {
    return UPGRADE_TIERS[this.rodTier].maxDepth
  }

  handlePointerDown(currentlyOver = []) {
    if (currentlyOver.some((obj) => obj.isUiButton)) return
    if (this.state === 'ready') this.startGame()
    else if (this.state === 'playing') this.holding = true
  }

  handlePointerUp() {
    if (this.state === 'playing') this.holding = false
  }

  startGame() {
    if (this.state !== 'ready') return
    this.state = 'playing'
    this.hookY = DOCK_Y
    this.tripValue = 0
    this.roundCoins = 0
    this.roundTimeLeft = ROUND_DURATION_MS
    this.holding = false

    this.readyTitleText.setVisible(false)
    this.readyDescText.setVisible(false)
    this.upgradeButtonBg.setVisible(false)
    this.upgradeButtonText.setVisible(false)
    this.readyCtaText.setVisible(false)
    this.hubButtonBg.setVisible(false)
    this.hubButtonText.setVisible(false)

    this.timerText.setVisible(true)

    this.fishSpawnTimer.paused = false
    this.hazardSpawnTimer.paused = false
  }

  getFishInterval() {
    return Phaser.Math.Between(700, 1400)
  }

  getHazardInterval() {
    return Phaser.Math.Between(3000, 5000)
  }

  spawnFish() {
    if (this.state !== 'playing') return
    const candidates = FISH_TYPES.filter((f) => f.minDepth <= this.maxDepthForTier())
    if (candidates.length === 0) return
    const type = Phaser.Utils.Array.GetRandom(candidates)
    const fromLeft = Math.random() < 0.5
    const startX = fromLeft ? -30 : GAME_WIDTH + 30
    const vx = (fromLeft ? 1 : -1) * type.speed
    const y = Phaser.Math.Between(type.minDepth, Math.min(type.maxDepth, this.maxDepthForTier()))

    const circle = this.add.circle(startX, y, 14, 0x000000, 0)
    this.physics.add.existing(circle)
    this.fishGroup.add(circle)
    circle.body.allowGravity = false
    circle.body.setImmovable(true)
    circle.body.setVelocity(vx, 0)
    circle.fishType = type
    circle.caught = false
    const textureKey = this.ensureFishTexture(type)
    circle.visual = this.add.image(startX, y, textureKey).setOrigin(0.5).setFlipX(!fromLeft)
  }

  spawnHazard() {
    if (this.state !== 'playing') return
    const fromLeft = Math.random() < 0.5
    const startX = fromLeft ? -30 : GAME_WIDTH + 30
    const speed = 150
    const vx = (fromLeft ? 1 : -1) * speed
    const hazardMin = Math.min(200, this.maxDepthForTier())
    const y = Phaser.Math.Between(hazardMin, this.maxDepthForTier())

    const circle = this.add.circle(startX, y, 16, 0x000000, 0)
    this.physics.add.existing(circle)
    this.hazardGroup.add(circle)
    circle.body.allowGravity = false
    circle.body.setImmovable(true)
    circle.body.setVelocity(vx, 0)
    const textureKey = this.ensureSharkTexture()
    circle.visual = this.add.image(startX, y, textureKey).setOrigin(0.5).setFlipX(!fromLeft)
  }

  // 물고기/상어 실루엣을 로켓/구름/운석과 같은 방식(Graphics로 한 번 그려서 텍스처로 굽고 재사용)으로
  // 만든다 — 이모지 글리프 대신 크기/색으로 종류를 구분하는 단순하지만 일관된 실루엣.
  ensureFishTexture(type) {
    const key = `fish-${type.id}`
    if (this.textures.exists(key)) return key
    const r = type.radius
    const w = r * 2.6
    const h = r * 1.6
    const canvasW = w + r * 1.4
    const canvasH = h + r * 1.6
    const cx = canvasW / 2
    const cy = canvasH / 2
    const g = this.add.graphics()
    g.fillStyle(type.fin, 1)
    g.fillTriangle(cx - w / 2 - r * 0.5, cy, cx - w / 2 + 2, cy - r * 0.5, cx - w / 2 + 2, cy + r * 0.5)
    g.fillTriangle(cx - r * 0.2, cy - h / 2, cx + r * 0.3, cy - h / 2 - r * 0.4, cx + r * 0.5, cy - h / 2)
    g.fillStyle(type.body, 1)
    g.fillEllipse(cx, cy, w, h)
    g.fillStyle(0x0a0a0a, 1)
    g.fillCircle(cx + w / 2 - r * 0.5, cy - r * 0.15, r * 0.15)
    g.generateTexture(key, canvasW, canvasH)
    g.destroy()
    return key
  }

  ensureSharkTexture() {
    const key = 'fishing-hazard-shark'
    if (this.textures.exists(key)) return key
    const w = 70
    const h = 28
    const canvasW = w + 44
    const canvasH = h + 44
    const cx = canvasW / 2
    const cy = canvasH / 2
    const g = this.add.graphics()
    g.fillStyle(0x5a6b74, 1)
    g.fillEllipse(cx, cy, w, h)
    g.fillTriangle(cx + w * 0.1, cy - h / 2, cx + w * 0.32, cy - h / 2 - 18, cx + w * 0.42, cy - h / 2)
    g.fillTriangle(cx - w / 2 - 14, cy, cx - w / 2 + 4, cy - h * 0.35, cx - w / 2 + 4, cy + h * 0.35)
    g.fillStyle(0xe8e8e8, 1)
    g.fillTriangle(cx + w / 2 - 6, cy - 4, cx + w / 2 + 14, cy, cx + w / 2 - 6, cy + 8)
    g.fillStyle(0x0a0a0a, 1)
    g.fillCircle(cx + w / 2 - 14, cy - 6, 3)
    g.generateTexture(key, canvasW, canvasH)
    g.destroy()
    return key
  }

  destroyFish(fish) {
    if (fish.visual) fish.visual.destroy()
    fish.destroy()
  }

  destroyHazard(hazard) {
    if (hazard.visual) hazard.visual.destroy()
    hazard.destroy()
  }

  catchFish(fish) {
    fish.caught = true
    this.tripValue += fish.fishType.value
    this.playCatchSound()
    this.showFloatPopup(fish.x, fish.y, `+${fish.fishType.value}`, '#8fe3ff')
    this.destroyFish(fish)
  }

  hitHazard(hazard) {
    if (this.tripValue > 0) {
      this.showFloatPopup(GAME_WIDTH / 2, this.hookY, t('fishingSnap'), '#ff6b4a')
    }
    this.tripValue = 0
    this.hookY = DOCK_Y
    this.playSnapSound()
    this.destroyHazard(hazard)
  }

  bankTrip() {
    this.totalCoins += this.tripValue
    this.roundCoins += this.tripValue
    localStorage.setItem(FISHING_COINS_KEY, String(this.totalCoins))
    this.showFloatPopup(GAME_WIDTH / 2, DOCK_Y - 20, t('fishingBankPopup', { coins: this.tripValue }), '#ffe066')
    this.playBankSound()
    this.tripValue = 0
  }

  endRound() {
    if (this.tripValue > 0) this.bankTrip()
    this.state = 'roundOver'
    this.fishSpawnTimer.paused = true
    this.hazardSpawnTimer.paused = true
    this.fishGroup.children.each((f) => this.destroyFish(f))
    this.hazardGroup.children.each((h) => this.destroyHazard(h))
    this.lineGraphics.clear()
    this.hookGraphics.clear()
    this.tripText.setVisible(false)
    this.timerText.setVisible(false)

    const isNewBest = this.roundCoins > this.bestCatch
    if (isNewBest) {
      this.bestCatch = this.roundCoins
      localStorage.setItem(FISHING_BEST_KEY, String(this.bestCatch))
    }

    this.roundOverTitleText.setText(t('fishingRoundOverTitle', { coins: this.roundCoins })).setVisible(true)
    this.roundOverBestText.setText(t('fishingRoundOverBest', { best: this.bestCatch })).setVisible(true)
    this.roundOverNewBestText.setVisible(isNewBest)
    this.restartYesText.setVisible(true)
    this.restartNoText.setVisible(true)
  }

  showFloatPopup(x, y, text, color = '#ffe066') {
    const popup = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
    this.tweens.add({
      targets: popup,
      y: y - 26,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => popup.destroy(),
    })
  }

  ensureAudio() {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext
      this.audioCtx = new AC()
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume()
    return this.audioCtx
  }

  playCatchSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(700, now)
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.14)
  }

  playBankSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      const start = now + i * 0.07
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.16)
    })
  }

  playSnapSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.22)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.27)
  }

  update(time, delta) {
    if (this.state !== 'playing') return
    const dt = delta / 1000
    const maxDepth = this.maxDepthForTier()

    if (this.holding) {
      this.hookY = Math.min(this.hookY + DESCEND_SPEED * dt, maxDepth)
    } else {
      this.hookY = Math.max(this.hookY - ASCEND_SPEED * dt, DOCK_Y)
    }

    this.lineGraphics.clear()
    this.lineGraphics.lineStyle(2, 0xe8f4ff, 0.85)
    this.lineGraphics.lineBetween(GAME_WIDTH / 2, DOCK_Y, GAME_WIDTH / 2, this.hookY)
    this.hookGraphics.clear()
    this.hookGraphics.lineStyle(3, 0xdddddd, 1)
    this.hookGraphics.strokeCircle(GAME_WIDTH / 2, this.hookY, 6)

    if (this.tripValue > 0) {
      this.tripText.setText(`+${this.tripValue}`).setPosition(GAME_WIDTH / 2 + 22, this.hookY).setVisible(true)
    } else {
      this.tripText.setVisible(false)
    }

    this.fishGroup.children.each((fish) => {
      fish.visual.setPosition(fish.x, fish.y)
      if (fish.x < -60 || fish.x > GAME_WIDTH + 60) this.destroyFish(fish)
    })
    this.hazardGroup.children.each((hazard) => {
      hazard.visual.setPosition(hazard.x, hazard.y)
      if (hazard.x < -60 || hazard.x > GAME_WIDTH + 60) this.destroyHazard(hazard)
    })

    this.fishGroup.children.each((fish) => {
      if (fish.caught) return
      const dist = Phaser.Math.Distance.Between(GAME_WIDTH / 2, this.hookY, fish.x, fish.y)
      if (dist < HOOK_CATCH_RADIUS) this.catchFish(fish)
    })
    this.hazardGroup.children.each((hazard) => {
      const dist = Phaser.Math.Distance.Between(GAME_WIDTH / 2, this.hookY, hazard.x, hazard.y)
      if (dist < HOOK_CATCH_RADIUS) this.hitHazard(hazard)
    })

    if (!this.holding && this.hookY <= DOCK_Y + 0.5 && this.tripValue > 0) {
      this.bankTrip()
    }

    this.roundTimeLeft -= delta
    if (this.roundTimeLeft <= 0) {
      this.roundTimeLeft = 0
      this.endRound()
      return
    }
    this.timerText.setText(t('fishingTimeLeft', { time: Math.ceil(this.roundTimeLeft / 1000) }))
  }
}
