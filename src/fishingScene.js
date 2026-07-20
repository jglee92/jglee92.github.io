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

    this.bubbles = []
    this.wavePhase = 0
    this.bubbleSpawnTimer = this.time.addEvent({
      delay: 450,
      loop: true,
      paused: true,
      callback: () => this.spawnBubble(),
    })

    if (data && data.autoStart) this.startGame()
  }

  drawBackground() {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1e5a8a, 0x1e5a8a, 0x02121f, 0x02121f, 1)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    // 배를 나중에 추가하면 이 파도 위에서 출렁이게 하고, 그 흔들림을 낚싯줄에도 전달해서
    // 난이도 요소로 쓸 수 있게 될 것. 지금은 정적인 부두 막대 대신 움직이는 수면을 보여준다.
    this.waveGraphics = this.add.graphics()
    this.drawWave()
  }

  drawWave() {
    const g = this.waveGraphics
    const bandTop = DOCK_Y - 6
    const bandBottom = DOCK_Y + 16
    const amp = 4
    const freq = 0.05
    const points = []
    for (let x = 0; x <= GAME_WIDTH; x += 10) {
      points.push({ x, y: bandTop + Math.sin(x * freq + this.wavePhase) * amp })
    }
    g.clear()
    g.fillStyle(0x2a72a0, 0.95)
    g.fillPoints([...points, { x: GAME_WIDTH, y: bandBottom }, { x: 0, y: bandBottom }], true)
    g.lineStyle(2, 0xbfe6ff, 0.55)
    g.beginPath()
    points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
    g.strokePath()
  }

  spawnBubble() {
    if (this.state !== 'playing') return
    const x = Phaser.Math.Between(20, GAME_WIDTH - 20)
    const startY = Phaser.Math.Between(DOCK_Y + 40, this.maxDepthForTier())
    const radius = Phaser.Math.Between(2, 5)
    const bubble = this.add.circle(x, startY, radius, 0xbfe6ff, 0.35).setStrokeStyle(1, 0xffffff, 0.4)
    bubble.riseSpeed = Phaser.Math.Between(30, 60)
    bubble.driftX = Phaser.Math.FloatBetween(-8, 8)
    this.bubbles.push(bubble)
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
    this.bubbleSpawnTimer.paused = false
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
  // 만든다. 등지느러미/꼬리(미)지느러미/가슴지느러미/배지느러미/뒷지느러미까지 갖춘 실제 물고기
  // 해부 구조를 참고해서 그렸다 — 예전엔 몸통+꼬리+등지느러미뿐이라 밋밋했다. 머리가 +x쪽(오른쪽).
  ensureFishTexture(type) {
    const key = `fish-${type.id}`
    if (this.textures.exists(key)) return key
    const r = type.radius
    const w = r * 2.6
    const h = r * 1.6
    const canvasW = w + r * 2.4
    const canvasH = r * 5.2
    const cx = canvasW / 2
    const cy = canvasH / 2
    const g = this.add.graphics()

    g.fillStyle(type.fin, 1)
    // 꼬리(미)지느러미 — 위/아래 두 갈래로 갈라진 부채꼴
    g.fillTriangle(cx - w / 2 + 2, cy - 2, cx - w / 2 - r * 0.9, cy - r * 0.75, cx - w / 2 - r * 0.15, cy)
    g.fillTriangle(cx - w / 2 + 2, cy + 2, cx - w / 2 - r * 0.9, cy + r * 0.75, cx - w / 2 - r * 0.15, cy)
    // 등지느러미
    g.fillTriangle(cx - r * 0.15, cy - h / 2, cx + r * 0.25, cy - h / 2 - r * 0.45, cx + r * 0.5, cy - h / 2)
    // 가슴지느러미 (머리 바로 뒤, 옆으로) — 배쪽 지느러미 3개가 서로 겹치지 않도록 x축 간격을 넉넉히 뒀다.
    g.fillTriangle(cx + w * 0.35, cy + h * 0.05, cx + w * 0.15, cy + h * 0.2, cx + w * 0.12, cy + h * 0.6)
    // 배지느러미 (몸통 중앙 아래)
    g.fillTriangle(cx + w * 0.05, cy + h * 0.3, cx - w * 0.1, cy + h * 0.35, cx - w * 0.02, cy + h * 0.68)
    // 뒷지느러미 (배 쪽, 꼬리 앞)
    g.fillTriangle(cx - w * 0.22, cy + h * 0.35, cx - w * 0.38, cy + h * 0.4, cx - w * 0.28, cy + h * 0.7)

    g.fillStyle(type.body, 1)
    g.fillEllipse(cx, cy, w, h)
    // 배 쪽을 더 밝게(카운터셰이딩) 해서 입체감을 준다.
    g.fillStyle(0xffffff, 0.18)
    g.fillEllipse(cx, cy + h * 0.22, w * 0.82, h * 0.5)
    g.lineStyle(1.5, 0x0a0a0a, 0.35)
    g.strokeEllipse(cx, cy, w, h)

    // 아가미 선 — 눈보다 몸통 쪽으로 확실히 떨어뜨려서 눈과 겹쳐 보이지 않게 한다.
    g.lineStyle(1.5, 0x0a0a0a, 0.4)
    g.lineBetween(cx + w * 0.12, cy - h * 0.3, cx + w * 0.08, cy + h * 0.3)

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
    const canvasW = w + 50
    const canvasH = h + 60
    const cx = canvasW / 2
    const cy = canvasH / 2
    const g = this.add.graphics()

    g.fillStyle(0x4a5a63, 1)
    // 꼬리지느러미 (위쪽 엽이 더 큰 비대칭 형태 — 상어 특유의 실루엣)
    g.fillTriangle(cx - w / 2 + 4, cy, cx - w / 2 - 20, cy - h * 0.9, cx - w / 2 - 2, cy - h * 0.1)
    g.fillTriangle(cx - w / 2 + 4, cy, cx - w / 2 - 12, cy + h * 0.6, cx - w / 2 - 2, cy + h * 0.1)
    // 등지느러미 — 몸통 중앙쪽으로 옮겨서 머리 쪽 아가미/가슴지느러미와 안 겹치게 한다.
    g.fillTriangle(cx - w * 0.05, cy - h / 2, cx + w * 0.16, cy - h / 2 - 20, cx + w * 0.28, cy - h / 2)
    // 가슴지느러미 — 아가미/눈보다 확실히 몸통 쪽(왼쪽)에 두어 서로 안 겹치게 한다.
    g.fillTriangle(cx - w * 0.02, cy + h * 0.3, cx - w * 0.15, cy + h * 0.35, cx - w * 0.05, cy + h * 0.75)

    g.fillStyle(0x5a6b74, 1)
    g.fillEllipse(cx, cy, w, h)
    g.fillStyle(0xe8e8e8, 0.9)
    g.fillEllipse(cx, cy + h * 0.28, w * 0.8, h * 0.4)
    g.lineStyle(1.5, 0x0a0a0a, 0.35)
    g.strokeEllipse(cx, cy, w, h)

    // 아가미 틈 (세 줄) — 가슴지느러미와 눈 사이 빈 공간에 둔다.
    g.lineStyle(1.5, 0x0a0a0a, 0.4)
    for (let i = 0; i < 3; i++) {
      const gx = cx + w * 0.12 + i * 4
      g.lineBetween(gx, cy - h * 0.25, gx - 2, cy + h * 0.25)
    }

    // 입을 벌린 모습 — 위턱/아래턱 사이에 붉은 입안과 이빨을 넣어서 위협적으로 보이게 한다.
    const jawBaseX = cx + w / 2 - 4
    const jawTipX = cx + w / 2 + 16
    g.fillStyle(0x7a1f1f, 1)
    g.fillTriangle(jawBaseX, cy - 1, jawBaseX, cy + 1, jawTipX - 4, cy)
    g.fillStyle(0x4a5a63, 1)
    g.fillTriangle(jawBaseX, cy - 9, jawTipX, cy - 1, jawBaseX, cy - 1)
    g.fillStyle(0xe8e8e8, 1)
    g.fillTriangle(jawBaseX, cy + 1, jawTipX, cy + 2, jawBaseX, cy + 9)
    g.fillStyle(0xffffff, 1)
    for (let i = 0; i < 3; i++) {
      const tx = jawBaseX + 3 + i * 5
      g.fillTriangle(tx, cy - 1.5, tx + 3, cy - 1.5, tx + 1.5, cy + 1.5)
    }
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
    this.bubbleSpawnTimer.paused = true
    this.fishGroup.children.each((f) => this.destroyFish(f))
    this.hazardGroup.children.each((h) => this.destroyHazard(h))
    this.bubbles.forEach((b) => b.destroy())
    this.bubbles = []
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
    const dt = delta / 1000

    // 파도는 대기 화면에서도 계속 움직이게 해서 항상 생동감 있어 보이게 한다(플레이 중에만
    // 도는 아래 로직과 분리해서 이 앞에 둔다).
    this.wavePhase += dt * 1.6
    this.drawWave()

    if (this.state !== 'playing') return
    const maxDepth = this.maxDepthForTier()

    if (this.holding) {
      this.hookY = Math.min(this.hookY + DESCEND_SPEED * dt, maxDepth)
    } else {
      this.hookY = Math.max(this.hookY - ASCEND_SPEED * dt, DOCK_Y)
    }

    this.lineGraphics.clear()
    this.lineGraphics.lineStyle(2, 0xe8f4ff, 0.85)
    this.lineGraphics.lineBetween(GAME_WIDTH / 2, DOCK_Y, GAME_WIDTH / 2, this.hookY)

    // 낚싯바늘 — 단순 원 대신 낚싯바늘 특유의 J자 곡선 + 미늘로 그린다.
    const hx = GAME_WIDTH / 2
    const hy = this.hookY
    this.hookGraphics.clear()
    this.hookGraphics.lineStyle(2.5, 0xdddddd, 1)
    this.hookGraphics.beginPath()
    this.hookGraphics.moveTo(hx, hy - 12)
    this.hookGraphics.lineTo(hx, hy - 3)
    this.hookGraphics.lineTo(hx + 3, hy + 3)
    this.hookGraphics.lineTo(hx + 7, hy + 6)
    this.hookGraphics.lineTo(hx + 9, hy + 3)
    this.hookGraphics.lineTo(hx + 8, hy - 1)
    this.hookGraphics.strokePath()
    this.hookGraphics.lineBetween(hx + 8, hy - 1, hx + 10.5, hy - 2)

    this.bubbles = this.bubbles.filter((bubble) => {
      bubble.y -= bubble.riseSpeed * dt
      bubble.x += bubble.driftX * dt * 0.3
      if (bubble.y <= DOCK_Y) {
        bubble.destroy()
        return false
      }
      return true
    })

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
