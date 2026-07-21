import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, TEXT_RESOLUTION } from './constants.js'
import { t } from './i18n.js'

// 로켓/피싱/블록 게임의 localStorage 키와 겹치지 않는 이 게임만의 별도 키.
const CANDY_COINS_KEY = 'candy-coins'
const CANDY_BEST_KEY = 'candy-best-score'
const CANDY_LEVEL_KEY = 'candy-level-unlocked'
const CANDY_OWNED_THEMES_KEY = 'candy-owned-themes'
const CANDY_EQUIPPED_THEME_KEY = 'candy-equipped-theme'

const GRID_SIZE = 8
const CELL = 42
const BOARD_ORIGIN_X = (GAME_WIDTH - GRID_SIZE * CELL) / 2
const BOARD_ORIGIN_Y = 120
const FALL_SPEED = 700 // px/sec — 낙하 거리에 비례해서 트윈 시간을 정한다
const CLEAR_DURATION = 160

// 이 게임 세계관 아이콘으로 타일을 채운다(캔디크러쉬 그림 대신 우리 그림). 배 게임이
// 생기면 이 배열에 'boat' 하나만 추가하면 된다.
const TILE_TYPES = ['rocket', 'fish', 'coin', 'shield', 'star']
const TILE_NAME_KEYS = {
  rocket: 'candyTileNameRocket',
  fish: 'candyTileNameFish',
  coin: 'candyTileNameCoin',
  shield: 'candyTileNameShield',
  star: 'candyTileNameStar',
}

// 상점에서 파는 타일 색상 테마 — 기본은 무료, 나머지는 코인으로 구매/장착.
// 눈(fish)/반짝임(coin) 같은 흰색/검정 디테일은 테마와 무관하게 고정이라 색상표에 없다.
const CANDY_THEMES = [
  {
    id: 'default',
    cost: 0,
    nameKey: 'candyThemeDefaultName',
    colors: {
      rocket: { flame: 0xff8a4f, body: 0xd8d8e2, nose: 0xd23c3c, fin: 0xb52e2e, window: 0x4fc3f7 },
      fish: { fin: 0xd4a017, body: 0xffe066 },
      coin: { outer: 0xd4a017, inner: 0xffe066 },
      shield: { body: 0x1b6ca8, accent: 0x8fe3ff },
      star: { body: 0xffd700 },
    },
  },
  {
    id: 'neon',
    cost: 80,
    nameKey: 'candyThemeNeonName',
    colors: {
      rocket: { flame: 0x39ff14, body: 0xe0e0ff, nose: 0xff073a, fin: 0xc70030, window: 0x00f9ff },
      fish: { fin: 0xff00ff, body: 0x00f9ff },
      coin: { outer: 0xffff00, inner: 0x39ff14 },
      shield: { body: 0xff073a, accent: 0xffff00 },
      star: { body: 0x00f9ff },
    },
  },
  {
    id: 'pastel',
    cost: 150,
    nameKey: 'candyThemePastelName',
    colors: {
      rocket: { flame: 0xffdac1, body: 0xf6f6f6, nose: 0xffb7b2, fin: 0xe2a8a4, window: 0xc7ceea },
      fish: { fin: 0xe2f0cb, body: 0xffdac1 },
      coin: { outer: 0xe2f0cb, inner: 0xfff5ba },
      shield: { body: 0xc7ceea, accent: 0xb5ead7 },
      star: { body: 0xf6dfeb },
    },
  },
]

// 레벨(단계) 구조 — 항목만 추가하면 레벨이 늘어난다.
const LEVELS = [
  { moves: 15, objective: { type: 'score', target: 800 } },
  { moves: 18, objective: { type: 'collect', tile: 'rocket', count: 12 } },
  { moves: 16, objective: { type: 'score', target: 1500 } },
  { moves: 20, objective: { type: 'collect', tile: 'star', count: 15 } },
  { moves: 18, objective: { type: 'score', target: 2500 } },
]

export class CandyScene extends Phaser.Scene {
  constructor() {
    super('CandyScene')
  }

  create() {
    this.state = 'ready'
    this.totalCoins = Number(localStorage.getItem(CANDY_COINS_KEY) || 0)
    this.bestScore = Number(localStorage.getItem(CANDY_BEST_KEY) || 0)
    this.levelUnlocked = Number(localStorage.getItem(CANDY_LEVEL_KEY) || 1)
    this.currentLevel = Math.min(this.levelUnlocked, LEVELS.length)
    this.score = 0
    this.movesLeft = 0
    this.collected = {}
    this.grid = []
    this.special = []
    this.tileSprites = []
    this.selected = null
    this.selectHighlight = null
    this.locked = false
    this.shopTexts = null

    this.cameras.main.setBackgroundColor('#1a1030')
    this.createUI()
    this.refreshReadyTexts()

    this.input.on('pointerdown', (pointer, currentlyOver) => {
      if (currentlyOver.some((obj) => obj.isUiButton)) return
      if (this.state === 'ready') this.startGame()
    })
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.state === 'ready') this.startGame()
    })
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
      .text(GAME_WIDTH / 2, 50, t('candyReadyTitle'), { ...textStyle, fontSize: '24px' })
      .setOrigin(0.5)
    this.readyLevelText = this.add
      .text(GAME_WIDTH / 2, 85, '', { ...textStyle, fontSize: '20px', color: '#ffe066' })
      .setOrigin(0.5)
    this.readyObjectiveText = this.add
      .text(GAME_WIDTH / 2, 122, '', { ...textStyle, fontSize: '14px', align: 'center', lineSpacing: 6 })
      .setOrigin(0.5)
    this.readyStatsText = this.add
      .text(GAME_WIDTH / 2, 158, '', { ...textStyle, fontSize: '13px', color: '#c8c8da' })
      .setOrigin(0.5)
    this.readyCtaText = this.add
      .text(GAME_WIDTH / 2, 195, t('candyReadyCta'), { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)

    this.hubButtonBg = this.add
      .rectangle(40, 20, 72, 28, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0xff8a4f)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.state === 'playing' || this.state === 'shop') return
        this.scene.start('HubScene')
      })
    this.hubButtonBg.isUiButton = true
    this.hubButtonText = this.add.text(40, 20, t('hubButtonLabel'), { ...textStyle, fontSize: '12px' }).setOrigin(0.5)

    // 상점 버튼 — 허브 버튼(좌상단)과 대칭으로 우상단에 둔다.
    this.shopButtonBg = this.add
      .rectangle(GAME_WIDTH - 40, 20, 72, 28, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0x4fc3f7)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openShop())
    this.shopButtonBg.isUiButton = true
    this.shopButtonText = this.add.text(GAME_WIDTH - 40, 20, t('candyShopButtonLabel'), { ...textStyle, fontSize: '12px' }).setOrigin(0.5)

    this.movesText = this.add
      .text(GAME_WIDTH / 2 - 90, 65, '', { ...textStyle, fontSize: '14px' })
      .setOrigin(0.5)
      .setVisible(false)
    this.scoreText = this.add
      .text(GAME_WIDTH / 2 + 90, 65, '', { ...textStyle, fontSize: '14px' })
      .setOrigin(0.5)
      .setVisible(false)
    this.objectiveProgressText = this.add
      .text(GAME_WIDTH / 2, 95, '', { ...textStyle, fontSize: '14px', color: '#8fe3ff' })
      .setOrigin(0.5)
      .setVisible(false)

    this.endTitleText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, '', { ...textStyle, fontSize: '19px', align: 'center', wordWrap: { width: GAME_WIDTH - 60 } })
      .setOrigin(0.5)
      .setVisible(false)
    this.endDetailText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 42, '', { ...textStyle, fontSize: '15px' })
      .setOrigin(0.5)
      .setVisible(false)
    this.endCoinsText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 14, '', { ...textStyle, fontSize: '15px', color: '#8fe3ff' })
      .setOrigin(0.5)
      .setVisible(false)
    this.nextLevelText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, t('candyNextLevel'), { ...textStyle, fontSize: '18px', color: '#69f0ae' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.state !== 'levelClear') return
        this.currentLevel += 1
        this.goToReady()
      })
    this.nextLevelText.isUiButton = true
    this.retryText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, t('candyRetry'), { ...textStyle, fontSize: '18px', color: '#ff8a4f' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.state !== 'levelFail') return
        this.goToReady()
      })
    this.retryText.isUiButton = true
  }

  refreshReadyTexts() {
    const level = LEVELS[this.currentLevel - 1]
    this.readyLevelText.setText(t('candyReadyLevelLabel', { level: this.currentLevel }))
    const objText =
      level.objective.type === 'score'
        ? t('candyObjectiveScoreDesc', { target: level.objective.target })
        : t('candyObjectiveCollectDesc', {
            count: level.objective.count,
            tileName: t(TILE_NAME_KEYS[level.objective.tile]),
          })
    this.readyObjectiveText.setText(`${objText}\n${t('candyMovesLeft', { moves: level.moves })}`)
    this.readyStatsText.setText(t('candyReadyStats', { coins: this.totalCoins, best: this.bestScore }))
  }

  goToReady() {
    this.state = 'ready'
    this.endTitleText.setVisible(false)
    this.endDetailText.setVisible(false)
    this.endCoinsText.setVisible(false)
    this.nextLevelText.setVisible(false)
    this.retryText.setVisible(false)
    this.refreshReadyTexts()
    this.readyTitleText.setVisible(true)
    this.readyLevelText.setVisible(true)
    this.readyObjectiveText.setVisible(true)
    this.readyStatsText.setVisible(true)
    this.readyCtaText.setVisible(true)
    this.hubButtonBg.setVisible(true)
    this.hubButtonText.setVisible(true)
    this.shopButtonBg.setVisible(true)
    this.shopButtonText.setVisible(true)
  }

  // ---------- 상점 (로켓 게임의 openShop/closeShop/renderShop 패턴 재사용) ----------

  openShop() {
    if (this.state !== 'ready') return
    this.state = 'shop'
    this.readyTitleText.setVisible(false)
    this.readyLevelText.setVisible(false)
    this.readyObjectiveText.setVisible(false)
    this.readyStatsText.setVisible(false)
    this.readyCtaText.setVisible(false)
    this.hubButtonBg.setVisible(false)
    this.hubButtonText.setVisible(false)
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)
    this.renderShop()
  }

  closeShop() {
    if (this.shopTexts) {
      this.shopTexts.forEach((obj) => obj.destroy())
      this.shopTexts = null
    }
    this.state = 'ready'
    this.refreshReadyTexts()
    this.readyTitleText.setVisible(true)
    this.readyLevelText.setVisible(true)
    this.readyObjectiveText.setVisible(true)
    this.readyStatsText.setVisible(true)
    this.readyCtaText.setVisible(true)
    this.hubButtonBg.setVisible(true)
    this.hubButtonText.setVisible(true)
    this.shopButtonBg.setVisible(true)
    this.shopButtonText.setVisible(true)
  }

  renderShop() {
    if (this.shopTexts) this.shopTexts.forEach((obj) => obj.destroy())
    this.shopTexts = []

    const style = {
      fontFamily: 'system-ui, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: TEXT_RESOLUTION,
    }

    let cursorY = 20
    const title = this.add
      .text(GAME_WIDTH / 2, cursorY, t('candyShopTitle', { coins: this.totalCoins }), { ...style, fontSize: '17px', align: 'center' })
      .setOrigin(0.5, 0)
    this.shopTexts.push(title)

    const backButton = this.add
      .text(14, cursorY, t('backButton'), { ...style, fontSize: '14px' })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeShop())
    backButton.isUiButton = true
    this.shopTexts.push(backButton)
    cursorY += title.height + 24

    let rowY = cursorY
    CANDY_THEMES.forEach((theme, i) => {
      const owned = this.isThemeOwned(theme.id)
      const equipped = this.getEquippedThemeId() === theme.id
      const statusLine = equipped ? t('shopEquipped') : owned ? t('shopOwned') : t('shopCost', { cost: theme.cost })

      const label = `[${i + 1}] ${t(theme.nameKey)}\n${statusLine}`
      const row = this.add
        .text(88, rowY, label, { ...style, fontSize: '13px' })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectTheme(i))
      this.shopTexts.push(row)

      const rowCenterY = rowY + row.height / 2
      const previewKey = this.ensureTileTextureForTheme('rocket', theme.id)
      const icon = this.add
        .image(55, rowCenterY, previewKey)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectTheme(i))
      this.shopTexts.push(icon)

      rowY += Math.max(row.height, icon.height) + 14
    })
  }

  selectTheme(index) {
    if (this.state !== 'shop') return
    const theme = CANDY_THEMES[index]
    if (this.getEquippedThemeId() === theme.id) return

    if (!this.isThemeOwned(theme.id)) {
      if (this.totalCoins < theme.cost) {
        this.showFloatPopup(GAME_WIDTH / 2, 60, t('shopNotEnoughCoins'), '#ff6b4a')
        return
      }
      this.totalCoins -= theme.cost
      localStorage.setItem(CANDY_COINS_KEY, String(this.totalCoins))
      this.setThemeOwned(theme.id)
    }

    localStorage.setItem(CANDY_EQUIPPED_THEME_KEY, theme.id)
    this.renderShop()
  }

  startGame() {
    if (this.state !== 'ready') return
    this.state = 'playing'
    const level = LEVELS[this.currentLevel - 1]
    this.score = 0
    this.movesLeft = level.moves
    this.collected = {}
    this.selected = null
    this.locked = false

    this.readyTitleText.setVisible(false)
    this.readyLevelText.setVisible(false)
    this.readyObjectiveText.setVisible(false)
    this.readyStatsText.setVisible(false)
    this.readyCtaText.setVisible(false)
    this.hubButtonBg.setVisible(false)
    this.hubButtonText.setVisible(false)
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)

    this.movesText.setVisible(true)
    this.scoreText.setVisible(true)
    this.objectiveProgressText.setVisible(true)

    this.generateBoard()
    this.renderBoardFresh()
    this.updateHud()
  }

  // 생성 시점에 이미 3매치가 있는 배치가 나오지 않게 왼쪽/위쪽 두 칸을 검사하며 뽑는다.
  generateBoard() {
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
    this.special = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null))
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        let type
        do {
          type = Phaser.Math.Between(0, TILE_TYPES.length - 1)
        } while (
          (c >= 2 && this.grid[r][c - 1] === type && this.grid[r][c - 2] === type) ||
          (r >= 2 && this.grid[r - 1][c] === type && this.grid[r - 2][c] === type)
        )
        this.grid[r][c] = type
      }
    }
  }

  renderBoardFresh() {
    this.destroyBoard()
    this.tileSprites = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null))
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        this.tileSprites[r][c] = this.createTileSprite(r, c, this.grid[r][c])
      }
    }
  }

  destroyBoard() {
    this.clearHighlight()
    this.tileSprites.forEach((row) =>
      row.forEach((sprite) => {
        if (!sprite) return
        this.tweens.killTweensOf(sprite)
        sprite.destroy()
      }),
    )
    this.tileSprites = []
  }

  createTileSprite(r, c, type, specialType = null) {
    const x = BOARD_ORIGIN_X + c * CELL + CELL / 2
    const y = BOARD_ORIGIN_Y + r * CELL + CELL / 2
    const key = specialType ? this.ensureSpecialTexture(TILE_TYPES[type], specialType) : this.ensureTileTexture(TILE_TYPES[type])
    const img = this.add.image(x, y, key).setInteractive({ useHandCursor: true })
    img.row = r
    img.col = c
    img.tileType = type
    img.specialType = specialType
    img.on('pointerdown', () => this.handleTileTap(img.row, img.col))
    return img
  }

  handleTileTap(r, c) {
    if (this.state !== 'playing' || this.locked) return
    if (!this.selected) {
      this.selected = { r, c }
      this.highlightSelected()
      return
    }
    if (this.selected.r === r && this.selected.c === c) {
      this.selected = null
      this.clearHighlight()
      return
    }
    const isAdjacent = Math.abs(this.selected.r - r) + Math.abs(this.selected.c - c) === 1
    if (!isAdjacent) {
      this.selected = { r, c }
      this.highlightSelected()
      return
    }
    const a = this.selected
    this.selected = null
    this.clearHighlight()
    this.attemptSwap(a, { r, c })
  }

  highlightSelected() {
    this.clearHighlight()
    const x = BOARD_ORIGIN_X + this.selected.c * CELL + CELL / 2
    const y = BOARD_ORIGIN_Y + this.selected.r * CELL + CELL / 2
    this.selectHighlight = this.add.rectangle(x, y, CELL - 4, CELL - 4).setStrokeStyle(3, 0xffe066, 1)
  }

  clearHighlight() {
    if (this.selectHighlight) {
      this.selectHighlight.destroy()
      this.selectHighlight = null
    }
  }

  tweenTo(sprite, x, y) {
    const distance = Math.max(Math.abs(y - sprite.y), Math.abs(x - sprite.x))
    const duration = Math.max(120, (distance / FALL_SPEED) * 1000)
    return new Promise((resolve) => {
      this.tweens.add({ targets: sprite, x, y, duration, ease: 'Bounce.easeOut', onComplete: resolve })
    })
  }

  async attemptSwap(a, b) {
    if (this.locked) return
    this.locked = true
    const spriteA = this.tileSprites[a.r][a.c]
    const spriteB = this.tileSprites[b.r][b.c]
    const posA = { x: spriteA.x, y: spriteA.y }
    const posB = { x: spriteB.x, y: spriteB.y }

    const tmp = this.grid[a.r][a.c]
    this.grid[a.r][a.c] = this.grid[b.r][b.c]
    this.grid[b.r][b.c] = tmp

    this.playSwapSound()
    await Promise.all([this.tweenTo(spriteA, posB.x, posB.y), this.tweenTo(spriteB, posA.x, posA.y)])
    this.tileSprites[a.r][a.c] = spriteB
    this.tileSprites[b.r][b.c] = spriteA
    spriteA.row = b.r
    spriteA.col = b.c
    spriteB.row = a.r
    spriteB.col = a.c

    const runs = this.findRuns()
    if (runs.length === 0) {
      // 매치가 안 만들어지면 되돌린다 — 스프라이트가 제자리로 미끄러져 돌아가는 것 자체가
      // "이 조합은 안 된다"는 자연스러운 피드백이라 별도 흔들림 효과가 필요 없다.
      this.grid[b.r][b.c] = this.grid[a.r][a.c]
      this.grid[a.r][a.c] = tmp
      await Promise.all([this.tweenTo(spriteA, posA.x, posA.y), this.tweenTo(spriteB, posB.x, posB.y)])
      this.tileSprites[a.r][a.c] = spriteA
      this.tileSprites[b.r][b.c] = spriteB
      spriteA.row = a.r
      spriteA.col = a.c
      spriteB.row = b.r
      spriteB.col = b.c
      this.locked = false
      return
    }

    this.movesLeft -= 1
    await this.resolveMatches([
      [a.r, a.c],
      [b.r, b.c],
    ])
  }

  // 가로/세로로 3개 이상 이어진 덩어리(run)를 전부 찾는다. 길이 4 이상인 run은 나중에
  // classifyRuns()에서 특수 타일로 승격될 후보가 된다.
  findRuns() {
    const runs = []
    for (let r = 0; r < GRID_SIZE; r++) {
      let runStart = 0
      for (let c = 1; c <= GRID_SIZE; c++) {
        if (c < GRID_SIZE && this.grid[r][c] === this.grid[r][runStart] && this.grid[r][runStart] !== -1) continue
        if (c - runStart >= 3) {
          const cells = []
          for (let k = runStart; k < c; k++) cells.push([r, k])
          runs.push({ cells, orientation: 'h', type: this.grid[r][runStart] })
        }
        runStart = c
      }
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let runStart = 0
      for (let r = 1; r <= GRID_SIZE; r++) {
        if (r < GRID_SIZE && this.grid[r][c] === this.grid[runStart][c] && this.grid[runStart][c] !== -1) continue
        if (r - runStart >= 3) {
          const cells = []
          for (let k = runStart; k < r; k++) cells.push([k, c])
          runs.push({ cells, orientation: 'v', type: this.grid[runStart][c] })
        }
        runStart = r
      }
    }
    return runs
  }

  // 승격 규칙(캔디크러쉬 관례):
  // - 가로 런과 세로 런이 같은 타입으로 한 칸에서 교차(L/T자 모양) → 5x5 폭탄(bomb5).
  //   이게 개별 런 길이 판정보다 우선한다.
  // - L/T에 안 걸린 일직선 5매치 이상 → 컬러 폭탄(colorBomb, 발동 시 그 타입 전체 제거).
  // - L/T에 안 걸린 일직선 4매치 → 줄(가로/세로) 특수 타일.
  // 승격된 칸은 이번엔 지워지지 않고 특수 타일로 남는다.
  classifyRuns(runs, swappedCells) {
    const toClear = new Set()
    const promotions = []
    const promotedKeys = new Set()
    const consumed = new Set()

    const addPromotion = (cell, type, specialType) => {
      const key = `${cell[0]},${cell[1]}`
      if (promotedKeys.has(key)) return
      promotedKeys.add(key)
      promotions.push({ r: cell[0], c: cell[1], type, specialType })
    }

    const pickCell = (cells) => {
      const swapped = swappedCells && cells.find(([r, c]) => swappedCells.some(([sr, sc]) => sr === r && sc === c))
      return swapped || cells[Math.floor(cells.length / 2)]
    }

    // L/T자 모양: 방향이 다르고 타입이 같은 두 런이 한 칸이라도 겹치면 하나의 클러스터로 합친다.
    for (let i = 0; i < runs.length; i++) {
      if (consumed.has(i)) continue
      for (let j = i + 1; j < runs.length; j++) {
        if (consumed.has(j)) continue
        const runA = runs[i]
        const runB = runs[j]
        if (runA.orientation === runB.orientation || runA.type !== runB.type) continue
        const intersection = runA.cells.find(([r, c]) => runB.cells.some(([r2, c2]) => r2 === r && c2 === c))
        if (!intersection) continue

        consumed.add(i)
        consumed.add(j)
        const unionCells = new Map()
        ;[...runA.cells, ...runB.cells].forEach(([r, c]) => unionCells.set(`${r},${c}`, [r, c]))
        const cellsArr = Array.from(unionCells.values())
        cellsArr.forEach(([r, c]) => toClear.add(`${r},${c}`))
        const promoteCell =
          (swappedCells && cellsArr.find(([r, c]) => swappedCells.some(([sr, sc]) => sr === r && sc === c))) || intersection
        addPromotion(promoteCell, runA.type, 'bomb5')
        break
      }
    }

    // L/T에 안 걸린 나머지 런들 — 일직선 4/5매치 판정.
    runs.forEach((run, idx) => {
      if (consumed.has(idx)) return
      run.cells.forEach(([r, c]) => toClear.add(`${r},${c}`))
      if (run.cells.length >= 4) {
        const promoteCell = pickCell(run.cells)
        const specialType = run.cells.length >= 5 ? 'colorBomb' : run.orientation === 'h' ? 'lineH' : 'lineV'
        addPromotion(promoteCell, run.type, specialType)
      }
    })

    promotions.forEach((p) => toClear.delete(`${p.r},${p.c}`))
    return { toClear, promotions }
  }

  getSpecialBonusCells(r, c, special) {
    const cells = []
    if (special === 'lineH') {
      for (let cc = 0; cc < GRID_SIZE; cc++) cells.push([r, cc])
    } else if (special === 'lineV') {
      for (let rr = 0; rr < GRID_SIZE; rr++) cells.push([rr, c])
    } else if (special === 'bomb5') {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr
          const cc = c + dc
          if (rr >= 0 && rr < GRID_SIZE && cc >= 0 && cc < GRID_SIZE) cells.push([rr, cc])
        }
      }
    } else if (special === 'colorBomb') {
      const targetType = this.grid[r][c]
      for (let rr = 0; rr < GRID_SIZE; rr++) {
        for (let cc = 0; cc < GRID_SIZE; cc++) {
          if (this.grid[rr][cc] === targetType) cells.push([rr, cc])
        }
      }
    }
    return cells
  }

  // 지워질 칸(toClear) 중에 특수 타일이 있으면 그 효과 범위도 더한다 — 그 범위 안에 또
  // 다른 특수 타일이 있으면 그것도 연쇄로 터지도록, 더 늘어나는 게 없을 때까지 반복한다.
  expandForSpecialEffects(toClear) {
    let changed = true
    while (changed) {
      changed = false
      Array.from(toClear).forEach((key) => {
        const [r, c] = key.split(',').map(Number)
        const special = this.special[r][c]
        if (!special) return
        this.getSpecialBonusCells(r, c, special).forEach(([br, bc]) => {
          const bkey = `${br},${bc}`
          if (!toClear.has(bkey)) {
            toClear.add(bkey)
            changed = true
          }
        })
      })
    }
  }

  trackCollected(toClear) {
    toClear.forEach((key) => {
      const [r, c] = key.split(',').map(Number)
      const type = TILE_TYPES[this.grid[r][c]]
      this.collected[type] = (this.collected[type] || 0) + 1
    })
  }

  async playClearAnimation(toClear) {
    const promises = []
    toClear.forEach((key) => {
      const [r, c] = key.split(',').map(Number)
      const sprite = this.tileSprites[r][c]
      if (!sprite) return
      promises.push(
        new Promise((resolve) => {
          this.tweens.add({ targets: sprite, scaleX: 0, scaleY: 0, alpha: 0, duration: CLEAR_DURATION, onComplete: resolve })
        }),
      )
    })
    await Promise.all(promises)
    toClear.forEach((key) => {
      const [r, c] = key.split(',').map(Number)
      const sprite = this.tileSprites[r][c]
      if (sprite) {
        sprite.destroy()
        this.tileSprites[r][c] = null
      }
      this.grid[r][c] = -1
    })
  }

  // 실제로 위에서 떨어지는 것처럼 보이게 한다 — 살아남은 스프라이트는 자기 열 안에서
  // 아래로 이동하는 트윈을, 새로 채워지는 칸은 보드 위쪽에서 생성해 떨어지는 트윈을 건다.
  async collapseAndFall() {
    const tweenPromises = []
    for (let c = 0; c < GRID_SIZE; c++) {
      const survivorSprites = []
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        if (this.grid[r][c] !== -1) survivorSprites.push(this.tileSprites[r][c])
      }

      for (let i = 0; i < GRID_SIZE; i++) {
        const destRow = GRID_SIZE - 1 - i
        const destX = BOARD_ORIGIN_X + c * CELL + CELL / 2
        const destY = BOARD_ORIGIN_Y + destRow * CELL + CELL / 2
        let sprite

        if (i < survivorSprites.length) {
          sprite = survivorSprites[i]
          if (sprite.row !== destRow) tweenPromises.push(this.tweenTo(sprite, destX, destY))
        } else {
          const newIndex = i - survivorSprites.length
          const spawnRow = -1 - newIndex
          const typeIdx = Phaser.Math.Between(0, TILE_TYPES.length - 1)
          sprite = this.createTileSprite(spawnRow, c, typeIdx)
          tweenPromises.push(this.tweenTo(sprite, destX, destY))
        }

        sprite.row = destRow
        sprite.col = c
        this.tileSprites[destRow][c] = sprite
      }

      for (let r = 0; r < GRID_SIZE; r++) {
        const sprite = this.tileSprites[r][c]
        this.grid[r][c] = sprite.tileType
        this.special[r][c] = sprite.specialType || null
      }
    }
    await Promise.all(tweenPromises)
  }

  async resolveMatches(swappedCells = null) {
    this.locked = true
    let combo = 0
    let runs = this.findRuns()
    while (runs.length > 0) {
      combo += 1
      const { toClear, promotions } = this.classifyRuns(runs, swappedCells)
      swappedCells = null // 첫 라운드에만 스왑된 칸을 승격 우선순위로 쓴다

      this.expandForSpecialEffects(toClear)
      this.trackCollected(toClear)
      this.score += toClear.size * 10 * combo

      promotions.forEach(({ r, c, type, specialType }) => {
        const sprite = this.tileSprites[r][c]
        if (!sprite) return
        sprite.specialType = specialType
        sprite.setTexture(this.ensureSpecialTexture(TILE_TYPES[type], specialType))
        this.tweens.add({ targets: sprite, scaleX: 1.3, scaleY: 1.3, duration: 150, yoyo: true })
      })

      await this.playClearAnimation(toClear)
      await this.collapseAndFall()
      this.updateHud()

      if (this.checkObjectiveMet()) {
        this.locked = false
        this.playMatchSound()
        this.levelClear()
        return
      }

      runs = this.findRuns()
    }
    if (combo > 0) this.playMatchSound()
    this.updateHud()
    this.locked = false
    if (this.movesLeft <= 0) this.levelFail()
  }

  checkObjectiveMet() {
    const level = LEVELS[this.currentLevel - 1]
    if (level.objective.type === 'score') return this.score >= level.objective.target
    return (this.collected[level.objective.tile] || 0) >= level.objective.count
  }

  updateHud() {
    const level = LEVELS[this.currentLevel - 1]
    this.movesText.setText(t('candyMovesLeft', { moves: this.movesLeft }))
    this.scoreText.setText(t('candyScoreLabel', { score: this.score }))
    if (level.objective.type === 'score') {
      this.objectiveProgressText.setText(t('candyObjectiveScoreProgress', { target: level.objective.target }))
    } else {
      const have = this.collected[level.objective.tile] || 0
      this.objectiveProgressText.setText(
        `${t(TILE_NAME_KEYS[level.objective.tile])} ${t('candyObjectiveCollectProgress', { have, count: level.objective.count })}`,
      )
    }
  }

  hideHud() {
    this.movesText.setVisible(false)
    this.scoreText.setVisible(false)
    this.objectiveProgressText.setVisible(false)
  }

  levelClear() {
    this.state = 'levelClear'
    const coinsEarned = 30 + this.movesLeft * 5
    this.totalCoins += coinsEarned
    localStorage.setItem(CANDY_COINS_KEY, String(this.totalCoins))
    if (this.score > this.bestScore) {
      this.bestScore = this.score
      localStorage.setItem(CANDY_BEST_KEY, String(this.bestScore))
    }
    const hasNextLevel = this.currentLevel < LEVELS.length
    if (this.currentLevel === this.levelUnlocked && hasNextLevel) {
      this.levelUnlocked += 1
      localStorage.setItem(CANDY_LEVEL_KEY, String(this.levelUnlocked))
    }

    this.hideHud()
    this.destroyBoard()
    this.playLevelClearSound()

    this.endTitleText
      .setText(hasNextLevel ? t('candyLevelClearTitle', { level: this.currentLevel }) : t('candyAllLevelsClear'))
      .setVisible(true)
    this.endDetailText.setText(t('candyScoreLabel', { score: this.score })).setVisible(true)
    this.endCoinsText.setText(t('candyCoinsEarned', { coins: coinsEarned })).setVisible(true)
    this.hubButtonBg.setVisible(true)
    this.hubButtonText.setVisible(true)
    this.nextLevelText.setVisible(hasNextLevel)
  }

  levelFail() {
    this.state = 'levelFail'
    this.hideHud()
    this.destroyBoard()
    this.playLevelFailSound()

    this.endTitleText.setText(t('candyLevelFailTitle', { level: this.currentLevel })).setVisible(true)
    this.endDetailText.setText(t('candyScoreLabel', { score: this.score })).setVisible(true)
    this.hubButtonBg.setVisible(true)
    this.hubButtonText.setVisible(true)
    this.retryText.setVisible(true)
  }

  starPoints(cx, cy, outerR, innerR, spikes) {
    const pts = []
    const step = Math.PI / spikes
    let rot = -Math.PI / 2
    for (let i = 0; i < spikes; i++) {
      pts.push({ x: cx + Math.cos(rot) * outerR, y: cy + Math.sin(rot) * outerR })
      rot += step
      pts.push({ x: cx + Math.cos(rot) * innerR, y: cy + Math.sin(rot) * innerR })
      rot += step
    }
    return pts
  }

  // 캔디크러쉬 그림 대신, 이 게임 세계관의 아이콘(로켓/물고기/코인/실드/별)을 로켓/피싱과
  // 같은 방식(Graphics로 그려서 텍스처로 굽고 캐시)으로 직접 그린다. colors는 상점에서
  // 고른 테마의 색상 세트 — "지금 장착된" 테마에 의존하지 않게 파라미터로 받아서, 상점
  // 미리보기에서 다른(장착 안 한) 테마도 그대로 그려볼 수 있게 한다.
  drawBaseIcon(g, type, cx, cy, colors) {
    if (type === 'rocket') {
      g.fillStyle(colors.rocket.flame, 1)
      g.fillTriangle(cx - 4, cy + 12, cx + 4, cy + 12, cx, cy + 19)
      g.fillStyle(colors.rocket.body, 1)
      g.fillEllipse(cx, cy, 13, 24)
      g.fillStyle(colors.rocket.nose, 1)
      g.fillTriangle(cx - 6, cy - 11, cx + 6, cy - 11, cx, cy - 19)
      g.fillStyle(colors.rocket.fin, 1)
      g.fillTriangle(cx - 6, cy + 6, cx - 12, cy + 13, cx - 6, cy + 11)
      g.fillTriangle(cx + 6, cy + 6, cx + 12, cy + 13, cx + 6, cy + 11)
      g.fillStyle(colors.rocket.window, 1)
      g.fillCircle(cx, cy - 3, 3)
    } else if (type === 'fish') {
      g.fillStyle(colors.fish.fin, 1)
      g.fillTriangle(cx - 13, cy, cx - 6, cy - 6, cx - 6, cy + 6)
      g.fillStyle(colors.fish.body, 1)
      g.fillEllipse(cx + 3, cy, 20, 13)
      g.fillStyle(0x0a0a0a, 1)
      g.fillCircle(cx + 9, cy - 2, 1.6)
    } else if (type === 'coin') {
      g.fillStyle(colors.coin.outer, 1)
      g.fillCircle(cx, cy, 16)
      g.fillStyle(colors.coin.inner, 1)
      g.fillCircle(cx, cy, 12)
      g.fillStyle(0xffffff, 0.8)
      g.fillTriangle(cx - 3, cy - 8, cx, cy - 2, cx - 7, cy - 2)
    } else if (type === 'shield') {
      g.fillStyle(colors.shield.body, 1)
      g.fillPoints(
        [
          { x: cx, y: cy - 16 },
          { x: cx + 12, y: cy - 10 },
          { x: cx + 12, y: cy + 2 },
          { x: cx, y: cy + 17 },
          { x: cx - 12, y: cy + 2 },
          { x: cx - 12, y: cy - 10 },
        ],
        true,
      )
      g.fillStyle(colors.shield.accent, 1)
      g.fillRect(cx - 2, cy - 9, 4, 16)
      g.fillRect(cx - 8, cy - 2, 16, 4)
    } else {
      g.fillStyle(colors.star.body, 1)
      g.fillPoints(this.starPoints(cx, cy, 17, 7, 5), true)
    }
  }

  getEquippedThemeId() {
    return localStorage.getItem(CANDY_EQUIPPED_THEME_KEY) || 'default'
  }

  isThemeOwned(id) {
    if (id === 'default') return true
    const owned = JSON.parse(localStorage.getItem(CANDY_OWNED_THEMES_KEY) || '[]')
    return owned.includes(id)
  }

  setThemeOwned(id) {
    const owned = JSON.parse(localStorage.getItem(CANDY_OWNED_THEMES_KEY) || '[]')
    if (!owned.includes(id)) owned.push(id)
    localStorage.setItem(CANDY_OWNED_THEMES_KEY, JSON.stringify(owned))
  }

  ensureTileTexture(type) {
    return this.ensureTileTextureForTheme(type, this.getEquippedThemeId())
  }

  ensureTileTextureForTheme(type, themeId) {
    const key = `candy-${themeId}-${type}`
    if (this.textures.exists(key)) return key
    const theme = CANDY_THEMES.find((th) => th.id === themeId) || CANDY_THEMES[0]
    const size = 40
    const g = this.add.graphics()
    this.drawBaseIcon(g, type, size / 2, size / 2, theme.colors)
    g.generateTexture(key, size, size)
    g.destroy()
    return key
  }

  // 특수 타일은 기반 아이콘 위에 표식을 얹어서 구분한다 — 줄 타일은 굵은 흰 줄(가로/세로),
  // 5x5 폭탄은 겹친 삼중 링, 컬러 폭탄은 사방으로 뻗는 반짝임선.
  ensureSpecialTexture(type, specialType) {
    const themeId = this.getEquippedThemeId()
    const key = `candy-${themeId}-${type}-${specialType}`
    if (this.textures.exists(key)) return key
    const theme = CANDY_THEMES.find((th) => th.id === themeId) || CANDY_THEMES[0]
    const size = 40
    const cx = size / 2
    const cy = size / 2
    const g = this.add.graphics()
    this.drawBaseIcon(g, type, cx, cy, theme.colors)
    if (specialType === 'bomb5') {
      // 3x3 폭탄보다 "더 크게 터진다"는 느낌을 주려고 겹친 삼중 링으로 그린다.
      g.lineStyle(3, 0xffffff, 0.95)
      g.strokeCircle(cx, cy, 18)
      g.lineStyle(2, 0xff4444, 0.9)
      g.strokeCircle(cx, cy, 14)
      g.lineStyle(1.5, 0xff4444, 0.7)
      g.strokeCircle(cx, cy, 10)
    } else if (specialType === 'colorBomb') {
      // 폭탄과 확실히 구분되도록 사방으로 뻗는 반짝임 선으로 그린다.
      g.lineStyle(2, 0xffffff, 0.95)
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI / 4) * i
        g.lineBetween(cx + Math.cos(ang) * 12, cy + Math.sin(ang) * 12, cx + Math.cos(ang) * 19, cy + Math.sin(ang) * 19)
      }
    } else if (specialType === 'lineH') {
      g.fillStyle(0xffffff, 0.85)
      g.fillRect(0, cy - 3, size, 6)
    } else if (specialType === 'lineV') {
      g.fillStyle(0xffffff, 0.85)
      g.fillRect(cx - 3, 0, 6, size)
    }
    g.generateTexture(key, size, size)
    g.destroy()
    return key
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

  playSwapSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, now)
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.14)
  }

  playMatchSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const start = now + i * 0.06
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.16)
    })
  }

  playLevelClearSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((freq, i) => {
      const start = now + i * 0.09
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.22)
    })
  }

  playLevelFailSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(300, now)
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.4)
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.44)
  }
}
