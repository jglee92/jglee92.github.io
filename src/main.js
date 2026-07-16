import Phaser from 'phaser'
import './style.css'
import { initLeaderboard, isLeaderboardEnabled, submitScore, fetchTopScores, reportEntry } from './leaderboard.js'
import { containsBannedWord } from './profanityFilter.js'
import { t, toggleLang } from './i18n.js'
import { initAdMob, isNativeAdsAvailable, showRewardedAd } from './adMob.js'

const GAME_WIDTH = 400
const GAME_HEIGHT = 600

// 표지 로고의 로켓 아이콘은 실제 인게임 스프라이트(56x24)를 2배 넘게 확대해서 보여줘서
// 그대로 쓰면 화질이 깨진다. 이 배율만큼 더 높은 해상도로 따로 그려서 확대해도 선명하게 한다.
const TITLE_ICON_RES_SCALE = 4

// Phaser Text는 게임 전체의 resolution 설정을 자동으로 물려받지 않고, 스타일에 직접
// resolution을 안 주면 항상 1배로 그려진다 — 그래서 canvas 자체는 고해상도로 렌더링되는데도
// 글자만 유독 흐릿해 보였다. 모든 텍스트 스타일에 이 값을 넣어서 폰 고밀도 화면에서도 선명하게 한다.
const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 3)

const GRAVITY = 1200
const FLAP_VELOCITY = 420
const ROCKET_HIT_RADIUS = 11

// 방향은 고정된 4방향이 아니라, 계속 천천히 랜덤하게 흔들리는 연속각(라디안)이다.
const DRIFT_RETARGET_MIN = 2500
const DRIFT_RETARGET_MAX = 4500
const DRIFT_ANGULAR_SPEED = (32 * Math.PI) / 180 // 초당 회전 속도(라디안) — 32도/초

const OBSTACLE_MIN_RADIUS = 18
const OBSTACLE_MAX_RADIUS = 32
const OBSTACLE_SPEED_START = 200
const OBSTACLE_SPEED_MAX = 340
const SPAWN_INTERVAL_START = 900
const SPAWN_INTERVAL_MIN = 450
const DIFFICULTY_SCALE = 25 // 작을수록 초반에 빨리 최대 난이도에 가까워짐

const METEOR_TIER_SCORE = 50
const GALAXY_TIER_SCORE = 100
const BLACKHOLE_TIER_SCORE = 180
const DODGEBALL_MIN_CHANCE = 0.03 // 1점부터도 낮은 확률로 등장
const DODGEBALL_MAX_CHANCE = 0.25 // 점수가 오를수록 이 값까지 서서히 수렴(점근선)
const DODGEBALL_SCALE = 150

const NEAR_MISS_MARGIN = 14 // 히트박스 바로 바깥 이 거리 이내로 스치면 "아슬아슬" 보너스

const POWERUP_RADIUS = 13
const POWERUP_MIN_INTERVAL = 9000
const POWERUP_MAX_INTERVAL = 15000
const MAX_SHIELD_STACK = 3
const MAX_BOMB_STACK = 3

const STAR_COUNT = 60
const NEBULA_COUNT = 5
const NEBULA_HUE_SPEED = 1.4 // 점수 1점당 색상환 회전 각도(도) — 무한히 순환하므로 상한이 필요 없다

const BG_BASE_COLOR = 0x050818
const BG_DEEP_COLOR = 0x01010a
const BG_DEEPEN_SCALE = 600 // 클수록 어두워지는 속도가 느려짐(점근선이라 절대 끝에 도달하지 않음)

const SHOOTING_STAR_SCORE = 300
const SHOOTING_STAR_MIN_INTERVAL = 900
const SHOOTING_STAR_MAX_INTERVAL = 3500

const BEST_SCORE_KEY = 'dodgeflyer-best-score'
const STREAK_DATE_KEY = 'dodgeflyer-streak-date'
const STREAK_COUNT_KEY = 'dodgeflyer-streak-count'

// text 필드 대신 i18n 키를 저장해서, 팝업이 뜨는 시점에 t()로 현재 언어에 맞게 조회한다.
const ACHIEVEMENTS = [
  { score: 50, key: 'achMeteor' },
  { score: 100, key: 'achGalaxy' },
  { score: 180, key: 'achBlackhole' },
  { score: 300, key: 'achChaos' },
]

const CONTINUE_AD_DURATION = 1500 // 실제 광고 SDK 연동 전까지의 자리표시자 재생 시간(ms)

const COINS_KEY = 'dodgeflyer-coins'
const OWNED_SKINS_KEY = 'dodgeflyer-owned-skins'
const EQUIPPED_SKIN_KEY = 'dodgeflyer-equipped-skin'
const OWNED_FLAMES_KEY = 'dodgeflyer-owned-flames'
const EQUIPPED_FLAME_KEY = 'dodgeflyer-equipped-flame'
const NEAR_MISS_TOTAL_KEY = 'dodgeflyer-near-miss-total'
const TOTAL_GAMES_KEY = 'dodgeflyer-total-games'
const TOTAL_SCORE_SUM_KEY = 'dodgeflyer-total-score-sum'
const HAS_SEEN_MANUAL_KEY = 'dodgeflyer-seen-manual'
const NICKNAME_KEY = 'dodgeflyer-nickname'
const HAS_SEEN_NICKNAME_PROMPT_KEY = 'dodgeflyer-seen-nickname-prompt'

// bonusPercent: 보유하면 아이템 등장 확률에 더해지는 %. 싼 스킨은 조금, 비싼/한정 스킨은
// 확실히 크게 차등을 둬서(2~6%) "체감이 안 된다"는 후기를 반영했다. 로켓 합 25% + 불꽃 합 20%
// = 최대 45%.
// name 필드 대신 nameKey(i18n 키)를 저장해서, 상점에 그릴 때 t(nameKey)로 현재 언어에 맞게 조회한다.
const ROCKET_SKINS = [
  { id: 'default', nameKey: 'rocketSkinDefault', cost: 0, body: 0xd8d8e2, nose: 0xd23c3c, fin: 0xb52e2e },
  { id: 'crimson', nameKey: 'rocketSkinCrimson', cost: 50, body: 0xe8e0e0, nose: 0x8b1e3f, fin: 0x5c1229, bonusPercent: 2 },
  { id: 'azure', nameKey: 'rocketSkinAzure', cost: 120, body: 0xe4eefc, nose: 0x1b6ca8, fin: 0x0f3f66, bonusPercent: 3 },
  { id: 'gold', nameKey: 'rocketSkinGold', cost: 250, body: 0xfff3c4, nose: 0xd4a017, fin: 0x8a6c0a, bonusPercent: 4 },
  {
    id: 'neon',
    nameKey: 'rocketSkinNeon',
    cost: 350,
    body: 0x1a1a2e,
    nose: 0xff2fd4,
    fin: 0x2fe8ff,
    unlock: { streak: 3, nearMiss: 300 },
    bonusPercent: 8,
  },
  {
    id: 'holo',
    nameKey: 'rocketSkinHolo',
    cost: 500,
    body: 0xffffff,
    nose: 0xf0f0f0,
    fin: 0xe0e0e0,
    animated: true,
    sparkleCount: 2,
    bonusPercent: 5,
  },
  {
    id: 'diamond',
    nameKey: 'rocketSkinDiamond',
    cost: 800,
    body: 0xeaf6ff,
    nose: 0x3a6fa8,
    fin: 0xffffff,
    animated: true,
    sparkleCount: 4,
    unlock: { streak: 7, nearMiss: 1000 },
    bonusPercent: 12,
  },
]

const FLAME_SKINS = [
  { id: 'default', nameKey: 'flameSkinDefault', cost: 0, outer: 0xffb347, inner: 0xfff176, oscType: 'sawtooth', freqStart: 180, freqEnd: 70 },
  {
    id: 'blue',
    nameKey: 'flameSkinBlue',
    cost: 80,
    outer: 0x4fc3f7,
    inner: 0xd0f0ff,
    oscType: 'sine',
    freqStart: 260,
    freqEnd: 120,
    bonusPercent: 2,
  },
  {
    id: 'green',
    nameKey: 'flameSkinGreen',
    cost: 150,
    outer: 0x66ff99,
    inner: 0xe0ffe8,
    oscType: 'square',
    freqStart: 220,
    freqEnd: 90,
    bonusPercent: 3,
  },
  {
    id: 'shadow',
    nameKey: 'flameSkinShadow',
    cost: 220,
    outer: 0x2a0a3d,
    inner: 0x8e2fd6,
    oscType: 'sawtooth',
    freqStart: 140,
    freqEnd: 45,
    unlock: { streak: 3, nearMiss: 300 },
    bonusPercent: 7,
  },
  {
    id: 'rainbow',
    nameKey: 'flameSkinRainbow',
    cost: 300,
    outer: 0xff66cc,
    inner: 0xffffff,
    animated: true,
    oscType: 'triangle',
    freqStart: 320,
    freqEnd: 100,
    bonusPercent: 5,
  },
  {
    id: 'diamond',
    nameKey: 'flameSkinDiamond',
    cost: 450,
    outer: 0xbfe9ff,
    inner: 0xffffff,
    animated: true,
    oscType: 'sine',
    freqStart: 300,
    freqEnd: 140,
    unlock: { streak: 7, nearMiss: 1000 },
    bonusPercent: 10,
  },
]

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene')
  }

  create(data) {
    this.state = 'ready'
    this.score = 0
    this.bestScore = Number(localStorage.getItem(BEST_SCORE_KEY) || 0)
    this.beatBestThisRun = false
    this.galaxyActive = false
    this.shownAchievements = new Set()
    this.usedContinueThisRun = false
    this.totalCoins = Number(localStorage.getItem(COINS_KEY) || 0)
    this.nearMissTotal = Number(localStorage.getItem(NEAR_MISS_TOTAL_KEY) || 0)
    this.totalGamesPlayed = Number(localStorage.getItem(TOTAL_GAMES_KEY) || 0)
    this.totalScoreSum = Number(localStorage.getItem(TOTAL_SCORE_SUM_KEY) || 0)
    this.hasSeenManual = localStorage.getItem(HAS_SEEN_MANUAL_KEY) === 'true'
    this.hasSeenNicknamePrompt = localStorage.getItem(HAS_SEEN_NICKNAME_PROMPT_KEY) === 'true'
    this.manualIsFirstRun = false
    this.runCoins = 0
    this.lastRunCoinsEarned = 0
    this.runNearMissCount = 0
    this.obstacleSpeed = OBSTACLE_SPEED_START
    this.spawnInterval = SPAWN_INTERVAL_START
    this.gameOverPromptHidden = true
    this.updateDailyStreak()

    // scene.restart()는 create()를 다시 부르지만 this에 걸어둔 일반 JS 프로퍼티는 그대로 남는다.
    // "없으면 만든다" 식으로 지연 생성하는 참조들은 재시작 후 "이전 판에서 이미 destroy된 객체"를
    // 그대로 가리키게 되어 크래시가 났다(this.bird도 같은 문제였다). 매 create()마다 null로
    // 리셋해서 반드시 새로 만들어지게 한다.
    this.achievementText = null
    this.shopTexts = null
    this.leaderboardTexts = null
    this.shopTab = 'rocket'
    this.nickname = localStorage.getItem(NICKNAME_KEY) || null
    initLeaderboard()
    if (typeof window.adConfig !== 'undefined') window.adConfig({ sound: 'on' })
    initAdMob()
    this.holoHue = 0
    this.animRegenTimer = 0
    this.sparkleTimer = 0
    this.flameTrailTimer = 0

    this.shieldCount = 0
    this.shieldGraceUntil = 0
    this.bombCount = 0

    this.driftAngle = Math.PI / 2 // 중력이 아래(+y)를 향하는 상태로 시작
    this.driftTargetAngle = this.driftAngle
    this.driftRetargetTimer = 0

    this.cameras.main.setBackgroundColor('#050818')
    this.physics.world.gravity.set(0, 0)

    this.createStarfield()
    this.ensureSparkTexture()
    this.regenerateRocketTextures()
    this.createRocket()
    this.obstacleGroup = this.physics.add.group()
    this.powerupGroup = this.physics.add.group()
    this.physics.add.overlap(this.bird, this.obstacleGroup, (bird, obstacle) => this.handleObstacleHit(obstacle), null, this)
    this.physics.add.overlap(this.bird, this.powerupGroup, (bird, powerup) => this.collectPowerup(powerup), null, this)

    this.shieldRing = this.add.circle(this.bird.x, this.bird.y, ROCKET_HIT_RADIUS + 6, 0x4fc3f7, 0)
    this.shieldRing.setStrokeStyle(3, 0x8fe3ff, 0.9)
    this.shieldRing.setVisible(false)
    this.shieldRing.setDepth(300)

    this.createUI()

    this.input.on('pointerdown', (pointer, currentlyOver) => this.handleInput(currentlyOver))
    this.input.keyboard.on('keydown-SPACE', () => this.handleInput())

    // 숫자키는 상점(state==='shop')에서만 스킨/불꽃 선택으로 쓰인다.
    this.input.keyboard.on('keydown-ONE', () => {
      if (this.state === 'shop') this.selectCurrent(0)
    })
    this.input.keyboard.on('keydown-TWO', () => {
      if (this.state === 'shop') this.selectCurrent(1)
    })
    this.input.keyboard.on('keydown-THREE', () => {
      if (this.state === 'shop') this.selectCurrent(2)
    })
    this.input.keyboard.on('keydown-FOUR', () => {
      if (this.state === 'shop') this.selectCurrent(3)
    })
    this.input.keyboard.on('keydown-FIVE', () => {
      if (this.state === 'shop') this.selectCurrent(4)
    })
    // 로켓 스킨이 5종을 넘어서(6,7번째) 상점 전용으로 숫자키를 더 받는다. 불꽃 탭은 4종뿐이라 안 겹친다.
    this.input.keyboard.on('keydown-SIX', () => {
      if (this.state === 'shop') this.selectCurrent(5)
    })
    this.input.keyboard.on('keydown-SEVEN', () => {
      if (this.state === 'shop') this.selectCurrent(6)
    })
    this.input.keyboard.on('keydown-Q', () => {
      if (this.state === 'shop') this.toggleShopTab()
    })

    this.input.keyboard.on('keydown-C', () => this.tryContinue())
    this.input.keyboard.on('keydown-B', () => this.useBomb())
    this.input.keyboard.on('keydown-M', () => {
      if (this.state === 'ready') {
        this.manualIsFirstRun = false
        this.showManual()
      }
    })
    this.input.keyboard.on('keydown-S', () => {
      if (this.state === 'ready') this.openShop()
      else if (this.state === 'shop') this.closeShop()
    })
    this.input.keyboard.on('keydown-L', () => {
      if (this.state === 'ready') this.openLeaderboard()
      else if (this.state === 'leaderboard') this.closeLeaderboard()
    })

    this.spawnTimer = this.time.addEvent({
      delay: this.spawnInterval,
      loop: true,
      callback: () => this.spawnObstacle(),
      paused: true,
    })

    this.powerupTimer = this.time.addEvent({
      delay: this.getPowerupInterval(),
      loop: true,
      callback: () => {
        this.spawnPowerup()
        this.powerupTimer.delay = this.getPowerupInterval()
      },
      paused: true,
    })

    this.scheduleShootingStar()

    // "다시 하시겠습니까?"에서 "예"를 누르면 재시작과 동시에 바로 플레이로 들어간다
    // (대기화면에서 또 한 번 탭할 필요 없이 바로 이어서 할 수 있게).
    if (data && data.autoStart) {
      this.startGame()
    }
  }

  // ---------- 배경: 별 + 은하 네뷸라 ----------

  createStarfield() {
    this.stars = []
    for (let i = 0; i < STAR_COUNT; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(1, 2.4),
        0xffffff,
        Phaser.Math.FloatBetween(0.35, 1),
      )
      star.parallax = Phaser.Math.FloatBetween(0.15, 0.5)
      this.stars.push(star)
    }

    this.nebulaBlobs = []
    for (let i = 0; i < NEBULA_COUNT; i++) {
      const blob = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.Between(60, 120),
        0x8855ff,
        0,
      )
      blob.setBlendMode(Phaser.BlendModes.ADD)
      blob.targetAlpha = Phaser.Math.FloatBetween(0.08, 0.18)
      blob.parallax = Phaser.Math.FloatBetween(0.05, 0.15)
      blob.hueOffset = Phaser.Math.Between(0, 360)
      this.nebulaBlobs.push(blob)
    }

    this.bgColorFrom = Phaser.Display.Color.ValueToColor(BG_BASE_COLOR)
    this.bgColorTo = Phaser.Display.Color.ValueToColor(BG_DEEP_COLOR)
    this.shootingStars = []
  }

  getCosmicProgress() {
    return 1 - Math.exp(-this.score / BG_DEEPEN_SCALE)
  }

  updateCosmicVisuals() {
    const progress = this.getCosmicProgress()
    const bg = Phaser.Display.Color.Interpolate.ColorWithColor(
      this.bgColorFrom,
      this.bgColorTo,
      100,
      progress * 100,
    )
    this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(bg.r, bg.g, bg.b))

    this.nebulaBlobs.forEach((blob) => {
      const hue = (((this.score * NEBULA_HUE_SPEED + blob.hueOffset) % 360) + 360) % 360
      const rgb = Phaser.Display.Color.HSVToRGB(hue / 360, 0.6, 1)
      // setFillStyle(color)는 fillAlpha를 생략하면 기본값 1(완전 불투명)로 초기화해버려서
      // 갤럭시 티어 페이드인으로 설정해둔 낮은 투명도를 매 프레임 덮어썼었다. 현재 값을 그대로 넘겨 보존한다.
      blob.setFillStyle(rgb.color, blob.fillAlpha)
    })
  }

  // ---------- 별똥별 (300점부터, 점수가 높을수록 자주) ----------

  scheduleShootingStar() {
    const interval = Phaser.Math.Clamp(
      SHOOTING_STAR_MAX_INTERVAL - this.score * 4,
      SHOOTING_STAR_MIN_INTERVAL,
      SHOOTING_STAR_MAX_INTERVAL,
    )
    this.time.delayedCall(interval, () => {
      if (this.score >= SHOOTING_STAR_SCORE) this.spawnShootingStar()
      this.scheduleShootingStar()
    })
  }

  spawnShootingStar() {
    const fromLeft = Phaser.Math.Between(0, 1) === 0
    const startX = fromLeft
      ? Phaser.Math.Between(-20, GAME_WIDTH * 0.3)
      : Phaser.Math.Between(GAME_WIDTH * 0.7, GAME_WIDTH + 20)
    const startY = Phaser.Math.Between(-20, GAME_HEIGHT * 0.25)
    const angle = fromLeft
      ? Phaser.Math.FloatBetween(0.35, 0.75)
      : Math.PI - Phaser.Math.FloatBetween(0.35, 0.75)
    const speed = Phaser.Math.Between(500, 750)

    const g = this.add.graphics()
    g.fillStyle(0xffffff, 0.55)
    g.fillTriangle(0, -1.5, 0, 1.5, -42, 0)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(0, 0, 2.4)
    g.setPosition(startX, startY)
    g.setRotation(angle)

    g.vx = Math.cos(angle) * speed
    g.vy = Math.sin(angle) * speed
    g.life = 1200

    this.shootingStars.push(g)
  }

  updateShootingStars(delta) {
    this.shootingStars = this.shootingStars.filter((s) => {
      s.x += s.vx * (delta / 1000)
      s.y += s.vy * (delta / 1000)
      s.life -= delta
      const alive = s.life > 0 && s.x > -60 && s.x < GAME_WIDTH + 60 && s.y > -60 && s.y < GAME_HEIGHT + 60
      if (!alive) s.destroy()
      return alive
    })
  }

  updateStarfield(delta) {
    // 세계는 중력의 반대쪽(로켓이 나아가는 쪽)으로 흘러간다 — 로켓과 같은 driftAngle을 그대로 따라가서
    // 방향이 흔들릴 때 배경도 로켓과 함께 자연스럽게 대각선으로 흐른다.
    const moveAngle = this.driftAngle + Math.PI
    const speed = this.obstacleSpeed * (delta / 1000)
    const dx = Math.cos(moveAngle) * speed
    const dy = Math.sin(moveAngle) * speed

    this.stars.forEach((s) => {
      s.x = Phaser.Math.Wrap(s.x + dx * s.parallax, 0, GAME_WIDTH)
      s.y = Phaser.Math.Wrap(s.y + dy * s.parallax, 0, GAME_HEIGHT)
    })
    this.nebulaBlobs.forEach((b) => {
      b.x = Phaser.Math.Wrap(b.x + dx * b.parallax, 0, GAME_WIDTH)
      b.y = Phaser.Math.Wrap(b.y + dy * b.parallax, 0, GAME_HEIGHT)
    })
  }

  activateGalaxyTier() {
    if (this.galaxyActive) return
    this.galaxyActive = true
    this.nebulaBlobs.forEach((blob) => {
      this.tweens.add({ targets: blob, fillAlpha: blob.targetAlpha, duration: 1500 })
    })
  }

  // ---------- 재방문 장치: 일일 스트릭 + 업적 팝업 ----------

  updateDailyStreak() {
    const todayStr = new Date().toDateString()
    const lastStr = localStorage.getItem(STREAK_DATE_KEY)
    let streak = Number(localStorage.getItem(STREAK_COUNT_KEY) || 0)

    if (lastStr !== todayStr) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      streak = lastStr === yesterday.toDateString() ? streak + 1 : 1
      localStorage.setItem(STREAK_DATE_KEY, todayStr)
      localStorage.setItem(STREAK_COUNT_KEY, String(streak))
    }

    this.dailyStreak = streak
  }

  showAchievement(text) {
    if (!this.achievementText) {
      // 빈 문자열('')로 Text를 만든 뒤 나중에 이모지 포함 문자열로 setText하면
      // 내부 캔버스 텍스처가 깨진 상태가 되어 크래시가 났다(게임 전체가 멈추는 원인).
      // 공백 하나로 초기화해서 그 경로를 피한다. 메시지가 길어질 때(세트 효과 등) 화면 밖으로
      // 잘리지 않도록 wordWrap을 다시 넣는다 — 그 크래시는 사실 wordWrap 때문이 아니라
      // scene.restart() 후 이 참조가 파괴된 객체를 가리키던 문제였고, 그건 이미 따로 고쳤다.
      this.achievementText = this.add
        .text(GAME_WIDTH / 2, 110, ' ', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#ffe066',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 50 },
          resolution: TEXT_RESOLUTION,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(500)
    }

    this.tweens.killTweensOf(this.achievementText)
    this.achievementText.setText(text).setScale(0.6).setAlpha(1)
    this.tweens.add({ targets: this.achievementText, scale: 1, duration: 250, ease: 'Back.easeOut' })
    this.tweens.add({ targets: this.achievementText, alpha: 0, delay: 1400, duration: 400 })
  }

  showNearMissBonus(x, y) {
    const text = this.add
      .text(x, y, t('nearMissBonus'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    })

    const ring = this.add.circle(x, y, 10, 0xffe066, 0)
    ring.setStrokeStyle(2, 0xffe066, 0.9)
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    })
  }

  checkAchievements() {
    ACHIEVEMENTS.forEach((achievement) => {
      if (this.score >= achievement.score && !this.shownAchievements.has(achievement.score)) {
        this.shownAchievements.add(achievement.score)
        this.showAchievement(t(achievement.key))
      }
    })
  }

  // ---------- 광고: 웹은 Google Ad Placement API(리워드), 승인 전/광고 없음이면 자리표시자로 대체 ----------

  playPlaceholderAd(onComplete) {
    this.state = 'ad-placeholder'
    this.messageText.setText(t('adPlaceholder'))
    this.subMessageText.setVisible(false)
    this.continueButtonText.setVisible(false)
    this.hideRestartPrompt()
    this.time.delayedCall(CONTINUE_AD_DURATION, onComplete)
  }

  // adBreak()의 showAdFn()은 "사용자의 직접적인 클릭"에서 호출해야 하므로, 광고 준비가
  // 됐다는 신호(beforeReward)를 받으면 바로 재생하지 않고 확인 버튼을 하나 더 보여준 뒤
  // 그 클릭에서 showAdFn()을 호출한다.
  showAdConfirmPrompt(showAdFn) {
    const baseStyle = {
      fontFamily: 'system-ui, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: TEXT_RESOLUTION,
    }
    const backdrop = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setDepth(900)
    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, t('adReadyMessage'), { ...baseStyle, fontSize: '17px', align: 'center' })
      .setOrigin(0.5)
      .setDepth(901)
    const btn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 25, t('adWatchButton'), { ...baseStyle, fontSize: '18px', color: '#ffe066' })
      .setOrigin(0.5)
      .setDepth(901)
      .setInteractive({ useHandCursor: true })
    btn.isUiButton = true
    btn.on('pointerdown', () => {
      backdrop.destroy()
      label.destroy()
      btn.destroy()
      showAdFn()
    })
  }

  // 리워드 광고 재생을 시도한다. 앱(Capacitor 네이티브)에서는 AdMob을, 웹에서는 Ad
  // Placement API를 쓴다. 둘 다 광고 자체를 못 띄우는 상황(스크립트 차단, 계정 승인
  // 전 등)이면 자리표시자로 대체해서 "이어하기" 흐름 자체는 끊기지 않게 한다.
  requestRewardedAd() {
    if (isNativeAdsAvailable()) {
      showRewardedAd(
        () => this.continueAfterAd(),
        () => {
          this.usedContinueThisRun = false
          this.showRestartPrompt()
        },
      )
      return
    }

    if (typeof window.adBreak === 'undefined') {
      this.playPlaceholderAd(() => this.continueAfterAd())
      return
    }

    // index.html의 adBreak/adConfig는 adsbygoogle 배열에 그냥 쌓아두기만 하는 큐라서,
    // 광고 차단 프로그램 등으로 실제 adsbygoogle.js 자체가 로드되지 않으면 그 큐를 아무도
    // 처리하지 않아 콜백이 영원히 하나도 안 불릴 수 있다. 일정 시간 안에 아무 콜백도 안 오면
    // 자리표시자로 대체해서 플레이어가 멈춰있지 않게 한다.
    let settled = false
    const fallbackTimer = this.time.delayedCall(4000, () => {
      if (settled) return
      settled = true
      this.playPlaceholderAd(() => this.continueAfterAd())
    })

    window.adBreak({
      type: 'reward',
      name: 'continue-game',
      beforeReward: (showAdFn) => {
        settled = true
        fallbackTimer.remove()
        this.showAdConfirmPrompt(showAdFn)
      },
      adViewed: () => {
        settled = true
        fallbackTimer.remove()
        this.continueAfterAd()
      },
      adDismissed: () => {
        // 끝까지 안 봐서 보상 없음 — 다시 시도할 수 있게 게임오버 확인 화면으로 되돌린다.
        settled = true
        fallbackTimer.remove()
        this.usedContinueThisRun = false
        this.showRestartPrompt()
      },
      adBreakDone: () => {
        if (settled) return
        settled = true
        fallbackTimer.remove()
        this.playPlaceholderAd(() => this.continueAfterAd())
      },
    })
  }

  tryContinue() {
    if (this.state !== 'gameover' || this.usedContinueThisRun) return
    this.usedContinueThisRun = true
    this.requestRewardedAd()
  }

  continueAfterAd() {
    // 부활 지점 주변 장애물을 정리해서 최소한의 안전 구간을 준다.
    this.obstacleGroup.children.each((obstacle) => this.destroyObstacle(obstacle))

    this.bird.clearTint()
    this.bird.setAlpha(1)
    this.bird.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
    this.bird.setVelocity(0, 0)
    this.physics.resume()

    this.messageText.setVisible(false)
    this.shieldInventoryText.setVisible(true)
    this.bombInventoryText.setVisible(true)
    this.spawnTimer.paused = false
    this.powerupTimer.paused = false
    this.state = 'playing'
    this.flap()
  }

  // ---------- 상점 (로켓 스킨 / 불꽃 색상) ----------

  ensureSkinPreviewTexture(skin) {
    const key = `preview-rocket-${skin.id}`
    if (this.textures.exists(key)) return key
    const g = this.make.graphics({ x: 0, y: 0, add: false })

    g.fillStyle(skin.body, 1)
    g.fillEllipse(20, 12, 26, 16)

    if (skin.animated) {
      // 홀로그램 미리보기는 매번 같은 모습이어야 하므로(장착 중인 애니메이션과 무관하게)
      // 정지된 무지개 띠를 고정 색상으로 그린다.
      const bands = 6
      for (let i = 0; i < bands; i++) {
        const rgb = Phaser.Display.Color.HSVToRGB(i / bands, 0.55, 1)
        g.fillStyle(rgb.color, 0.45)
        const sx = 8 + (i / bands) * 24
        g.fillTriangle(sx, 4, sx + 3, 4, sx - 3, 20)
      }
    }

    g.fillStyle(skin.nose, 1)
    g.fillTriangle(32, 5, 32, 19, 40, 12)

    g.fillStyle(skin.fin, 1)
    g.fillTriangle(14, 3, 22, 10, 8, 10)
    g.fillTriangle(14, 21, 22, 14, 8, 14)

    g.fillStyle(0x4fc3f7, 1)
    g.fillCircle(20, 12, 4)

    g.generateTexture(key, 40, 24)
    g.destroy()
    return key
  }

  ensureFlamePreviewTexture(flame) {
    const key = `preview-flame-${flame.id}`
    if (this.textures.exists(key)) return key
    const g = this.make.graphics({ x: 0, y: 0, add: false })

    if (flame.id === 'rainbow') {
      const bands = 5
      for (let i = 0; i < bands; i++) {
        const rgb = Phaser.Display.Color.HSVToRGB(i / bands, 0.85, 1)
        const t0 = i / bands
        const t1 = (i + 1) / bands
        g.fillStyle(rgb.color, 1)
        g.fillTriangle(30 - 26 * t0, 4 + 8 * t0, 30 - 26 * t0, 20 - 8 * t0, 30 - 26 * t1, 12)
      }
    } else {
      g.fillStyle(flame.outer, 1)
      g.fillTriangle(30, 4, 30, 20, 4, 12)
      g.fillStyle(flame.inner, 1)
      g.fillTriangle(30, 8, 30, 16, 30 - 26 * 0.55, 12)

      if (flame.id === 'diamond') {
        g.fillStyle(0xffffff, 0.8)
        g.fillTriangle(30, 10, 30, 14, 30 - 26 * 0.4, 12)
      }
    }

    g.generateTexture(key, 36, 24)
    g.destroy()
    return key
  }

  // 로켓/불꽃을 따로 보여주면 실제로 장착했을 때 어떻게 어우러지는지 안 보인다는 후기가 있어서,
  // 실제 게임에서 쓰는 drawRocketTexture를 그대로 재사용해 몸통+불꽃이 합쳐진 미리보기를 만든다.
  ensureCombinedPreviewTexture(skin, flame, flameLen = 14, resScale = 1) {
    const key = `preview-combo-${skin.id}-${flame.id}-${flameLen}-${resScale}`
    if (this.textures.exists(key)) return key
    this.drawRocketTexture(key, flameLen, skin, flame, resScale)
    return key
  }

  openShop() {
    if (this.state !== 'ready') return
    this.state = 'shop'
    // 대기화면에서 둥둥 떠 있는 로켓이 상점 글 사이 빈틈으로 비쳐 보이는 문제가 있어서 숨긴다.
    this.bird.setVisible(false)
    this.scoreText.setVisible(false)
    this.messageText.setVisible(false)
    this.subMessageText.setVisible(false)
    this.streakText.setVisible(false)
    this.titleGroup.forEach((o) => o.setVisible(false))
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)
    this.manualButtonBg.setVisible(false)
    this.manualButtonText.setVisible(false)
    this.leaderboardButtonBg.setVisible(false)
    this.leaderboardButtonText.setVisible(false)
    this.langButtonBg.setVisible(false)
    this.langButtonText.setVisible(false)
    this.renderShop()
  }

  closeShop() {
    if (this.shopTexts) {
      this.shopTexts.forEach((t) => t.destroy())
      this.shopTexts = null
    }
    this.state = 'ready'
    this.bird.setVisible(true)
    this.scoreText.setVisible(true)
    this.messageText.setVisible(true)
    this.subMessageText.setVisible(true)
    this.streakText.setVisible(true)
    this.titleGroup.forEach((o) => o.setVisible(true))
    this.shopButtonBg.setVisible(true)
    this.shopButtonText.setVisible(true)
    this.shopButtonText.setText(t('shopButtonLabel', { coins: this.totalCoins }))
    this.manualButtonBg.setVisible(true)
    this.manualButtonText.setVisible(true)
    this.leaderboardButtonBg.setVisible(true)
    this.leaderboardButtonText.setVisible(true)
    this.langButtonBg.setVisible(true)
    this.langButtonText.setVisible(true)

    // 상점에서 로켓/불꽃을 바꿨을 수 있으니, 표지 로고 아이콘도 최신 장착 상태로 갱신한다.
    const skin = this.getEquippedSkin()
    const flame = this.getEquippedFlame()
    this.titleFlameKeys = {
      short: this.ensureCombinedPreviewTexture(skin, flame, 12, TITLE_ICON_RES_SCALE),
      long: this.ensureCombinedPreviewTexture(skin, flame, 20, TITLE_ICON_RES_SCALE),
    }
    this.titleRocketIcon.setTexture(this.titleFlameOn ? this.titleFlameKeys.long : this.titleFlameKeys.short)
  }

  toggleShopTab() {
    this.shopTab = this.shopTab === 'rocket' ? 'flame' : 'rocket'
    this.renderShop()
  }

  // ---------- 랭킹 (로그인 없이 닉네임만으로 참여) ----------

  openLeaderboard() {
    if (this.state !== 'ready') return
    this.state = 'leaderboard'
    this.bird.setVisible(false)
    this.scoreText.setVisible(false)
    this.messageText.setVisible(false)
    this.subMessageText.setVisible(false)
    this.streakText.setVisible(false)
    this.titleGroup.forEach((o) => o.setVisible(false))
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)
    this.manualButtonBg.setVisible(false)
    this.manualButtonText.setVisible(false)
    this.leaderboardButtonBg.setVisible(false)
    this.leaderboardButtonText.setVisible(false)
    this.langButtonBg.setVisible(false)
    this.langButtonText.setVisible(false)
    this.renderLeaderboard()
  }

  closeLeaderboard() {
    if (this.leaderboardTexts) {
      this.leaderboardTexts.forEach((t) => t.destroy())
      this.leaderboardTexts = null
    }
    this.state = 'ready'
    this.bird.setVisible(true)
    this.scoreText.setVisible(true)
    this.messageText.setVisible(true)
    this.subMessageText.setVisible(true)
    this.streakText.setVisible(true)
    this.titleGroup.forEach((o) => o.setVisible(true))
    this.shopButtonBg.setVisible(true)
    this.shopButtonText.setVisible(true)
    this.manualButtonBg.setVisible(true)
    this.manualButtonText.setVisible(true)
    this.leaderboardButtonBg.setVisible(true)
    this.leaderboardButtonText.setVisible(true)
    this.langButtonBg.setVisible(true)
    this.langButtonText.setVisible(true)
  }

  renderLeaderboard() {
    if (this.leaderboardTexts) {
      this.leaderboardTexts.forEach((t) => t.destroy())
    }
    this.leaderboardTexts = []

    const style = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: TEXT_RESOLUTION,
    }

    let cursorY = 20
    const backButton = this.add
      .text(14, cursorY, t('backButton'), { ...style, fontSize: '14px' })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeLeaderboard())
    backButton.isUiButton = true
    this.leaderboardTexts.push(backButton)

    const title = this.add
      .text(GAME_WIDTH / 2, cursorY, t('leaderboardTitle'), { ...style, fontSize: '18px', align: 'center' })
      .setOrigin(0.5, 0)
    this.leaderboardTexts.push(title)
    let cursorY2 = cursorY + title.height + 18

    if (!isLeaderboardEnabled()) {
      const notice = this.add
        .text(GAME_WIDTH / 2, cursorY2, t('leaderboardDisabled'), {
          ...style,
          fontSize: '14px',
          align: 'center',
        })
        .setOrigin(0.5, 0)
      this.leaderboardTexts.push(notice)
      return
    }

    const loading = this.add
      .text(GAME_WIDTH / 2, cursorY2, t('leaderboardLoading'), { ...style, fontSize: '14px', align: 'center' })
      .setOrigin(0.5, 0)
    this.leaderboardTexts.push(loading)

    // 목록을 불러오는 동안 사용자가 뒤로 나가버릴 수 있으니, 그 사이 상점처럼 다른 화면으로
    // 넘어갔다면 이제 와서 화면에 그리지 않는다(이미 없는 leaderboardTexts를 건드리면 위험하다).
    fetchTopScores(10).then((scores) => {
      if (this.state !== 'leaderboard') return
      loading.destroy()
      // 여기 콜백 파라미터 이름을 t로 두면 i18n의 t() 함수를 가려버리므로(shadowing) txt로 둔다.
      this.leaderboardTexts = this.leaderboardTexts.filter((txt) => txt !== loading)

      let rowY = cursorY2
      if (scores.length === 0) {
        const empty = this.add
          .text(GAME_WIDTH / 2, rowY, t('leaderboardEmpty'), {
            ...style,
            fontSize: '13px',
            align: 'center',
          })
          .setOrigin(0.5, 0)
        this.leaderboardTexts.push(empty)
        rowY += empty.height + 16
      } else {
        // 순위 한 줄에 다 욱여넣으면(닉네임/로켓/최고/평균/참여) 400px 폭에서 글자가 너무
        // 작아져 읽기 힘들어지니, "닉네임+로켓 아이콘" 한 줄 + 통계 작은 글씨 한 줄로 나눈다.
        scores.forEach((s, i) => {
          const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`
          const skin = ROCKET_SKINS.find((sk) => sk.id === s.skinId) || ROCKET_SKINS[0]
          const flame = FLAME_SKINS.find((fl) => fl.id === s.flameId) || FLAME_SKINS[0]
          const gamesPlayed = s.gamesPlayed || 0
          const avgScore = gamesPlayed > 0 ? Math.round((s.totalScore || 0) / gamesPlayed) : 0

          const nameRow = this.add
            .text(0, rowY, `${medal} ${s.nickname}`, { ...style, fontSize: '14px' })
            .setOrigin(0, 0)
          this.leaderboardTexts.push(nameRow)

          const statsRow = this.add
            .text(0, rowY + nameRow.height + 2, t('leaderboardStats', { best: s.bestScore ?? 0, avg: avgScore, games: gamesPlayed }), {
              ...style,
              fontSize: '11px',
              color: '#cfd8ff',
              strokeThickness: 2,
            })
            .setOrigin(0, 0)
          this.leaderboardTexts.push(statsRow)

          // 아이콘+글자 덩어리를 하나로 보고, 그 폭만큼 좌우 여백을 맞춰서 화면 중앙에 오게 한다.
          const blockHeight = nameRow.height + statsRow.height + 2
          const iconSize = 56
          const iconGap = 12
          const textWidth = Math.max(nameRow.width, statsRow.width)
          const startX = (GAME_WIDTH - (iconSize + iconGap + textWidth)) / 2

          const icon = this.add
            .image(startX + iconSize / 2, rowY + blockHeight / 2, this.ensureCombinedPreviewTexture(skin, flame, 12))
            .setOrigin(0.5)
          this.leaderboardTexts.push(icon)

          nameRow.setX(startX + iconSize + iconGap)
          statsRow.setX(startX + iconSize + iconGap)

          // 욕설 필터를 우회한 닉네임이 있을 수 있으니, 각 항목마다 신고할 수 있게 한다.
          // 신고 내역은 개발자가 콘솔에서 직접 확인하고 문제 있으면 지운다.
          const reportBtn = this.add
            .text(GAME_WIDTH - 18, rowY + blockHeight / 2, '🚩', { fontSize: '13px' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
              if (reportBtn.reported) return
              reportBtn.reported = true
              reportBtn.setAlpha(0.4)
              reportEntry(s.id, s.nickname)
            })
          reportBtn.isUiButton = true
          this.leaderboardTexts.push(reportBtn)

          rowY += blockHeight + 10
        })
        rowY += 6
      }

      if (this.nickname) {
        const myInfo = this.add
          .text(GAME_WIDTH / 2, rowY, t('leaderboardMyNickname', { nickname: this.nickname }), { ...style, fontSize: '12px', color: '#ffe066' })
          .setOrigin(0.5, 0)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.setupNicknameAndSubmit())
        myInfo.isUiButton = true
        this.leaderboardTexts.push(myInfo)
        rowY += myInfo.height + 10
      } else {
        const joinBtn = this.add
          .text(GAME_WIDTH / 2, rowY, t('leaderboardJoin'), { ...style, fontSize: '14px', color: '#ffe066' })
          .setOrigin(0.5, 0)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.setupNicknameAndSubmit())
        joinBtn.isUiButton = true
        this.leaderboardTexts.push(joinBtn)
        rowY += joinBtn.height + 10
      }

      const disclaimer = this.add
        .text(GAME_WIDTH / 2, rowY, t('leaderboardDisclaimer'), {
          ...style,
          fontSize: '10px',
          color: '#8a8fa8',
          strokeThickness: 2,
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 40 },
        })
        .setOrigin(0.5, 0)
      this.leaderboardTexts.push(disclaimer)
    })
  }

  async setupNicknameAndSubmit() {
    const nickname = await this.promptNickname(this.nickname || '')
    if (!nickname) return
    this.nickname = nickname
    localStorage.setItem(NICKNAME_KEY, nickname)
    await submitScore(nickname, this.bestScore, this.getEquippedSkinId(), this.getEquippedFlameId())
    if (this.state === 'leaderboard') this.renderLeaderboard()
  }

  // 매뉴얼을 처음 다 보고 나면 딱 한 번만 닉네임을 저장할지 물어본다. 물어본 다음 바로
  // 게임을 시작해버리면 "닉네임 짓자마자 갑자기 플레이 중"이 돼서 당황스러우니, 대기화면으로
  // 돌아가서 다른 화면 전환과 마찬가지로 사용자가 직접 탭해서 시작하게 한다.
  // "그냥하기"를 눌러도 다시는 안 물어보고, 나중에 랭킹 화면에서 언제든 설정할 수 있다.
  async maybePromptNicknameThenReady() {
    if (!this.hasSeenNicknamePrompt) {
      this.hasSeenNicknamePrompt = true
      localStorage.setItem(HAS_SEEN_NICKNAME_PROMPT_KEY, 'true')
      const nickname = await this.promptNickname('', {
        message: t('nicknameFirstMessage'),
        confirmLabel: t('nicknameFirstConfirm'),
        skipLabel: t('nicknameFirstSkip'),
      })
      if (nickname) {
        this.nickname = nickname
        localStorage.setItem(NICKNAME_KEY, nickname)
        submitScore(nickname, this.bestScore, this.getEquippedSkinId(), this.getEquippedFlameId())
      }
    }
    this.closeManualToReady()
  }

  // Phaser 캔버스 위에 순수 HTML <input>을 겹쳐서 닉네임을 받는다. 나중에 앱(Capacitor
  // 웹뷰)으로 패키징해도 동작을 보장할 수 있게, window.prompt() 대신 이 방식을 쓴다.
  // 처음 시작할 때(저장하기/그냥하기)와 랭킹 화면에서 다시 설정할 때(확인/취소)
  // 문구/버튼 표현이 달라야 해서 옵션으로 받는다.
  promptNickname(defaultValue, options = {}) {
    const {
      message = t('nicknamePromptMessage'),
      confirmLabel = t('nicknamePromptConfirm'),
      skipLabel = t('nicknamePromptCancel'),
    } = options
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.style.cssText =
        'position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; z-index: 1000;'

      const box = document.createElement('div')
      box.style.cssText =
        'background: #14142b; border: 2px solid #ffd700; border-radius: 10px; padding: 20px 24px; display: flex; flex-direction: column; gap: 10px; align-items: center; font-family: system-ui, sans-serif; max-width: 280px;'

      const label = document.createElement('div')
      label.textContent = message
      label.style.cssText = 'color: #fff; font-size: 14px; text-align: center; white-space: pre-line;'

      const input = document.createElement('input')
      input.maxLength = 8
      input.value = defaultValue
      input.style.cssText =
        'font-size: 16px; padding: 6px 10px; border-radius: 6px; border: none; text-align: center; width: 160px;'

      const errorLabel = document.createElement('div')
      errorLabel.style.cssText = 'color: #ff6b6b; font-size: 12px; display: none;'

      const buttonRow = document.createElement('div')
      buttonRow.style.cssText = 'display: flex; gap: 10px;'

      const confirmBtn = document.createElement('button')
      confirmBtn.textContent = confirmLabel
      confirmBtn.style.cssText =
        'font-size: 15px; padding: 6px 20px; border-radius: 6px; border: none; background: #ffd700; cursor: pointer; font-weight: bold;'

      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = skipLabel
      cancelBtn.style.cssText =
        'font-size: 15px; padding: 6px 20px; border-radius: 6px; border: 1px solid #888; background: transparent; color: #ccc; cursor: pointer;'

      const finish = (value) => {
        document.body.removeChild(overlay)
        resolve(value)
      }
      confirmBtn.addEventListener('click', () => {
        const v = input.value.trim()
        if (!v) return
        if (containsBannedWord(v)) {
          errorLabel.textContent = t('nicknameBannedWord')
          errorLabel.style.display = 'block'
          return
        }
        finish(v)
      })
      cancelBtn.addEventListener('click', () => finish(null))
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmBtn.click()
      })
      input.addEventListener('input', () => {
        errorLabel.style.display = 'none'
      })

      buttonRow.appendChild(confirmBtn)
      buttonRow.appendChild(cancelBtn)
      box.appendChild(label)
      box.appendChild(input)
      box.appendChild(errorLabel)
      box.appendChild(buttonRow)
      overlay.appendChild(box)
      document.body.appendChild(overlay)
      input.focus()
    })
  }

  renderShop() {
    if (this.shopTexts) {
      this.shopTexts.forEach((t) => t.destroy())
    }
    this.shopTexts = []

    const style = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: TEXT_RESOLUTION,
    }

    // 겹침 문제를 계속 손으로 좌표 맞추다 어긋나서, 대신 각 줄을 "위쪽 기준(origin y=0)"으로
    // 놓고 실제 렌더된 높이(.height)를 잰 다음 커서를 그만큼 내리는 방식으로 쌓는다.
    // 이러면 폰트/줄 수가 달라져도 항상 다음 요소가 이전 요소 아래로 확실히 밀려서 겹칠 수 없다.
    let cursorY = 20

    const title = this.add
      .text(GAME_WIDTH / 2, cursorY, t('shopTitle', { coins: this.totalCoins }), { ...style, fontSize: '17px', align: 'center' })
      .setOrigin(0.5, 0)
    this.shopTexts.push(title)

    // 목록이 길어지면 아래쪽 "탭해서 닫기"까지 스크롤(이 게임엔 스크롤이 없어 화면 밖)해야
    // 닫을 수 있는 문제가 있어서, 항상 보이는 왼쪽 위에 뒤로가기 버튼을 따로 둔다.
    const backButton = this.add
      .text(14, cursorY, t('backButton'), { ...style, fontSize: '14px' })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeShop())
    backButton.isUiButton = true
    this.shopTexts.push(backButton)

    // 첫 화면(대기화면)에 커스터마이징 미리보기를 두는 건 의미가 없다는 후기가 있어서,
    // 대신 상점 제목 옆(오른쪽 위)에 지금 장착 중인 로켓+불꽃 합쳐진 미리보기를 작게 보여준다.
    const equipComboIcon = this.add
      .image(GAME_WIDTH - 34, cursorY, this.ensureCombinedPreviewTexture(this.getEquippedSkin(), this.getEquippedFlame()))
      .setOrigin(0.5, 0)
    this.shopTexts.push(equipComboIcon)

    cursorY += Math.max(title.height, equipComboIcon.height) + 18

    // 탭을 하나로 합친 토글 텍스트는 어느 게 현재 탭인지 구분이 잘 안 된다는 후기가 있어서,
    // 버튼 두 개로 나누고 각각 직접 눌러서 바로 그 탭으로 이동하게 한다.
    const tabWidth = 150
    const tabHeight = 26
    const tabCenterY = cursorY + tabHeight / 2
    const tabDefs = [
      { key: 'rocket', label: t('shopTabRocket'), x: GAME_WIDTH / 2 - tabWidth / 2 - 4 },
      { key: 'flame', label: t('shopTabFlame'), x: GAME_WIDTH / 2 + tabWidth / 2 + 4 },
    ]
    tabDefs.forEach((tab) => {
      const active = this.shopTab === tab.key
      const bg = this.add
        .rectangle(tab.x, tabCenterY, tabWidth, tabHeight, active ? 0x3a5fd9 : 0x1a1a2e, active ? 0.95 : 0.5)
        .setStrokeStyle(2, active ? 0x8fe3ff : 0x444466)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.shopTab !== tab.key) {
            this.shopTab = tab.key
            this.renderShop()
          }
        })
      this.shopTexts.push(bg)

      const label = this.add
        .text(tab.x, tabCenterY, tab.label, { ...style, fontSize: '12px', color: active ? '#ffffff' : '#d6d9f5' })
        .setOrigin(0.5)
      this.shopTexts.push(label)
    })
    cursorY += tabHeight + 18

    const rocketBonus = this.getRocketBonusPercent()
    const flameBonus = this.getFlameBonusPercent()
    const bonusRow = this.add
      .text(GAME_WIDTH / 2, cursorY, t('shopBonusRow', { rocket: rocketBonus, flame: flameBonus }), {
        ...style,
        fontSize: '12px',
        color: '#ffe066',
        align: 'center',
      })
      .setOrigin(0.5, 0)
    this.shopTexts.push(bonusRow)
    cursorY += bonusRow.height + 20

    const items = this.shopTab === 'rocket' ? ROCKET_SKINS : FLAME_SKINS
    const equippedId = this.shopTab === 'rocket' ? this.getEquippedSkinId() : this.getEquippedFlameId()
    const isOwned = (id) => (this.shopTab === 'rocket' ? this.isSkinOwned(id) : this.isFlameOwned(id))

    // 아이템마다 상태 줄 수가 다르므로(잠긴 아이템은 조건 2개+구분선까지 3줄), 각 줄을
    // 위쪽 기준으로 그리고 실제 높이만큼 커서를 내리는 동일한 방식으로 세로로 쌓는다.
    let rowY = cursorY
    items.forEach((item, i) => {
      const owned = isOwned(item.id)
      const unlocked = this.isItemUnlocked(item)
      let statusLines
      if (item.id === equippedId) {
        statusLines = [t('shopEquipped')]
      } else if (owned) {
        statusLines = [t('shopOwned')]
      } else if (!unlocked) {
        // 조건 두 개를 각각 줄로 나누고 그 사이에 구분선까지 넣으니 세로로 너무 길어져서
        // (뒤쪽 아이템이 화면 밖으로 밀림), 둘 다 있으면 한 줄로 합쳐서 보여준다.
        statusLines = []
        if (item.unlock.streak !== undefined && item.unlock.nearMiss !== undefined) {
          statusLines.push(
            t('shopLockedBoth', {
              streakReq: item.unlock.streak,
              streakCur: this.dailyStreak,
              nearMissReq: item.unlock.nearMiss,
              nearMissCur: this.nearMissTotal,
            }),
          )
        } else if (item.unlock.streak !== undefined) {
          statusLines.push(t('shopLockedStreak', { req: item.unlock.streak, cur: this.dailyStreak }))
        } else if (item.unlock.nearMiss !== undefined) {
          statusLines.push(t('shopLockedNearMiss', { req: item.unlock.nearMiss, cur: this.nearMissTotal }))
        }
      } else {
        statusLines = [t('shopCost', { cost: item.cost })]
      }
      // 로켓/불꽃마다 아이템 확률 보너스가 얼마나 늘어나는지 보유 여부와 상관없이 항상 보여줘서,
      // 안 산 아이템도 "사면 이만큼 오른다"는 게 바로 보이게 한다.
      if (item.bonusPercent) {
        statusLines.push(
          t(owned ? 'shopBonusOwned' : 'shopBonusLocked', { percent: item.bonusPercent }),
        )
      }

      // 줄 수/폰트가 아이템마다 달라서 높이를 미리 계산할 수 없으니, 먼저 위쪽 기준(origin y=0)으로
      // 텍스트를 그린 다음 실제 렌더된 높이(.height)를 재서 아이콘을 그 세로 중앙에 맞추고,
      // 다음 아이템은 그 높이만큼 커서를 내린 위치에서 시작한다 — 절대 겹칠 수 없다.
      const label = `[${i + 1}] ${t(item.nameKey)}\n${statusLines.join('\n')}`
      const longestLine = Math.max(...statusLines.map((l) => l.length))
      const smallFont = statusLines.length > 1 || longestLine > 13
      const row = this.add
        .text(88, rowY, label, { ...style, fontSize: smallFont ? '11px' : '13px' })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectCurrent(i))
      this.shopTexts.push(row)

      const rowCenterY = rowY + row.height / 2
      const previewKey =
        this.shopTab === 'rocket' ? this.ensureSkinPreviewTexture(item) : this.ensureFlamePreviewTexture(item)
      const icon = this.add
        .image(55, rowCenterY, previewKey)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectCurrent(i))
      this.shopTexts.push(icon)

      rowY += Math.max(row.height, icon.height) + 10
    })
  }

  selectCurrent(index) {
    if (this.shopTab === 'rocket') this.selectSkin(index)
    else this.selectFlame(index)
  }

  selectSkin(index) {
    if (this.state !== 'shop') return
    const skin = ROCKET_SKINS[index]
    if (!skin) return

    const equippedId = this.getEquippedSkinId()
    if (skin.id === equippedId) return

    const owned = this.isSkinOwned(skin.id)
    if (!owned) {
      if (!this.isItemUnlocked(skin)) {
        this.showAchievement(t('shopLockedGeneric'))
        return
      }
      if (this.totalCoins < skin.cost) {
        this.showAchievement(t('shopNotEnoughCoins'))
        return
      }
      this.totalCoins -= skin.cost
      localStorage.setItem(COINS_KEY, String(this.totalCoins))
      this.setSkinOwned(skin.id)
    }

    this.setEquippedSkin(skin.id)
    this.regenerateRocketTextures(true)
    this.renderShop()
  }

  selectFlame(index) {
    if (this.state !== 'shop') return
    const flame = FLAME_SKINS[index]
    if (!flame) return

    const equippedId = this.getEquippedFlameId()
    if (flame.id === equippedId) return

    const owned = this.isFlameOwned(flame.id)
    if (!owned) {
      if (!this.isItemUnlocked(flame)) {
        this.showAchievement(t('shopLockedGeneric'))
        return
      }
      if (this.totalCoins < flame.cost) {
        this.showAchievement(t('shopNotEnoughCoins'))
        return
      }
      this.totalCoins -= flame.cost
      localStorage.setItem(COINS_KEY, String(this.totalCoins))
      this.setFlameOwned(flame.id)
    }

    this.setEquippedFlame(flame.id)
    this.regenerateRocketTextures(true)
    this.renderShop()
  }

  // ---------- 방향 드리프트: 항상 천천히, 랜덤하게 회전 ----------

  updateDrift(delta) {
    this.driftRetargetTimer -= delta
    if (this.driftRetargetTimer <= 0) {
      this.driftRetargetTimer = Phaser.Math.Between(DRIFT_RETARGET_MIN, DRIFT_RETARGET_MAX)
      const offset = Phaser.Math.FloatBetween(-Math.PI * 0.85, Math.PI * 0.85)
      this.driftTargetAngle = this.driftAngle + offset
    }

    const remaining = Phaser.Math.Angle.Wrap(this.driftTargetAngle - this.driftAngle)
    const maxStep = DRIFT_ANGULAR_SPEED * (delta / 1000)
    const step = Phaser.Math.Clamp(remaining, -maxStep, maxStep)
    this.driftAngle = Phaser.Math.Angle.Wrap(this.driftAngle + step)

    this.physics.world.gravity.set(Math.cos(this.driftAngle) * GRAVITY, Math.sin(this.driftAngle) * GRAVITY)
    this.bird.setRotation(this.driftAngle + Math.PI)
  }

  // ---------- 로켓 ----------

  getEquippedSkinId() {
    return localStorage.getItem(EQUIPPED_SKIN_KEY) || 'default'
  }

  setEquippedSkin(id) {
    localStorage.setItem(EQUIPPED_SKIN_KEY, id)
  }

  getOwnedSkins() {
    try {
      const raw = localStorage.getItem(OWNED_SKINS_KEY)
      const arr = raw ? JSON.parse(raw) : []
      return new Set(['default', ...arr])
    } catch (e) {
      return new Set(['default'])
    }
  }

  isSkinOwned(id) {
    return this.getOwnedSkins().has(id)
  }

  setSkinOwned(id) {
    const owned = this.getOwnedSkins()
    owned.add(id)
    localStorage.setItem(OWNED_SKINS_KEY, JSON.stringify([...owned]))
  }

  getEquippedFlameId() {
    return localStorage.getItem(EQUIPPED_FLAME_KEY) || 'default'
  }

  setEquippedFlame(id) {
    localStorage.setItem(EQUIPPED_FLAME_KEY, id)
  }

  getOwnedFlames() {
    try {
      const raw = localStorage.getItem(OWNED_FLAMES_KEY)
      const arr = raw ? JSON.parse(raw) : []
      return new Set(['default', ...arr])
    } catch (e) {
      return new Set(['default'])
    }
  }

  isFlameOwned(id) {
    return this.getOwnedFlames().has(id)
  }

  setFlameOwned(id) {
    const owned = this.getOwnedFlames()
    owned.add(id)
    localStorage.setItem(OWNED_FLAMES_KEY, JSON.stringify([...owned]))
  }

  getEquippedSkin() {
    return ROCKET_SKINS.find((s) => s.id === this.getEquippedSkinId()) || ROCKET_SKINS[0]
  }

  getEquippedFlame() {
    return FLAME_SKINS.find((f) => f.id === this.getEquippedFlameId()) || FLAME_SKINS[0]
  }

  getRocketBonusPercent() {
    const owned = this.getOwnedSkins()
    return ROCKET_SKINS.filter((s) => owned.has(s.id)).reduce((sum, s) => sum + (s.bonusPercent || 0), 0)
  }

  getFlameBonusPercent() {
    const owned = this.getOwnedFlames()
    return FLAME_SKINS.filter((f) => owned.has(f.id)).reduce((sum, f) => sum + (f.bonusPercent || 0), 0)
  }

  getCollectionBonusPercent() {
    // 특정 조합(예: 다이아몬드+다이아몬드)만 우대하면 그 조합만 노리게 되니까,
    // 대신 장착 여부와 상관없이 "지금까지 모은(구매한) 스킨"에 보너스를 걸어서 어떤 스킨이든
    // 사 모으는 것 자체가 보상이 되게 한다. 다만 전부 똑같이 4%씩이면 체감이 안 된다는 후기가
    // 있어서, 싼 스킨은 조금(2%) 비싼/한정 스킨은 확실히 크게(6%) 차등을 뒀다.
    return this.getRocketBonusPercent() + this.getFlameBonusPercent()
  }

  // 한정 아이템(네온사이버/다크 플레임/다이아몬드/다이아몬드 플레임)은 코인만으로는 못 사고,
  // 연속 접속일 또는 아슬아슬 누적 횟수 중 하나를 만족해야 코인으로 살 수 있게 열린다.
  isItemUnlocked(item) {
    if (!item.unlock) return true
    const streakOk = item.unlock.streak === undefined || this.dailyStreak >= item.unlock.streak
    const nearMissOk = item.unlock.nearMiss === undefined || this.nearMissTotal >= item.unlock.nearMiss
    return streakOk && nearMissOk
  }

  getPowerupInterval() {
    const ratio = 1 - this.getCollectionBonusPercent() / 100
    return Phaser.Math.Between(POWERUP_MIN_INTERVAL * ratio, POWERUP_MAX_INTERVAL * ratio)
  }

  regenerateRocketTextures(refreshSprite) {
    // create() 안에서는 이 함수가 createRocket()보다 먼저 실행되는데, 씬을 재시작한 경우
    // this.bird가 "이전 판에서 이미 destroy된 스프라이트"를 그대로 참조하고 있어서
    // (Phaser는 scene.restart() 시 이 JS 인스턴스 프로퍼티를 자동으로 안 지워준다)
    // 그 상태에서 setTexture를 부르면 크래시가 났다. 상점에서 스킨을 바꿀 때(진짜로
    // 살아있는 로켓이 있을 때)만 명시적으로 refreshSprite=true를 넘기도록 한다.
    const skin = this.getEquippedSkin()
    const flame = this.getEquippedFlame()
    ;['rocket', 'rocket-thrust'].forEach((key) => {
      if (this.textures.exists(key)) this.textures.remove(key)
    })
    this.drawRocketTexture('rocket', 10, skin, flame)
    this.drawRocketTexture('rocket-thrust', 22, skin, flame)
    if (refreshSprite && this.bird) {
      const wasThrust = this.bird.texture.key === 'rocket-thrust'
      this.bird.setTexture(wasThrust ? 'rocket-thrust' : 'rocket')
    }
  }

  // resScale: 실제 게임 스프라이트(작은 56x24 텍스처)를 그대로 표지 로고처럼 몇 배씩 확대해서
  // 쓰면 화질이 깨진다. 좌표를 전부 resScale배로 키운 캔버스에 그려서, 확대 표시할 곳에서는
  // 더 높은 해상도 원본을 받아쓸 수 있게 한다(화면에 보이는 크기는 .setScale()로 다시 맞춘다).
  drawRocketTexture(key, flameLen, skin, flameSkin, resScale = 1) {
    const flame = flameSkin || FLAME_SKINS[0]
    const s = resScale
    const w = 56 * s
    const h = 24 * s
    const g = this.make.graphics({ x: 0, y: 0, add: false })

    if (flame.id === 'rainbow') {
      // 텍스처 하나로는 애니메이션을 못 주니, 정지 상태에서도 "무지개"라는 걸 알 수 있게
      // 불꽃을 색 띠 여러 개로 쪼개서 그린다. 실제 장착 중엔 update()에서 주기적으로
      // 이 텍스처 자체를 다시 그려서 색이 흘러가는 것처럼 보이게 한다.
      // 가격이 제일 비싼 만큼 확실히 화려하게: 기본 불꽃보다 더 길고, 채도도 최대로.
      const bigFlameLen = flameLen * 1.35
      const bands = 7
      for (let i = 0; i < bands; i++) {
        const hue = ((this.holoHue || 0) + (i / bands) * 360) % 360
        const rgb = Phaser.Display.Color.HSVToRGB(hue / 360, 1, 1)
        const t0 = i / bands
        const t1 = (i + 1) / bands
        g.fillStyle(rgb.color, 1)
        g.fillTriangle(
          (16 - bigFlameLen * t0) * s,
          (4 + (20 - 4) * t0 * 0.5) * s,
          (16 - bigFlameLen * t0) * s,
          (20 - (20 - 4) * t0 * 0.5) * s,
          (16 - bigFlameLen * t1) * s,
          12 * s,
        )
      }
      // 안쪽 흰 코어를 겹쳐서 "화끈하게 타오르는" 느낌을 더한다.
      g.fillStyle(0xffffff, 0.85)
      g.fillTriangle(16 * s, 10 * s, 16 * s, 14 * s, (16 - bigFlameLen * 0.35) * s, 12 * s)
    } else {
      g.fillStyle(flame.outer, 1)
      g.fillTriangle(16 * s, 5 * s, 16 * s, 19 * s, (16 - flameLen) * s, 12 * s)
      g.fillStyle(flame.inner, 1)
      g.fillTriangle(16 * s, 9 * s, 16 * s, 15 * s, (16 - flameLen * 0.55) * s, 12 * s)

      if (flame.id === 'diamond') {
        // 다이아몬드 불꽃: 무지개색 대신 하얀 코어가 맥동하며 반짝이는 느낌으로 차별화한다.
        const pulse = 0.5 + 0.5 * Math.sin(((this.holoHue || 0) / 360) * Math.PI * 2)
        g.fillStyle(0xffffff, 0.5 + pulse * 0.4)
        g.fillTriangle(16 * s, 10 * s, 16 * s, 14 * s, (16 - flameLen * 0.4) * s, 12 * s)
      }
    }

    g.fillStyle(skin.body, 1)
    g.fillEllipse(30 * s, 12 * s, 30 * s, 18 * s)

    if (skin.animated) {
      // 홀로그램 스킨: 몸통 위에 무지개 색 사선 띠를 겹쳐서 "빤짝거리는" 느낌을 낸다.
      // 실제 장착 중엔 update()에서 이 텍스처를 주기적으로 다시 그려서 띠가 흘러가게 한다.
      // 가장 비싼 스킨인 만큼 은은한 틴트가 아니라 확실히 눈에 띄게 진하고 촘촘하게.
      const stripeCount = 9
      for (let i = 0; i < stripeCount; i++) {
        const hue = ((this.holoHue || 0) + (i / stripeCount) * 360) % 360
        const rgb = Phaser.Display.Color.HSVToRGB(hue / 360, 0.75, 1)
        g.fillStyle(rgb.color, 0.7)
        const sx = (15 + (i / stripeCount) * 30) * s
        g.fillTriangle(sx, 3 * s, sx + 3 * s, 3 * s, sx - 3 * s, 21 * s)
      }
      // 몸통 위에 반짝이는 하이라이트 한 줄을 더 얹어 "정말 반짝인다"는 인상을 강조.
      const shineX = (16 + ((((this.holoHue || 0) / 360) * 40) % 40)) * s
      g.fillStyle(0xffffff, 0.55)
      g.fillTriangle(shineX, 4 * s, shineX + 2 * s, 4 * s, shineX - 2 * s, 20 * s)
    }

    g.fillStyle(skin.nose, 1)
    g.fillTriangle(42 * s, 4 * s, 42 * s, 20 * s, 54 * s, 12 * s)

    g.fillStyle(skin.fin, 1)
    g.fillTriangle(18 * s, 2 * s, 28 * s, 10 * s, 12 * s, 10 * s)
    g.fillTriangle(18 * s, 22 * s, 28 * s, 14 * s, 12 * s, 14 * s)

    g.fillStyle(0x4fc3f7, 1)
    g.fillCircle(28 * s, 12 * s, 5 * s)
    g.lineStyle(1 * s, 0x263238, 1)
    g.strokeCircle(28 * s, 12 * s, 5 * s)

    g.generateTexture(key, w, h)
    g.destroy()
  }

  ensureSparkTexture() {
    if (this.textures.exists('spark-particle')) return
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(0xffffff, 1)
    g.fillCircle(3, 3, 3)
    g.generateTexture('spark-particle', 6, 6)
    g.destroy()
  }

  // ---------- 홀로그램 로켓 / 레인보우 불꽃: 실시간 색 순환 ----------

  updateEquippedSkinAnim(time, delta) {
    if (this.state === 'gameover') return
    const skin = this.getEquippedSkin()
    const flame = this.getEquippedFlame()
    const needsColorCycle = skin.animated || flame.animated
    if (!needsColorCycle) return

    this.animRegenTimer -= delta
    if (this.animRegenTimer <= 0) {
      this.animRegenTimer = 70
      this.holoHue = (this.holoHue + 22) % 360
      this.regenerateRocketTextures(true)
    }

    if (skin.animated) {
      this.sparkleTimer -= delta
      if (this.sparkleTimer <= 0) {
        this.sparkleTimer = 90
        for (let i = 0; i < 2; i++) {
          const hue = ((this.holoHue + i * 120) % 360) / 360
          this.spawnSparkle(this.bird.x, this.bird.y, Phaser.Display.Color.HSVToRGB(hue, 0.4, 1).color)
        }
      }
    }

    if (flame.animated && this.state === 'playing') {
      this.flameTrailTimer -= delta
      if (this.flameTrailTimer <= 0) {
        this.flameTrailTimer = 60
        this.spawnThrustPuff(flame, 1)
      }
    }
  }

  spawnSparkle(x, y, color) {
    const spark = this.add.image(x + Phaser.Math.FloatBetween(-10, 10), y + Phaser.Math.FloatBetween(-8, 8), 'spark-particle')
    spark.setTint(color)
    spark.setScale(Phaser.Math.FloatBetween(0.8, 1.6))
    spark.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => spark.destroy(),
    })
  }

  spawnThrustPuff(flame, count) {
    // 제일 비싼 애니메이션 불꽃(레인보우/다이아몬드)은 탭할 때마다 확실히 화려하게 터지도록 입자 수/크기를 키운다.
    const isRainbow = flame.id === 'rainbow'
    const isDiamond = flame.id === 'diamond'
    const isFlashy = isRainbow || isDiamond
    const n = count !== undefined ? count : isFlashy ? 6 : 3
    const angle = this.driftAngle // 불꽃은 진행 반대 방향(뒤쪽)으로 뿜어나온다
    const backX = this.bird.x - Math.cos(angle) * 14
    const backY = this.bird.y - Math.sin(angle) * 14
    for (let i = 0; i < n; i++) {
      const puff = this.add.image(
        backX + Phaser.Math.FloatBetween(-4, 4),
        backY + Phaser.Math.FloatBetween(-4, 4),
        'spark-particle',
      )
      const color = isRainbow
        ? Phaser.Display.Color.HSVToRGB(Math.random(), 1, 1).color
        : isDiamond
          ? Phaser.Display.Color.HSVToRGB(Phaser.Math.FloatBetween(0.5, 0.58), 0.25, 1).color
          : flame.outer
      puff.setTint(color)
      puff.setScale(Phaser.Math.FloatBetween(1, isFlashy ? 2.8 : 2))
      puff.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({
        targets: puff,
        x: puff.x - Math.cos(angle) * (isFlashy ? 24 : 16),
        y: puff.y - Math.sin(angle) * (isFlashy ? 24 : 16),
        alpha: 0,
        scale: 0,
        duration: isFlashy ? 340 : 260,
        ease: 'Cubic.easeOut',
        onComplete: () => puff.destroy(),
      })
    }

    if (isFlashy && count === undefined) {
      // 탭 순간에만: 뒤쪽에 밝은 흰 섬광을 한 번 더 터뜨려서 화려한 펀치감을 준다.
      const flash = this.add.image(backX, backY, 'spark-particle')
      flash.setTint(0xffffff)
      flash.setScale(2.4)
      flash.setBlendMode(Phaser.BlendModes.ADD)
      this.tweens.add({
        targets: flash,
        scale: 4.5,
        alpha: 0,
        duration: 180,
        ease: 'Cubic.easeOut',
        onComplete: () => flash.destroy(),
      })
    }
  }

  createRocket() {
    this.bird = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'rocket')
    // Arcade 물리 바디는 스프라이트가 회전해도 같이 회전하지 않으므로,
    // 방향이 자유롭게 도는 지금 구조에선 원형 히트박스가 항상 공정하다.
    this.bird.body.setCircle(ROCKET_HIT_RADIUS, 17, 1)
    this.bird.body.allowGravity = false

    this.idleTween = this.tweens.add({
      targets: this.bird,
      y: this.bird.y - 12,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  // ---------- 장애물 비주얼: 먹구름 / 운석 (원형) ----------

  drawCloudVisual(size) {
    const g = this.add.graphics()
    const R = size / 2
    const puffCount = Math.max(5, Math.round(size / 14))

    const shadowColor = Phaser.Display.Color.ValueToColor(0x2b2c46)
    const baseColor = Phaser.Display.Color.ValueToColor(0x4c4e70)
    const highlightColor = Phaser.Display.Color.ValueToColor(0x9092b8)

    // 바깥 헤이즈: 경계를 부드럽게 보이도록
    g.fillStyle(0x272845, 0.22)
    g.fillCircle(0, 0, R * 1.15)

    // 미드톤 + 위/아래 명암
    for (let i = 0; i < puffCount; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = Phaser.Math.FloatBetween(0, R * 0.55)
      const px = Math.cos(angle) * dist
      const py = Math.sin(angle) * dist
      const r = R * Phaser.Math.FloatBetween(0.45, 0.62)

      const yNorm = Phaser.Math.Clamp(py / R, -1, 1)
      let mix
      if (yNorm < 0) mix = Phaser.Display.Color.Interpolate.ColorWithColor(baseColor, highlightColor, 100, -yNorm * 100)
      else mix = Phaser.Display.Color.Interpolate.ColorWithColor(baseColor, shadowColor, 100, yNorm * 100)

      g.fillStyle(Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b), 1)
      g.fillCircle(px, py, r)
    }

    // WebGL 렌더러에서만 적용되는 블러(Canvas 폴백 시엔 그냥 무시되고 선명하게 보임)
    g.postFX.addBlur(1, 2, 2, 1)

    return g
  }

  drawMeteorVisual(size) {
    // 조각을 완전 랜덤 위치에 뿌리면 방향에 따라 실제 충돌 경계(R)까지 안 닿는 빈틈이 생겨서
    // "그림엔 안 닿았는데 죽는" 억울한 판정이 나온다. 고리 형태로 고르게 배치해서
    // 최소 거리+반지름 조합이 항상 R에 도달하도록 보장한다.
    const g = this.add.graphics()
    const R = size / 2
    const chunkCount = Math.max(5, Math.round(size / 13))
    const rockColors = [0x5a5044, 0x625848, 0x554c3e, 0x6b6152]

    for (let i = 0; i < chunkCount; i++) {
      const angle = (i / chunkCount) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.25, 0.25)
      const dist = R * Phaser.Math.FloatBetween(0.25, 0.38)
      const cx = Math.cos(angle) * dist
      const cy = Math.sin(angle) * dist
      const r = R * Phaser.Math.FloatBetween(0.75, 0.88)
      const segs = 8
      const points = []
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2
        const jitter = Phaser.Math.FloatBetween(0.75, 1.08)
        points.push(new Phaser.Geom.Point(cx + Math.cos(a) * r * jitter, cy + Math.sin(a) * r * jitter))
      }

      g.fillStyle(Phaser.Utils.Array.GetRandom(rockColors), 1)
      g.fillPoints(points, true)

      g.fillStyle(0x8a7c62, 0.4)
      g.fillCircle(cx - r * 0.35, cy - r * 0.35, r * 0.45)

      g.fillStyle(0x231e17, 0.45)
      g.fillCircle(cx + r * 0.4, cy + r * 0.4, r * 0.4)

      g.lineStyle(1.5, 0x231e17, 0.55)
      g.strokePoints(points, true, true)
    }

    const craterCount = Math.max(1, Math.round(size / 40))
    for (let i = 0; i < craterCount; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = Phaser.Math.FloatBetween(0, R * 0.5)
      const px = Math.cos(angle) * dist
      const py = Math.sin(angle) * dist
      const cr = R * Phaser.Math.FloatBetween(0.12, 0.2)

      g.fillStyle(0x231e17, 0.7)
      g.fillCircle(px, py, cr)
      g.fillStyle(0x8a7c62, 0.35)
      g.fillCircle(px - cr * 0.3, py - cr * 0.3, cr * 0.4)
    }

    if (Phaser.Math.Between(0, 1) === 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = Phaser.Math.FloatBetween(0, R * 0.5)
      g.fillStyle(0xd8e8ff, 0.85)
      g.fillCircle(Math.cos(angle) * dist, Math.sin(angle) * dist, 1.2)
    }

    return g
  }

  drawDodgeballVisual(size) {
    // "도지볼" 발음이 도지코인 밈(시바견)과 비슷해서 만든 장난스러운 이스터에그.
    // 특정 사진이나 도지코인 로고를 베끼지 않고, 시바견의 일반적 특징(황갈색 털,
    // 뾰족한 귀, 흰 볼)만 살려 완전히 새로 그린 오리지널 캐릭터라 저작권 문제 없음.
    // 귀 끝까지 포함해서 전부 반지름 R 안쪽에 들어오도록 그려 충돌판정과 그림이 어긋나지 않게 한다.
    const g = this.add.graphics()
    const R = size / 2

    // 얼굴 - fillGradientStyle은 WebGL 전용이라 Canvas 폴백에서 색이 깨지므로 쓰지 않고,
    // 밝은/어두운 원을 겹쳐서(라이트/섀도우 블롭) 공처럼 입체적으로 보이게 한다.
    g.fillStyle(0xf0c060, 1)
    g.fillCircle(0, 0, R)

    // 그림자 쪽(오른쪽 아래)
    g.fillStyle(0xb87f30, 0.4)
    g.fillCircle(R * 0.16, R * 0.22, R * 0.68)

    // 밝은 쪽(왼쪽 위) + 하이라이트 광택
    g.fillStyle(0xffe6ad, 0.4)
    g.fillCircle(-R * 0.24, -R * 0.28, R * 0.5)
    g.fillStyle(0xffffff, 0.35)
    g.fillEllipse(-R * 0.3, -R * 0.38, R * 0.4, R * 0.24)

    // 귀 (전부 R 이내)
    g.fillStyle(0xe0a840, 1)
    g.fillTriangle(-R * 0.55, -R * 0.35, -R * 0.15, -R * 0.35, -R * 0.35, -R * 0.92)
    g.fillTriangle(R * 0.55, -R * 0.35, R * 0.15, -R * 0.35, R * 0.35, -R * 0.92)

    // 흰 볼/입 주변 무늬
    g.fillStyle(0xfff5e0, 1)
    g.fillEllipse(0, R * 0.28, R * 1.0, R * 0.68)

    // 눈
    g.fillStyle(0x2b1d0e, 1)
    g.fillCircle(-R * 0.32, -R * 0.05, R * 0.11)
    g.fillCircle(R * 0.32, -R * 0.05, R * 0.11)

    // 코
    g.fillCircle(0, R * 0.2, R * 0.13)

    // 미소
    g.lineStyle(Math.max(1.5, R * 0.06), 0x2b1d0e, 0.8)
    g.beginPath()
    g.moveTo(0, R * 0.3)
    g.lineTo(-R * 0.2, R * 0.42)
    g.moveTo(0, R * 0.3)
    g.lineTo(R * 0.2, R * 0.42)
    g.strokePath()

    return g
  }

  drawBlackHoleVisual(size) {
    // 강착원반(accretion disk) 링의 바깥쪽 끝이 대략 R(히트박스 반지름)에 닿도록 맞춰서,
    // 눈에 보이는 위험 구역과 실제 충돌 판정이 크게 어긋나지 않게 한다.
    const g = this.add.graphics()
    const R = size / 2

    // 겹겹이 쌓은 반투명 원으로 안쪽은 진하고 바깥쪽은 옅어지는 발광 헤이즈를 만들어
    // 평평한 원판이 아니라 부피감 있는 구름처럼 보이게 한다.
    const glowLayers = [
      { r: 1.15, color: 0x2a1740, alpha: 0.12 },
      { r: 0.95, color: 0x4a2a6a, alpha: 0.16 },
      { r: 0.75, color: 0x6a3a8a, alpha: 0.2 },
    ]
    glowLayers.forEach((layer) => {
      g.fillStyle(layer.color, layer.alpha)
      g.fillCircle(0, 0, R * layer.r)
    })

    // 강착원반 링 — 사건의 지평선(아래) 바로 바깥부터 시작해야 가려지지 않고 다 보인다.
    const ringColors = [0xffb347, 0xff6fae, 0x8a6fff]
    ringColors.forEach((color, i) => {
      const ringR = R * (0.65 + i * 0.18)
      g.lineStyle(Math.max(1.5, R * 0.08), color, 0.75 - i * 0.15)
      g.strokeEllipse(0, 0, ringR * 2, ringR * 0.55)
    })

    // 사건의 지평선: fillGradientStyle은 WebGL 전용이라 쓰지 않고, 완전한 검정 원 위에
    // 한쪽으로 치우친 옅은 보라색 블롭을 겹쳐서 평면 원판이 아니라 구체처럼 보이게 한다.
    g.fillStyle(0x000000, 1)
    g.fillCircle(0, 0, R * 0.6)
    g.fillStyle(0x3d2456, 0.55)
    g.fillCircle(-R * 0.15, -R * 0.15, R * 0.32)

    // 사건의 지평선 바로 바깥의 밝은 테두리(광자 고리)
    g.lineStyle(Math.max(1, R * 0.05), 0xf5e6ff, 0.5)
    g.strokeCircle(0, 0, R * 0.6)

    return g
  }

  drawGalaxyVisual(size) {
    // 은하 진입(100점) 티어용 장애물. 부드러운 헤이즈 위에 서로 다른 각도로 겹친 타원 3개로
    // 나선팔을 흉내내고, 밝은 중심핵을 넣는다. 팔의 긴 반지름(0.85R)이 R을 넘지 않게 해서
    // 회전해도 히트박스 바깥으로 삐져나오지 않는다.
    const g = this.add.graphics()
    const R = size / 2

    g.fillStyle(0x241a4a, 0.25)
    g.fillCircle(0, 0, R * 1.1)

    const armColors = [0x8fa6ff, 0xd88fff, 0x8fe3ff]
    armColors.forEach((color, i) => {
      g.save()
      g.rotateCanvas((i / armColors.length) * Math.PI * 2)
      const armR = R * 0.85
      g.lineStyle(Math.max(1.5, R * 0.09), color, 0.55)
      g.strokeEllipse(0, 0, armR * 2, armR * 0.42)
      g.restore()
    })

    g.fillStyle(0xfff6e0, 1)
    g.fillCircle(0, 0, R * 0.22)
    g.fillStyle(0xffffff, 0.7)
    g.fillCircle(0, 0, R * 0.11)

    return g
  }

  // ---------- 사운드 (합성, 외부 파일 없음) ----------

  ensureAudio() {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext
      this.audioCtx = new AC()
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume()
    return this.audioCtx
  }

  playEngineSound(flame) {
    const skin = flame || FLAME_SKINS[0]
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = skin.oscType
    osc.frequency.setValueAtTime(skin.freqStart, now)
    osc.frequency.exponentialRampToValueAtTime(skin.freqEnd, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(skin.animated ? 0.24 : 0.18, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.16)

    if (skin.animated) {
      // 레인보우 플레임: 가격이 제일 비싼 만큼 확실히 화려하게 — 반짝이는 배음 + 펀치감 있는 노이즈 트랜지언트.
      const shimmer = ctx.createOscillator()
      const shimmerGain = ctx.createGain()
      shimmer.type = 'sine'
      shimmer.frequency.setValueAtTime(skin.freqStart * 2.5, now)
      shimmer.frequency.exponentialRampToValueAtTime(skin.freqStart * 5, now + 0.2)
      shimmerGain.gain.setValueAtTime(0.0001, now)
      shimmerGain.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
      shimmer.connect(shimmerGain)
      shimmerGain.connect(ctx.destination)
      shimmer.start(now)
      shimmer.stop(now + 0.24)

      const burstDuration = 0.08
      const bufferSize = Math.floor(ctx.sampleRate * burstDuration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'highpass'
      noiseFilter.frequency.setValueAtTime(2500, now)
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.22, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + burstDuration)
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noise.start(now)
      noise.stop(now + burstDuration)
    }
  }

  playExplosionSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const duration = 0.5

    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1800, now)
    filter.frequency.exponentialRampToValueAtTime(120, now + duration)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.5, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    noise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(now)
    noise.stop(now + duration)

    const rumble = ctx.createOscillator()
    const rumbleGain = ctx.createGain()
    rumble.type = 'sine'
    rumble.frequency.setValueAtTime(90, now)
    rumble.frequency.exponentialRampToValueAtTime(30, now + duration)
    rumbleGain.gain.setValueAtTime(0.35, now)
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    rumble.connect(rumbleGain)
    rumbleGain.connect(ctx.destination)
    rumble.start(now)
    rumble.stop(now + duration)
  }

  playCheerSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const t = now + i * 0.09
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.22)
    })
  }

  playWhooshSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const duration = 0.35
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(300, now)
    osc.frequency.exponentialRampToValueAtTime(900, now + duration * 0.55)
    osc.frequency.exponentialRampToValueAtTime(200, now + duration)
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(600, now)
    filter.Q.setValueAtTime(1.2, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  playNearMissSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, now)
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.12)
  }

  playPowerupSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const notes = [660, 880, 1100]
    notes.forEach((freq, i) => {
      const t = now + i * 0.06
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.16)
    })
  }

  playShieldBreakSound() {
    const ctx = this.ensureAudio()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(500, now)
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.25)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  // ---------- UI ----------

  createUI() {
    const textStyle = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: TEXT_RESOLUTION,
    }

    this.scoreText = this.add.text(GAME_WIDTH / 2, 40, '0', textStyle).setOrigin(0.5)

    // 처음 들어왔을 때 게임 이름을 명확하게 보여준다.
    // 표지 로고: 로켓 그림 + 알록달록한 이름 + 작은 별 장식 (포스터 느낌 참고).
    // titleGroup에 모아두고, 상점/매뉴얼로 넘어갈 때 한 번에 숨기고 보여줄 수 있게 한다.
    this.titleGroup = []

    // 'rocket' 텍스처는 애니메이션 스킨 장착 중엔 매 프레임 다시 그려지는 살아있는 텍스처라
    // 여기 재사용하면 깨질 수 있다. 대신 절대 안 지워지는 정적 미리보기 텍스처를 쓴다.
    // 완전히 정지된 그림이면 밋밋해서, 짧은 불꽃/긴 불꽃 두 텍스처를 번갈아 보여줘서
    // 실제 로켓 분사처럼 살짝 깜빡이는 느낌을 준다.
    this.titleFlameOn = false
    // 표지 로고는 실제 인게임 스프라이트보다 훨씬 크게 확대해서 보여주는데, 그 작은 텍스처를
    // 그대로 늘리면 화질이 깨진다. TITLE_ICON_RES_SCALE배 해상도로 따로 그려서 확대해도
    // 선명하게 나오게 하고, 화면에 보이는 실제 크기는 setScale로 다시 맞춘다.
    this.titleFlameKeys = {
      short: this.ensureCombinedPreviewTexture(this.getEquippedSkin(), this.getEquippedFlame(), 12, TITLE_ICON_RES_SCALE),
      long: this.ensureCombinedPreviewTexture(this.getEquippedSkin(), this.getEquippedFlame(), 20, TITLE_ICON_RES_SCALE),
    }
    this.titleRocketIcon = this.add
      .image(GAME_WIDTH / 2, 68, this.titleFlameKeys.short)
      .setOrigin(0.5)
      .setScale(2.2 / TITLE_ICON_RES_SCALE)
      .setRotation(-Math.PI / 2 + 0.3)
    this.titleGroup.push(this.titleRocketIcon)
    this.titleFlameTimer = this.time.addEvent({
      delay: 350,
      loop: true,
      callback: () => {
        if (this.state !== 'ready') return
        this.titleFlameOn = !this.titleFlameOn
        this.titleRocketIcon.setTexture(this.titleFlameOn ? this.titleFlameKeys.long : this.titleFlameKeys.short)
      },
    })

    const starDefs = [
      { x: GAME_WIDTH / 2 - 70, y: 48, size: '14px' },
      { x: GAME_WIDTH / 2 + 74, y: 52, size: '11px' },
      { x: GAME_WIDTH / 2 + 60, y: 88, size: '10px' },
      { x: GAME_WIDTH / 2 - 78, y: 84, size: '12px' },
    ]
    starDefs.forEach((s) => {
      const star = this.add.text(s.x, s.y, '✨', { fontSize: s.size }).setOrigin(0.5)
      this.titleGroup.push(star)
    })

    const closeWord = this.add
      .text(0, 120, 'CLOSE', { ...textStyle, fontSize: '27px', color: '#ff6b4a' })
      .setOrigin(0, 0.5)
    const rocketWord = this.add
      .text(0, 120, ' ROCKET', { ...textStyle, fontSize: '27px', color: '#4fc3f7' })
      .setOrigin(0, 0.5)
    const titleWordsWidth = closeWord.width + rocketWord.width
    closeWord.x = GAME_WIDTH / 2 - titleWordsWidth / 2
    rocketWord.x = closeWord.x + closeWord.width
    this.titleGroup.push(closeWord, rocketWord)

    this.subtitleText = this.add
      .text(GAME_WIDTH / 2, 150, t('readySubtitle'), { ...textStyle, fontSize: '15px', color: '#ffe066' })
      .setOrigin(0.5)
    this.titleGroup.push(this.subtitleText)

    this.messageText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 35, t('readyCta'), {
        ...textStyle,
        fontSize: '22px',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 60 },
      })
      .setOrigin(0.5)

    this.subMessageText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, t('readyBestScore', { best: this.bestScore }), {
        ...textStyle,
        fontSize: '18px',
        align: 'center',
      })
      .setOrigin(0.5)

    this.streakText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 30,
        this.dailyStreak >= 2 ? t('readyStreakActive', { days: this.dailyStreak }) : t('readyStreakNone'),
        { ...textStyle, fontSize: '14px' },
      )
      .setOrigin(0.5)

    // 상점/매뉴얼 버튼을 대기화면 하단 좌우 모서리에 확실한 버튼 모양으로 배치한다.
    const cornerY = GAME_HEIGHT - 42
    const cornerButtonW = 128
    const cornerButtonH = 44

    this.shopButtonBg = this.add
      .rectangle(GAME_WIDTH - 72, cornerY, cornerButtonW, cornerButtonH, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0x4fc3f7)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openShop())
    this.shopButtonBg.isUiButton = true
    this.shopButtonText = this.add
      .text(GAME_WIDTH - 72, cornerY, t('shopButtonLabel', { coins: this.totalCoins }), { ...textStyle, fontSize: '13px', align: 'center' })
      .setOrigin(0.5)

    this.manualButtonBg = this.add
      .rectangle(72, cornerY, cornerButtonW, cornerButtonH, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0xffe066)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.manualIsFirstRun = false
        this.showManual()
      })
    this.manualButtonBg.isUiButton = true
    this.manualButtonText = this.add
      .text(72, cornerY, t('manualButtonLabel'), { ...textStyle, fontSize: '13px', align: 'center' })
      .setOrigin(0.5)

    // 로그인 없이도 경쟁심리를 자극할 수 있게, 닉네임만 정하면 전체 랭킹에 참여할 수 있게 한다.
    // 표지 로고와 시작 안내 문구 사이 빈 공간에 둔다.
    this.leaderboardButtonBg = this.add
      .rectangle(GAME_WIDTH / 2, 205, 150, 32, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0xffd700)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openLeaderboard())
    this.leaderboardButtonBg.isUiButton = true
    this.leaderboardButtonText = this.add
      .text(GAME_WIDTH / 2, 205, t('leaderboardButtonLabel'), { ...textStyle, fontSize: '14px' })
      .setOrigin(0.5)

    // 언어 토글 버튼 (대기화면 전용). 다른 UI와 안 겹치는 오른쪽 위 빈 공간에 둔다.
    // 클릭하면 언어를 바꾸고 scene.restart()로 화면 전체를 새 언어로 다시 그린다 —
    // 정적으로 한 번만 생성되는 텍스트들(표지 제목, 모서리 버튼 등)까지 전부 갱신하는
    // 가장 확실한 방법이며, 이 코드베이스가 다른 전체 갱신 상황에서도 이미 쓰는 방식이다.
    // restartYesText/restartNoText와 같은 이유로 scene.restart()를 다음 틱으로 미룬다 —
    // 같은 클릭 이벤트 안에서 바로 재시작하면, 새로 만들어진 씬의 전역 pointerdown
    // 핸들러가 이번 이벤트 처리 중에 한 번 더 불려서 의도치 않은 동작으로 이어질 수 있다.
    this.langButtonBg = this.add
      .rectangle(GAME_WIDTH - 40, 20, 72, 28, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0x8fe3ff)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.state !== 'ready') return
        toggleLang()
        this.time.delayedCall(0, () => this.scene.restart())
      })
    this.langButtonBg.isUiButton = true
    this.langButtonText = this.add
      .text(GAME_WIDTH - 40, 20, t('langToggleLabel'), { ...textStyle, fontSize: '12px' })
      .setOrigin(0.5)

    // 게임오버 화면 전용 "이어하기" 버튼. messageText 안에 힌트 문구로만 있으면 키보드가 없는
    // 모바일에서는 누를 방법이 없어서, 탭 가능한 별도 텍스트로 분리해둔다.
    this.continueButtonText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, t('continueButtonLabel'), {
        ...textStyle,
        fontSize: '16px',
        color: '#ffe066',
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.tryContinue())
    this.continueButtonText.isUiButton = true

    // 탭하는 게임 특성상 죽자마자 다음 반사적인 탭이 그대로 재시작으로 이어져서 점수를
    // 확인할 새도 없이 넘어간다는 후기가 있었다. 화면 아무데나 탭하면 바로 재시작되던 것을
    // 없애고, "다시 하시겠습니까?" 확인 버튼(예/아니오)을 눌러야만 실제로 재시작되게 한다.
    // "예" = 재시작과 동시에 바로 플레이 시작. "아니오" = 처음 화면(대기화면)으로만 돌아감
    // (바로 재시작하고 싶지 않을 수도 있으니, 최고점수/상점을 볼 수 있는 화면으로 보내준다).
    this.restartYesText = this.add
      .text(GAME_WIDTH / 2 - 45, GAME_HEIGHT / 2 + 130, t('restartYes'), { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      // 이 클릭 안에서 바로 scene.restart()를 부르면, 같은 클릭 이벤트가 아직 다 처리되는
      // 중에 새로 만들어진 대기화면의 전역 pointerdown 핸들러(handleInput)가 곧바로 한 번
      // 더 불려서(currentlyOver가 이미 사라진 이 버튼을 못 잡아냄) "아니오"인데도 즉시
      // startGame()이 실행돼버렸다. 다음 틱으로 미뤄서 이번 클릭 처리가 완전히 끝난 뒤에
      // 재시작하게 하면 이 잔여 이벤트 문제가 사라진다.
      .on('pointerdown', () => this.time.delayedCall(0, () => this.scene.restart({ autoStart: true })))
    this.restartYesText.isUiButton = true

    this.restartNoText = this.add
      .text(GAME_WIDTH / 2 + 45, GAME_HEIGHT / 2 + 130, t('restartNo'), { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.time.delayedCall(0, () => this.scene.restart()))
    this.restartNoText.isUiButton = true

    // 실드/폭탄 인벤토리 표시 (플레이 중에만 보임). 폭탄은 탭하면 바로 씀. 한 손으로 폰을 쥐고
    // 엄지로 조작할 때 화면 위쪽은 손이 잘 안 닿아서, 대기화면 버튼들과 같은 하단 모서리에 둔다.
    this.shieldInventoryText = this.add
      .text(72, cornerY, `🛡️ ${this.shieldCount}`, { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false)

    this.bombInventoryText = this.add
      .text(GAME_WIDTH - 72, cornerY, `💣 ${this.bombCount}`, { ...textStyle, fontSize: '18px', color: '#ffcc66' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.useBomb())
    this.bombInventoryText.isUiButton = true

    // 표지(대기화면) 다음, 실제 게임 시작 전에 한 번 보여주는 매뉴얼 화면. 처음 방문한
    // 사람만 자동으로 보고(localStorage 플래그), 그 다음부턴 대기화면에서 바로 시작한다.
    this.manualTitleText = this.add
      .text(GAME_WIDTH / 2, 70, t('manualTitle'), { ...textStyle, fontSize: '26px' })
      .setOrigin(0.5)
      .setVisible(false)

    this.manualBodyText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, t('manualText'), {
        ...textStyle,
        fontSize: '14px',
        align: 'left',
        lineSpacing: 6,
        wordWrap: { width: GAME_WIDTH - 40 },
      })
      .setOrigin(0.5)
      .setVisible(false)

    this.manualContinueText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 50, t('manualContinueCta'), {
        ...textStyle,
        fontSize: '16px',
        color: '#ffe066',
      })
      .setOrigin(0.5)
      .setVisible(false)
  }

  showManual() {
    this.state = 'manual'
    this.bird.setVisible(false)
    this.scoreText.setVisible(false)
    this.messageText.setVisible(false)
    this.subMessageText.setVisible(false)
    this.streakText.setVisible(false)
    this.titleGroup.forEach((o) => o.setVisible(false))
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)
    this.manualButtonBg.setVisible(false)
    this.manualButtonText.setVisible(false)
    this.leaderboardButtonBg.setVisible(false)
    this.leaderboardButtonText.setVisible(false)
    this.langButtonBg.setVisible(false)
    this.langButtonText.setVisible(false)
    this.manualTitleText.setVisible(true)
    this.manualBodyText.setVisible(true)
    this.manualContinueText.setVisible(true)
  }

  hideManual() {
    this.manualTitleText.setVisible(false)
    this.manualBodyText.setVisible(false)
    this.manualContinueText.setVisible(false)
  }

  // "게임 방법 다시보기"로 들어왔을 때 닫으면, showManual()이 꺼뒀던 대기화면 요소들을
  // 전부 되살려서 그냥 대기화면으로 돌아간다(게임이 자동으로 시작되지 않는다).
  closeManualToReady() {
    this.hideManual()
    this.state = 'ready'
    this.bird.setVisible(true)
    this.scoreText.setVisible(true)
    this.messageText.setVisible(true)
    this.subMessageText.setVisible(true)
    this.streakText.setVisible(true)
    this.titleGroup.forEach((o) => o.setVisible(true))
    this.shopButtonBg.setVisible(true)
    this.shopButtonText.setVisible(true)
    this.manualButtonBg.setVisible(true)
    this.manualButtonText.setVisible(true)
    this.leaderboardButtonBg.setVisible(true)
    this.leaderboardButtonText.setVisible(true)
    this.langButtonBg.setVisible(true)
    this.langButtonText.setVisible(true)
  }

  updateShieldDisplay() {
    this.shieldInventoryText.setText(`🛡️ ${this.shieldCount}`)
  }

  updateBombDisplay() {
    this.bombInventoryText.setText(`💣 ${this.bombCount}`)
  }

  showRestartPrompt() {
    this.gameOverPromptHidden = false
    this.restartYesText.setVisible(true)
    this.restartNoText.setVisible(true)
  }

  hideRestartPrompt() {
    this.gameOverPromptHidden = true
    this.restartYesText.setVisible(false)
    this.restartNoText.setVisible(false)
  }

  handleInput(currentlyOver = []) {
    // 상점 열기/이어하기 같은 전용 버튼 위를 탭했을 때는, 그 버튼 핸들러가 따로 처리하니까
    // "탭하면 시작/재시작" 같은 화면 전체 기본 동작이 같이 발동하지 않게 막는다.
    if (currentlyOver.some((obj) => obj.isUiButton)) return

    if (this.state === 'ready') {
      // 처음 방문한 사람만 시작 전에 매뉴얼을 한 번 보여준다. 그 다음부턴(재시작 포함)
      // localStorage에 남아있으니 대기화면에서 바로 시작으로 넘어간다.
      if (!this.hasSeenManual) {
        this.manualIsFirstRun = true
        this.showManual()
      } else {
        this.startGame()
      }
    } else if (this.state === 'manual') {
      this.hasSeenManual = true
      localStorage.setItem(HAS_SEEN_MANUAL_KEY, 'true')
      // "다시보기"로 들어온 거면 그냥 보여주기만 하는 화면이니 대기화면으로 돌아가고,
      // 처음 보는 거면 원래 흐름대로 이어서 게임을 시작한다.
      if (this.manualIsFirstRun) {
        this.hideManual()
        this.maybePromptNicknameThenReady()
      } else {
        this.closeManualToReady()
      }
    } else if (this.state === 'playing') {
      this.flap()
    } else if (this.state === 'gameover') {
      // 화면을 그냥 탭한 것만으로는 재시작되지 않는다 — "예/아니오" 확인 버튼을 다시
      // 보여줄 뿐이고, 실제 재시작은 "예" 버튼을 눌러야만 일어난다(위 isUiButton 분기).
      if (this.gameOverPromptHidden) this.showRestartPrompt()
    }
  }

  startGame() {
    this.state = 'playing'
    this.idleTween.stop()
    this.bird.setVisible(true)
    this.bird.body.allowGravity = true
    this.scoreText.setVisible(true)
    this.messageText.setVisible(false)
    this.subMessageText.setVisible(false)
    this.streakText.setVisible(false)
    this.titleGroup.forEach((o) => o.setVisible(false))
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)
    this.manualButtonBg.setVisible(false)
    this.manualButtonText.setVisible(false)
    this.leaderboardButtonBg.setVisible(false)
    this.leaderboardButtonText.setVisible(false)
    this.langButtonBg.setVisible(false)
    this.langButtonText.setVisible(false)
    this.continueButtonText.setVisible(false)
    this.hideRestartPrompt()
    this.hideManual()
    this.shieldInventoryText.setVisible(true)
    this.bombInventoryText.setVisible(true)
    this.spawnTimer.paused = false
    this.powerupTimer.paused = false

    this.bird.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
    this.bird.setVelocity(0, 0)
    this.bird.setRotation(this.driftAngle + Math.PI)
    this.physics.world.gravity.set(Math.cos(this.driftAngle) * GRAVITY, Math.sin(this.driftAngle) * GRAVITY)

    this.spawnObstacle()
    this.flap()

    // 팝업 텍스트가 하나뿐이라 동시에 여러 번 부르면 나중 것만 보이므로, 시작 안내 →
    // 세트 효과 순서로 시간차를 두고 보여준다.
    this.showAchievement(t('startTier'))
    const bonusPercent = this.getCollectionBonusPercent()
    if (bonusPercent > 0) {
      this.time.delayedCall(1800, () => {
        this.showAchievement(t('setBonusActivated', { percent: bonusPercent }))
      })
    }
  }

  flap() {
    const angle = this.driftAngle + Math.PI
    this.bird.setVelocity(Math.cos(angle) * FLAP_VELOCITY, Math.sin(angle) * FLAP_VELOCITY)

    const flame = this.getEquippedFlame()
    this.playEngineSound(flame)
    this.spawnThrustPuff(flame)

    this.bird.setTexture('rocket-thrust')
    this.time.delayedCall(120, () => {
      if (this.bird.active) this.bird.setTexture('rocket')
    })
  }

  spawnObstacle() {
    const travelAngle = this.driftAngle + Math.PI
    const spawnRadius = Math.hypot(GAME_WIDTH, GAME_HEIGHT) / 2 + 60
    const perpAngle = travelAngle + Math.PI / 2
    // 화면(400x600)을 확실히 가로지르도록 더 좁은 쪽(가로) 기준으로 오프셋 범위를 제한한다.
    const perpOffset = Phaser.Math.FloatBetween(-1, 1) * (Math.min(GAME_WIDTH, GAME_HEIGHT) / 2 + OBSTACLE_MAX_RADIUS)
    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2
    const spawnX = cx - Math.cos(travelAngle) * spawnRadius + Math.cos(perpAngle) * perpOffset
    const spawnY = cy - Math.sin(travelAngle) * spawnRadius + Math.sin(perpAngle) * perpOffset

    const radius = Phaser.Math.Between(OBSTACLE_MIN_RADIUS, OBSTACLE_MAX_RADIUS)

    const circle = this.add.circle(spawnX, spawnY, radius, 0x000000, 0)
    this.physics.add.existing(circle)

    // 그룹의 기본값(velocity 0, immovable false 등)이 add() 시점에 body를 덮어쓰므로
    // 먼저 그룹에 넣고, 실제로 원하는 물리값은 그 다음에 적용한다.
    this.obstacleGroup.add(circle)

    circle.body.setCircle(radius)
    circle.body.allowGravity = false
    circle.body.setImmovable(true)
    circle.body.setVelocity(Math.cos(travelAngle) * this.obstacleSpeed, Math.sin(travelAngle) * this.obstacleSpeed)

    // 중심에서 스폰 지점까지의 실제 거리(대각선 오프셋 포함) 기준으로 소멸 판정해야
    // 오프셋이 큰 장애물이 스폰 즉시 "이미 범위 밖"으로 처리되는 버그를 막는다.
    circle.despawnRadius = Math.hypot(spawnX - cx, spawnY - cy)
    // 로켓과 스칠 만큼 가까워지는 순간(아래 update()) "아슬아슬 보너스"를 한 번만 터뜨리기 위한 플래그.
    circle.nearMissTriggered = false
    const dodgeballChance =
      DODGEBALL_MIN_CHANCE + (DODGEBALL_MAX_CHANCE - DODGEBALL_MIN_CHANCE) * (1 - Math.exp(-this.score / DODGEBALL_SCALE))
    const isDodgeball = Math.random() < dodgeballChance

    // 티어별 장애물 종류: 300점부터는 어디까지 온 상급자를 위해 지금까지 나온 종류를 전부 섞어서 낸다.
    let visualType
    if (isDodgeball) {
      visualType = 'dodgeball'
    } else if (this.score >= SHOOTING_STAR_SCORE) {
      visualType = Phaser.Utils.Array.GetRandom(['cloud', 'meteor', 'galaxy', 'blackhole'])
    } else if (this.score >= BLACKHOLE_TIER_SCORE) {
      visualType = 'blackhole'
    } else if (this.score >= GALAXY_TIER_SCORE) {
      visualType = 'galaxy'
    } else if (this.score >= METEOR_TIER_SCORE) {
      visualType = 'meteor'
    } else {
      visualType = 'cloud'
    }

    if (visualType === 'dodgeball') circle.visual = this.drawDodgeballVisual(radius * 2)
    else if (visualType === 'blackhole') circle.visual = this.drawBlackHoleVisual(radius * 2)
    else if (visualType === 'galaxy') circle.visual = this.drawGalaxyVisual(radius * 2)
    else if (visualType === 'meteor') circle.visual = this.drawMeteorVisual(radius * 2)
    else circle.visual = this.drawCloudVisual(radius * 2)

    circle.visual.setPosition(spawnX, spawnY)
    if (visualType === 'blackhole' || visualType === 'galaxy') {
      circle.spinSpeed = Phaser.Math.FloatBetween(0.6, 1.3) * (Math.random() < 0.5 ? 1 : -1)
    }

    return circle
  }

  destroyObstacle(obstacle) {
    if (obstacle.visual) obstacle.visual.destroy()
    obstacle.destroy()
  }

  // ---------- 파워업: 실드 / 폭탄 ----------

  spawnPowerup() {
    const travelAngle = this.driftAngle + Math.PI
    const spawnRadius = Math.hypot(GAME_WIDTH, GAME_HEIGHT) / 2 + 60
    const perpAngle = travelAngle + Math.PI / 2
    const perpOffset = Phaser.Math.FloatBetween(-1, 1) * (Math.min(GAME_WIDTH, GAME_HEIGHT) / 2)
    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2
    const spawnX = cx - Math.cos(travelAngle) * spawnRadius + Math.cos(perpAngle) * perpOffset
    const spawnY = cy - Math.sin(travelAngle) * spawnRadius + Math.sin(perpAngle) * perpOffset

    const type = Math.random() < 0.5 ? 'shield' : 'bomb'
    const color = type === 'shield' ? 0x4fc3f7 : 0xff5533

    const icon = this.add.circle(spawnX, spawnY, POWERUP_RADIUS, color, 1)
    icon.setStrokeStyle(2, 0xffffff, 0.9)
    this.physics.add.existing(icon)
    this.powerupGroup.add(icon)
    icon.body.setCircle(POWERUP_RADIUS)
    icon.body.allowGravity = false
    icon.body.setImmovable(true)
    const powerupV = this.obstacleSpeed * 0.8
    icon.body.setVelocity(Math.cos(travelAngle) * powerupV, Math.sin(travelAngle) * powerupV)
    icon.despawnRadius = Math.hypot(spawnX - cx, spawnY - cy)
    icon.powerupType = type
    icon.label = this.add.text(spawnX, spawnY, type === 'shield' ? '🛡️' : '💣', { fontSize: '16px' }).setOrigin(0.5)

    // 로켓이 직접 부딪히는 것 외에, 마우스 클릭/탭으로도 바로 주울 수 있게 한다.
    // 화면상 아이콘(반지름 13px)보다 넉넉하게(+22px) 판정을 넓혀서 손가락 탭에서도 잘 잡히게 한다.
    // (아이템이 계속 움직이고 있어서, 판정이 너무 빠듯하면 탭한 순간 이미 살짝 벗어나 있을 수 있다.)
    icon.setInteractive(
      new Phaser.Geom.Circle(POWERUP_RADIUS, POWERUP_RADIUS, POWERUP_RADIUS + 22),
      Phaser.Geom.Circle.Contains,
    )
    icon.input.cursor = 'pointer'
    icon.on('pointerdown', () => this.collectPowerup(icon))

    return icon
  }

  destroyPowerup(powerup) {
    if (powerup.label) powerup.label.destroy()
    powerup.destroy()
  }

  handleObstacleHit(obstacle) {
    if (this.shieldCount > 0) {
      this.shieldCount -= 1
      this.updateShieldDisplay()
      if (this.shieldCount <= 0) this.shieldRing.setVisible(false)
      this.destroyObstacle(obstacle)
      this.showShieldBreakEffect()
      this.playShieldBreakSound()
      // 장애물 여러 개가 같은 프레임(혹은 바로 다음 프레임)에 겹쳐서 부딪히면 실드가 하나만
      // 막고 바로 죽어버리는 억울한 경우가 있었다. 깨지는 순간 아주 짧은 무적 시간을 줘서
      // 그 찰나에 겹쳐 있던 다른 장애물엔 안 죽고 그냥 치우기만 하게 한다.
      this.shieldGraceUntil = this.time.now + 200
      return
    }
    if (this.time.now < this.shieldGraceUntil) {
      this.destroyObstacle(obstacle)
      return
    }
    this.gameOver()
  }

  collectPowerup(powerup) {
    if (this.state !== 'playing') return
    const type = powerup.powerupType
    this.destroyPowerup(powerup)

    if (type === 'shield') {
      if (this.shieldCount >= MAX_SHIELD_STACK) {
        this.showAchievement(t('shieldFull', { count: MAX_SHIELD_STACK, max: MAX_SHIELD_STACK }))
        return
      }
      this.playPowerupSound()
      this.shieldCount += 1
      this.shieldRing.setVisible(true)
      this.updateShieldDisplay()
      this.showAchievement(t('shieldCharged', { count: this.shieldCount, max: MAX_SHIELD_STACK }))
    } else {
      if (this.bombCount >= MAX_BOMB_STACK) {
        this.showAchievement(t('bombFull', { count: MAX_BOMB_STACK, max: MAX_BOMB_STACK }))
        return
      }
      this.playPowerupSound()
      this.bombCount += 1
      this.updateBombDisplay()
      this.showAchievement(t('bombStored', { count: this.bombCount, max: MAX_BOMB_STACK }))
    }
  }

  // 폭탄은 먹는 즉시 터지는 대신 인벤토리에 모아뒀다가, 위험할 때 직접 써야 발동한다.
  useBomb() {
    if (this.state !== 'playing' || this.bombCount <= 0) return
    this.bombCount -= 1
    this.updateBombDisplay()
    this.triggerBombEffect()
  }

  triggerBombEffect() {
    // 지금 화면에 "보이는" 장애물만 터뜨리고, 터뜨린 개수만큼 점수/코인을 준다.
    // 회피 게임에 슬로모션은 어울리지 않는다는 피드백에 따라 슬로모션 대신 넣은 공격적인 파워업.
    // obstacleGroup에는 화면 밖 스폰 지점(화면 경계 밖 최대 60px)에서 막 생성돼 아직 안 보이는
    // 장애물도 섞여 있어서, 필터링 없이 다 세면 "안 보이는데도 점수가 나온다"는 억울함이 생긴다.
    const margin = OBSTACLE_MAX_RADIUS
    const obstacles = this.obstacleGroup
      .getChildren()
      .filter((o) => o.x >= -margin && o.x <= GAME_WIDTH + margin && o.y >= -margin && o.y <= GAME_HEIGHT + margin)
    const count = obstacles.length

    obstacles.forEach((obstacle) => {
      for (let i = 0; i < 4; i++) {
        this.spawnSparkle(
          obstacle.x + Phaser.Math.FloatBetween(-10, 10),
          obstacle.y + Phaser.Math.FloatBetween(-10, 10),
          0xffb347,
        )
      }
      this.destroyObstacle(obstacle)
    })

    this.playExplosionSound()
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffe8b0, 0.55).setDepth(450)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    })

    if (count > 0) {
      this.score += count
      this.runCoins += count
      this.scoreText.setText(String(this.score))

      if (!this.beatBestThisRun && this.score > this.bestScore) {
        this.beatBestThisRun = true
        this.playCheerSound()
        this.showAchievement(t('newRecord'))
      }
      if (this.score >= GALAXY_TIER_SCORE) this.activateGalaxyTier()
      this.checkAchievements()
      this.updateDifficultyFromScore()
    }

    this.showAchievement(t('bombEffect', { count }))
  }

  showShieldBreakEffect() {
    for (let i = 0; i < 8; i++) {
      this.spawnSparkle(this.bird.x, this.bird.y, 0x8fe3ff)
    }
  }

  updateDifficultyFromScore() {
    // 점근 곡선: 초반부터 빠르게 어려워지고, 최대 난이도 근처에서는 완만해진다.
    const t = 1 - Math.exp(-this.score / DIFFICULTY_SCALE)
    this.obstacleSpeed = OBSTACLE_SPEED_START + (OBSTACLE_SPEED_MAX - OBSTACLE_SPEED_START) * t
    this.spawnInterval = SPAWN_INTERVAL_START - (SPAWN_INTERVAL_START - SPAWN_INTERVAL_MIN) * t
    this.spawnTimer.delay = this.spawnInterval
  }

  update(time, delta) {
    this.updateCosmicVisuals()
    this.updateShootingStars(delta)
    this.updateEquippedSkinAnim(time, delta)

    if (this.state !== 'playing') return

    this.updateDrift(delta)
    this.updateStarfield(delta)

    // 화면 밖으로 나가는 것 자체는 죽음이 아니라 반대편으로 감싸기(랩어라운드).
    // 진짜 위협은 장애물이어야 하니, 벽은 그냥 통과하는 느낌으로 둔다.
    this.bird.x = Phaser.Math.Wrap(this.bird.x, 0, GAME_WIDTH)
    this.bird.y = Phaser.Math.Wrap(this.bird.y, 0, GAME_HEIGHT)

    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2

    this.obstacleGroup.children.each((obstacle) => {
      if (obstacle.visual) {
        obstacle.visual.setPosition(obstacle.x, obstacle.y)
        if (obstacle.spinSpeed) obstacle.visual.rotation += obstacle.spinSpeed * (delta / 1000)
      }

      // "아슬아슬 보너스"는 장애물이 화면 밖으로 나가는 despawn 시점이 아니라, 로켓 바로 옆을
      // 스쳐 지나가는 그 순간(스크린 안, 로켓 위치)에 바로 터뜨려야 체감이 맞는다. 장애물 하나당
      // 한 번만 터지도록 nearMissTriggered로 막는다.
      if (!obstacle.nearMissTriggered) {
        const distToBird = Math.hypot(obstacle.x - this.bird.x, obstacle.y - this.bird.y)
        const nearMissThreshold = obstacle.body.radius + ROCKET_HIT_RADIUS + NEAR_MISS_MARGIN
        if (distToBird <= nearMissThreshold) {
          obstacle.nearMissTriggered = true
          this.score += 1
          this.runCoins += 1
          this.nearMissTotal += 1
          this.runNearMissCount += 1
          localStorage.setItem(NEAR_MISS_TOTAL_KEY, String(this.nearMissTotal))
          this.scoreText.setText(String(this.score))
          this.showNearMissBonus(this.bird.x, this.bird.y)
          this.playNearMissSound()
        }
      }

      const distFromCenter = Math.hypot(obstacle.x - cx, obstacle.y - cy)
      if (distFromCenter > obstacle.despawnRadius) {
        this.destroyObstacle(obstacle)

        this.score += 1
        this.runCoins += 1
        this.scoreText.setText(String(this.score))

        if (!this.beatBestThisRun && this.score > this.bestScore) {
          this.beatBestThisRun = true
          this.playCheerSound()
          this.showAchievement(t('newRecord'))
        }
        if (this.score >= GALAXY_TIER_SCORE) this.activateGalaxyTier()
        this.checkAchievements()
        this.updateDifficultyFromScore()
      }
    })

    this.powerupGroup.children.each((powerup) => {
      if (powerup.label) powerup.label.setPosition(powerup.x, powerup.y)
      const distFromCenter = Math.hypot(powerup.x - cx, powerup.y - cy)
      if (distFromCenter > powerup.despawnRadius) this.destroyPowerup(powerup)
    })

    if (this.shieldCount > 0) this.shieldRing.setPosition(this.bird.x, this.bird.y)
  }

  gameOver() {
    if (this.state !== 'playing') return
    this.state = 'gameover'
    this.spawnTimer.paused = true
    this.powerupTimer.paused = true
    this.shieldRing.setVisible(false)
    this.shieldInventoryText.setVisible(false)
    this.bombInventoryText.setVisible(false)
    this.physics.pause()
    this.bird.setTint(0xff6666)
    // 부딪힌 자리에 그대로 남아있으면, 죽은 위치에 따라 화면 가운데 결과 텍스트와 겹쳐서
    // 마치 글씨가 흐릿하게 얼룩진 것처럼 보인다. 잠깐 빨갛게 보여준 다음 옅게 페이드시킨다.
    this.tweens.add({ targets: this.bird, alpha: 0.25, duration: 500, delay: 300 })
    this.playExplosionSound()

    if (this.score > this.bestScore) {
      this.bestScore = this.score
      localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore))
    }

    // 닉네임을 이미 정한 사람만 조용히 자동 제출한다(더 높을 때만 반영되니 매번 불러도 안전하다).
    if (this.nickname) submitScore(this.nickname, this.score, this.getEquippedSkinId(), this.getEquippedFlameId())

    // "이어하기"로 계속 플레이하다 또 죽으면 gameOver()가 다시 호출되는데, runCoins를 그대로 또
    // 더하면 이미 적립된 몫이 중복 적립된다. 커밋한 몫은 스냅샷(lastRunCoinsEarned)에 옮기고
    // runCoins는 0으로 되돌려서, 계속하는 동안 새로 번 코인만 다음 커밋 대상이 되게 한다.
    this.lastRunCoinsEarned = this.runCoins
    this.totalCoins += this.runCoins
    this.runCoins = 0
    localStorage.setItem(COINS_KEY, String(this.totalCoins))

    this.totalGamesPlayed += 1
    this.totalScoreSum += this.score
    localStorage.setItem(TOTAL_GAMES_KEY, String(this.totalGamesPlayed))
    localStorage.setItem(TOTAL_SCORE_SUM_KEY, String(this.totalScoreSum))

    this.renderGameOverTexts()
  }

  renderGameOverTexts() {
    // 대기화면에서 쓰던 크기 그대로면 "다시하시겠습니까?" / "이어하기" / 점수 3덩어리가
    // 다닥다닥 붙어 보여서, 게임오버 화면 전용으로 글자를 줄이고 사이 간격을 벌려준다.
    // scene.restart()로 돌아가면 어차피 이 세 텍스트도 create()에서 원래 크기로 새로 만들어지니
    // 여기서 스타일을 바꿔도 대기화면에는 영향이 없다.
    this.messageText.setText(t('gameOverTitle'))
    this.messageText.setFontSize(18)
    this.messageText.setY(GAME_HEIGHT / 2 - 88)
    this.messageText.setVisible(true)

    this.continueButtonText.setFontSize(13)
    this.continueButtonText.setY(GAME_HEIGHT / 2 - 32)
    this.continueButtonText.setVisible(!this.usedContinueThisRun)

    const avgScore = this.totalGamesPlayed > 0 ? Math.round(this.totalScoreSum / this.totalGamesPlayed) : 0
    this.subMessageText.setText(
      t('gameOverStats', {
        score: this.score,
        best: this.bestScore,
        nearMiss: this.runNearMissCount,
        avg: avgScore,
        earned: this.lastRunCoinsEarned,
        total: this.totalCoins,
      }),
    )
    this.subMessageText.setFontSize(13)
    this.subMessageText.setY(GAME_HEIGHT / 2 + 26)
    this.subMessageText.setVisible(true)

    this.showRestartPrompt()
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  // 폰처럼 devicePixelRatio가 높은 화면에서 캔버스를 CSS로 늘려 그리면 글자가 흐릿하게
  // 보인다. 실제 프레임버퍼 해상도를 화면 배율만큼 올려서 텍스트/그래픽이 선명하게 나오게 한다.
  // (텍스트 스타일에 넣는 TEXT_RESOLUTION과 같은 값으로 맞춰서 캔버스/글자 해상도가 어긋나지 않게 한다.)
  resolution: TEXT_RESOLUTION,
  backgroundColor: '#050818',
  // Phaser 기본값은 터치 포인터를 1개만 추적한다. 이 게임처럼 탭으로 날갯짓하면서
  // 동시에 화면 위 아이템도 탭해야 하는 경우, 이전 터치가 완전히 안 끝난 채로 빠르게
  // 다음 탭을 하면 두 번째 터치가 그냥 무시돼버려서 "가끔 아이템이 안 먹힌다"는 문제가
  // 생겼다. 여러 포인터를 동시에 추적하게 늘려서 이런 탭 유실을 줄인다.
  input: {
    activePointers: 3,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    // #app 쪽 flexbox(justify-content/align-items: center)가 이미 캔버스를 중앙에 놓고
    // 있는데, Phaser의 autoCenter도 같이 켜두면 캔버스에 직접 margin을 얹어서 중앙 정렬이
    // 두 번 겹쳐 적용된다. 좁은 폰 화면에서는 차이가 작아 안 보이다가, 데스크톱처럼 창이
    // 넓을 때 그 오차가 커져서 오른쪽으로 쏠려 보였다. CSS 쪽 하나로만 정렬하게 끈다.
  },
  scene: GameScene,
})
