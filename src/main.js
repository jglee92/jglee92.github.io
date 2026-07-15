import Phaser from 'phaser'
import './style.css'

const GAME_WIDTH = 400
const GAME_HEIGHT = 600

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

const ACHIEVEMENTS = [
  { score: 50, text: '🌑 운석 지대 진입! 운석을 피하세요' },
  { score: 100, text: '🌌 은하 지대 진입! 은하를 피하세요' },
  { score: 180, text: '🕳️ 블랙홀 지대 진입! 블랙홀을 피하세요' },
  { score: 300, text: '☄️ 카오스 지대 진입! 구름·운석·은하·블랙홀이 랜덤하게 나와요' },
]

const START_TIER_TEXT = '☁️ 구름 지대 시작! 구름을 피하세요'

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

const MANUAL_TEXT =
  '🚀 화면을 탭하거나 스페이스바로 로켓을 밀어내요\n' +
  '🌪️ 중력 방향이 계속 서서히 바뀌어요\n' +
  '🔄 화면 벽에 닿으면 반대편으로 나와요\n' +
  '☁️ 장애물을 피하면 점수/코인을 얻어요\n' +
  '🛡️💣 아이템은 탭하면 바로 획득! 폭탄은 모아뒀다가\n   원할 때 다시 탭해서 써요\n' +
  '🛒 상점에서 코인으로 로켓/불꽃을 꾸밀 수 있어요'

// bonusPercent: 보유하면 아이템 등장 확률에 더해지는 %. 싼 스킨은 조금, 비싼/한정 스킨은
// 확실히 크게 차등을 둬서(2~6%) "체감이 안 된다"는 후기를 반영했다. 로켓 합 25% + 불꽃 합 20%
// = 최대 45%.
const ROCKET_SKINS = [
  { id: 'default', name: '기본', cost: 0, body: 0xd8d8e2, nose: 0xd23c3c, fin: 0xb52e2e },
  { id: 'crimson', name: '크림슨', cost: 50, body: 0xe8e0e0, nose: 0x8b1e3f, fin: 0x5c1229, bonusPercent: 2 },
  { id: 'azure', name: '아주르', cost: 120, body: 0xe4eefc, nose: 0x1b6ca8, fin: 0x0f3f66, bonusPercent: 3 },
  { id: 'gold', name: '골드', cost: 250, body: 0xfff3c4, nose: 0xd4a017, fin: 0x8a6c0a, bonusPercent: 4 },
  {
    id: 'neon',
    name: '🌟 네온사이버 (한정)',
    cost: 350,
    body: 0x1a1a2e,
    nose: 0xff2fd4,
    fin: 0x2fe8ff,
    unlock: { streak: 3, nearMiss: 100 },
    bonusPercent: 5,
  },
  {
    id: 'holo',
    name: '✨ 홀로그램',
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
    name: '💎 다이아몬드 (한정)',
    cost: 800,
    body: 0xeaf6ff,
    nose: 0x3a6fa8,
    fin: 0xffffff,
    animated: true,
    sparkleCount: 4,
    unlock: { streak: 7, nearMiss: 200 },
    bonusPercent: 6,
  },
]

const FLAME_SKINS = [
  { id: 'default', name: '기본', cost: 0, outer: 0xffb347, inner: 0xfff176, oscType: 'sawtooth', freqStart: 180, freqEnd: 70 },
  {
    id: 'blue',
    name: '블루 플레임',
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
    name: '그린 플레임',
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
    name: '🌑 다크 플레임 (한정)',
    cost: 220,
    outer: 0x2a0a3d,
    inner: 0x8e2fd6,
    oscType: 'sawtooth',
    freqStart: 140,
    freqEnd: 45,
    unlock: { streak: 3, nearMiss: 100 },
    bonusPercent: 4,
  },
  {
    id: 'rainbow',
    name: '🌈 레인보우 플레임',
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
    name: '💎 다이아몬드 플레임 (한정)',
    cost: 450,
    outer: 0xbfe9ff,
    inner: 0xffffff,
    animated: true,
    oscType: 'sine',
    freqStart: 300,
    freqEnd: 140,
    unlock: { streak: 7, nearMiss: 200 },
    bonusPercent: 6,
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
    this.shopTab = 'rocket'
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
      if (this.state === 'ready') this.showManual()
    })
    this.input.keyboard.on('keydown-S', () => {
      if (this.state === 'ready') this.openShop()
      else if (this.state === 'shop') this.closeShop()
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
      .text(x, y, '아슬아슬! +1', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#ffe066',
        stroke: '#000000',
        strokeThickness: 3,
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
        this.showAchievement(achievement.text)
      }
    })
  }

  // ---------- 광고 SDK 연동 전 자리표시자 ----------

  playPlaceholderAd(onComplete) {
    this.state = 'ad-placeholder'
    this.messageText.setText('📺 광고 재생 중... (자리표시자)')
    this.subMessageText.setVisible(false)
    this.continueButtonText.setVisible(false)
    this.hideRestartPrompt()
    this.time.delayedCall(CONTINUE_AD_DURATION, onComplete)
  }

  tryContinue() {
    if (this.state !== 'gameover' || this.usedContinueThisRun) return
    this.usedContinueThisRun = true
    this.playPlaceholderAd(() => this.continueAfterAd())
  }

  continueAfterAd() {
    // 부활 지점 주변 장애물을 정리해서 최소한의 안전 구간을 준다.
    this.obstacleGroup.children.each((obstacle) => this.destroyObstacle(obstacle))

    this.bird.clearTint()
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

  openShop() {
    if (this.state !== 'ready') return
    this.state = 'shop'
    this.messageText.setVisible(false)
    this.hintText.setVisible(false)
    this.subMessageText.setVisible(false)
    this.streakText.setVisible(false)
    this.titleText.setVisible(false)
    this.subtitleText.setVisible(false)
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)
    this.manualButtonBg.setVisible(false)
    this.manualButtonText.setVisible(false)
    this.renderShop()
  }

  closeShop() {
    if (this.shopTexts) {
      this.shopTexts.forEach((t) => t.destroy())
      this.shopTexts = null
    }
    this.state = 'ready'
    this.messageText.setVisible(true)
    this.hintText.setVisible(true)
    this.subMessageText.setVisible(true)
    this.streakText.setVisible(true)
    this.titleText.setVisible(true)
    this.subtitleText.setVisible(true)
    this.shopButtonBg.setVisible(true)
    this.shopButtonText.setVisible(true)
    this.shopButtonText.setText(`🛒 상점\n🪙 ${this.totalCoins}`)
    this.manualButtonBg.setVisible(true)
    this.manualButtonText.setVisible(true)
  }

  toggleShopTab() {
    this.shopTab = this.shopTab === 'rocket' ? 'flame' : 'rocket'
    this.renderShop()
  }

  renderShop() {
    if (this.shopTexts) {
      this.shopTexts.forEach((t) => t.destroy())
    }
    this.shopTexts = []

    const style = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }

    const title = this.add
      .text(GAME_WIDTH / 2, 56, `🛒 상점   🪙 ${this.totalCoins}`, { ...style, fontSize: '19px', align: 'center' })
      .setOrigin(0.5)
    this.shopTexts.push(title)

    // 첫 화면(대기화면)에 커스터마이징 미리보기를 두는 건 의미가 없다는 후기가 있어서,
    // 대신 상점에서 지금 장착 중인 로켓/불꽃을 바로 보여준다.
    const equipY = 80
    const equipLabel = this.add
      .text(GAME_WIDTH / 2 - 70, equipY, '현재 장착', { ...style, fontSize: '11px', color: '#9999aa' })
      .setOrigin(0.5)
    this.shopTexts.push(equipLabel)
    const equipSkinIcon = this.add
      .image(GAME_WIDTH / 2 - 20, equipY, this.ensureSkinPreviewTexture(this.getEquippedSkin()))
      .setOrigin(0.5)
    this.shopTexts.push(equipSkinIcon)
    const equipFlameIcon = this.add
      .image(GAME_WIDTH / 2 + 25, equipY, this.ensureFlamePreviewTexture(this.getEquippedFlame()))
      .setOrigin(0.5)
    this.shopTexts.push(equipFlameIcon)

    // 탭을 하나로 합친 토글 텍스트는 어느 게 현재 탭인지 구분이 잘 안 된다는 후기가 있어서,
    // 버튼 두 개로 나누고 각각 직접 눌러서 바로 그 탭으로 이동하게 한다.
    const tabY = 104
    const tabWidth = 150
    const tabHeight = 26
    const tabDefs = [
      { key: 'rocket', label: '🚀 로켓 스킨', x: GAME_WIDTH / 2 - tabWidth / 2 - 4 },
      { key: 'flame', label: '🔥 불꽃 색상', x: GAME_WIDTH / 2 + tabWidth / 2 + 4 },
    ]
    tabDefs.forEach((tab) => {
      const active = this.shopTab === tab.key
      const bg = this.add
        .rectangle(tab.x, tabY, tabWidth, tabHeight, active ? 0x3a5fd9 : 0x1a1a2e, active ? 0.95 : 0.5)
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
        .text(tab.x, tabY, tab.label, { ...style, fontSize: '14px', color: active ? '#ffffff' : '#9999aa' })
        .setOrigin(0.5)
      this.shopTexts.push(label)
    })

    const rocketBonus = this.getRocketBonusPercent()
    const flameBonus = this.getFlameBonusPercent()
    const bonusRow = this.add
      .text(GAME_WIDTH / 2, 128, `🎁 아이템 확률 보너스   로켓 +${rocketBonus}%   불꽃 +${flameBonus}%`, {
        ...style,
        fontSize: '11px',
        align: 'center',
      })
      .setOrigin(0.5)
    this.shopTexts.push(bonusRow)

    const items = this.shopTab === 'rocket' ? ROCKET_SKINS : FLAME_SKINS
    const equippedId = this.shopTab === 'rocket' ? this.getEquippedSkinId() : this.getEquippedFlameId()
    const isOwned = (id) => (this.shopTab === 'rocket' ? this.isSkinOwned(id) : this.isFlameOwned(id))

    const listTop = 148
    // 해금 조건이 둘 다 있는 잠긴 아이템은 "또는" 줄까지 3줄이 되어 기본 줄 간격(54px)을
    // 넘칠 수 있어서, 아이템마다 실제 줄 수에 맞춰 다음 줄 위치를 누적 계산한다.
    let rowY = listTop
    items.forEach((item, i) => {
      const owned = isOwned(item.id)
      const unlocked = this.isItemUnlocked(item)
      const bonusTag = owned && item.bonusPercent ? ` (아이템 확률 +${item.bonusPercent}%)` : ''
      let statusLines
      if (item.id === equippedId) statusLines = [`✅ 장착중${bonusTag}`]
      else if (owned) statusLines = [`보유함 (선택)${bonusTag}`]
      else if (!unlocked) {
        statusLines = []
        if (item.unlock.streak !== undefined) {
          statusLines.push(`🔒 ${item.unlock.streak}일 연속 접속 필요 (현재 ${this.dailyStreak}일차)`)
        }
        if (item.unlock.streak !== undefined && item.unlock.nearMiss !== undefined) {
          statusLines.push('── 또는 (둘 중 하나만 채우면 OK) ──')
        }
        if (item.unlock.nearMiss !== undefined) {
          statusLines.push(`아슬아슬 ${item.unlock.nearMiss}번 필요 (현재 ${this.nearMissTotal}번)`)
        }
      } else {
        statusLines = [`🪙 ${item.cost}`]
      }

      const previewKey =
        this.shopTab === 'rocket' ? this.ensureSkinPreviewTexture(item) : this.ensureFlamePreviewTexture(item)
      const icon = this.add
        .image(55, rowY, previewKey)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectCurrent(i))
      this.shopTexts.push(icon)

      const label = `[${i + 1}] ${item.name}\n${statusLines.join('\n')}`
      const longestLine = Math.max(...statusLines.map((l) => l.length))
      const smallFont = statusLines.length > 1 || longestLine > 14
      const row = this.add
        .text(88, rowY, label, { ...style, fontSize: smallFont ? '12px' : '15px' })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectCurrent(i))
      this.shopTexts.push(row)

      const totalLines = statusLines.length + 1
      rowY += Math.max(48, totalLines * (smallFont ? 14 : 18) + 6)
    })

    const closeLine = this.add
      .text(GAME_WIDTH / 2, rowY + 10, '👉 탭해서 닫기 (S)', { ...style, align: 'center' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeShop())
    this.shopTexts.push(closeLine)
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
        this.showAchievement('🔒 아직 해금 조건을 못 채웠어요!')
        return
      }
      if (this.totalCoins < skin.cost) {
        this.showAchievement('🪙 코인이 부족해요!')
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
        this.showAchievement('🔒 아직 해금 조건을 못 채웠어요!')
        return
      }
      if (this.totalCoins < flame.cost) {
        this.showAchievement('🪙 코인이 부족해요!')
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
    const streakOk = item.unlock.streak !== undefined && this.dailyStreak >= item.unlock.streak
    const nearMissOk = item.unlock.nearMiss !== undefined && this.nearMissTotal >= item.unlock.nearMiss
    return streakOk || nearMissOk
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

  drawRocketTexture(key, flameLen, skin, flameSkin) {
    const flame = flameSkin || FLAME_SKINS[0]
    const w = 56
    const h = 24
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
          16 - bigFlameLen * t0,
          4 + (20 - 4) * t0 * 0.5,
          16 - bigFlameLen * t0,
          20 - (20 - 4) * t0 * 0.5,
          16 - bigFlameLen * t1,
          12,
        )
      }
      // 안쪽 흰 코어를 겹쳐서 "화끈하게 타오르는" 느낌을 더한다.
      g.fillStyle(0xffffff, 0.85)
      g.fillTriangle(16, 10, 16, 14, 16 - bigFlameLen * 0.35, 12)
    } else {
      g.fillStyle(flame.outer, 1)
      g.fillTriangle(16, 5, 16, 19, 16 - flameLen, 12)
      g.fillStyle(flame.inner, 1)
      g.fillTriangle(16, 9, 16, 15, 16 - flameLen * 0.55, 12)

      if (flame.id === 'diamond') {
        // 다이아몬드 불꽃: 무지개색 대신 하얀 코어가 맥동하며 반짝이는 느낌으로 차별화한다.
        const pulse = 0.5 + 0.5 * Math.sin(((this.holoHue || 0) / 360) * Math.PI * 2)
        g.fillStyle(0xffffff, 0.5 + pulse * 0.4)
        g.fillTriangle(16, 10, 16, 14, 16 - flameLen * 0.4, 12)
      }
    }

    g.fillStyle(skin.body, 1)
    g.fillEllipse(30, 12, 30, 18)

    if (skin.animated) {
      // 홀로그램 스킨: 몸통 위에 무지개 색 사선 띠를 겹쳐서 "빤짝거리는" 느낌을 낸다.
      // 실제 장착 중엔 update()에서 이 텍스처를 주기적으로 다시 그려서 띠가 흘러가게 한다.
      // 가장 비싼 스킨인 만큼 은은한 틴트가 아니라 확실히 눈에 띄게 진하고 촘촘하게.
      const stripeCount = 9
      for (let i = 0; i < stripeCount; i++) {
        const hue = ((this.holoHue || 0) + (i / stripeCount) * 360) % 360
        const rgb = Phaser.Display.Color.HSVToRGB(hue / 360, 0.75, 1)
        g.fillStyle(rgb.color, 0.7)
        const sx = 15 + (i / stripeCount) * 30
        g.fillTriangle(sx, 3, sx + 3, 3, sx - 3, 21)
      }
      // 몸통 위에 반짝이는 하이라이트 한 줄을 더 얹어 "정말 반짝인다"는 인상을 강조.
      const shineX = 16 + ((((this.holoHue || 0) / 360) * 40) % 40)
      g.fillStyle(0xffffff, 0.55)
      g.fillTriangle(shineX, 4, shineX + 2, 4, shineX - 2, 20)
    }

    g.fillStyle(skin.nose, 1)
    g.fillTriangle(42, 4, 42, 20, 54, 12)

    g.fillStyle(skin.fin, 1)
    g.fillTriangle(18, 2, 28, 10, 12, 10)
    g.fillTriangle(18, 22, 28, 14, 12, 14)

    g.fillStyle(0x4fc3f7, 1)
    g.fillCircle(28, 12, 5)
    g.lineStyle(1, 0x263238, 1)
    g.strokeCircle(28, 12, 5)

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
    }

    this.scoreText = this.add.text(GAME_WIDTH / 2, 40, '0', textStyle).setOrigin(0.5)

    // 처음 들어왔을 때 게임 이름을 명확하게 보여준다.
    this.titleText = this.add
      .text(GAME_WIDTH / 2, 100, 'CLOSE ROCKET', { ...textStyle, fontSize: '26px' })
      .setOrigin(0.5)
    this.subtitleText = this.add
      .text(GAME_WIDTH / 2, 130, '(아슬로켓)', { ...textStyle, fontSize: '15px' })
      .setOrigin(0.5)

    this.messageText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, '탭하거나 스페이스바를 눌러 시작', {
        ...textStyle,
        fontSize: '22px',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 60 },
      })
      .setOrigin(0.5)

    this.hintText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 10,
        '중력 방향이 계속 서서히 흘러가요\n벽에 닿으면 반대편으로 나와요\n🛡️💣 아이템은 클릭/탭으로 바로 획득!',
        {
          ...textStyle,
          fontSize: '14px',
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 60 },
        },
      )
      .setOrigin(0.5)

    this.subMessageText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, `최고 점수: ${this.bestScore}`, {
        ...textStyle,
        fontSize: '18px',
      })
      .setOrigin(0.5)

    this.streakText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 65,
        this.dailyStreak >= 2 ? `🔥 ${this.dailyStreak}일 연속 접속 중!` : '오늘 첫 도전, 내일도 또 오세요!',
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
      .text(GAME_WIDTH - 72, cornerY, `🛒 상점\n🪙 ${this.totalCoins}`, { ...textStyle, fontSize: '13px', align: 'center' })
      .setOrigin(0.5)

    this.manualButtonBg = this.add
      .rectangle(72, cornerY, cornerButtonW, cornerButtonH, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0xffe066)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.showManual())
    this.manualButtonBg.isUiButton = true
    this.manualButtonText = this.add
      .text(72, cornerY, '📖 게임 방법\n다시보기', { ...textStyle, fontSize: '13px', align: 'center' })
      .setOrigin(0.5)

    // 게임오버 화면 전용 "이어하기" 버튼. messageText 안에 힌트 문구로만 있으면 키보드가 없는
    // 모바일에서는 누를 방법이 없어서, 탭 가능한 별도 텍스트로 분리해둔다.
    this.continueButtonText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 95, '📺 광고 보고 이어하기', {
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
      .text(GAME_WIDTH / 2 - 45, GAME_HEIGHT / 2 + 130, '✅ 예', { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart({ autoStart: true }))
    this.restartYesText.isUiButton = true

    this.restartNoText = this.add
      .text(GAME_WIDTH / 2 + 45, GAME_HEIGHT / 2 + 130, '❌ 아니오', { ...textStyle, fontSize: '18px' })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart())
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
      .text(GAME_WIDTH / 2, 70, '📖 게임 방법', { ...textStyle, fontSize: '26px' })
      .setOrigin(0.5)
      .setVisible(false)

    this.manualBodyText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, MANUAL_TEXT, {
        ...textStyle,
        fontSize: '14px',
        align: 'left',
        lineSpacing: 6,
        wordWrap: { width: GAME_WIDTH - 40 },
      })
      .setOrigin(0.5)
      .setVisible(false)

    this.manualContinueText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 50, '👉 탭하거나 스페이스바를 눌러 시작', {
        ...textStyle,
        fontSize: '16px',
        color: '#ffe066',
      })
      .setOrigin(0.5)
      .setVisible(false)
  }

  showManual() {
    this.state = 'manual'
    this.messageText.setVisible(false)
    this.hintText.setVisible(false)
    this.subMessageText.setVisible(false)
    this.streakText.setVisible(false)
    this.titleText.setVisible(false)
    this.subtitleText.setVisible(false)
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)
    this.manualButtonBg.setVisible(false)
    this.manualButtonText.setVisible(false)
    this.manualTitleText.setVisible(true)
    this.manualBodyText.setVisible(true)
    this.manualContinueText.setVisible(true)
  }

  hideManual() {
    this.manualTitleText.setVisible(false)
    this.manualBodyText.setVisible(false)
    this.manualContinueText.setVisible(false)
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
        this.showManual()
      } else {
        this.startGame()
      }
    } else if (this.state === 'manual') {
      this.hasSeenManual = true
      localStorage.setItem(HAS_SEEN_MANUAL_KEY, 'true')
      this.hideManual()
      this.startGame()
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
    this.bird.body.allowGravity = true
    this.messageText.setVisible(false)
    this.hintText.setVisible(false)
    this.subMessageText.setVisible(false)
    this.streakText.setVisible(false)
    this.titleText.setVisible(false)
    this.subtitleText.setVisible(false)
    this.shopButtonBg.setVisible(false)
    this.shopButtonText.setVisible(false)
    this.manualButtonBg.setVisible(false)
    this.manualButtonText.setVisible(false)
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
    this.showAchievement(START_TIER_TEXT)
    const bonusPercent = this.getCollectionBonusPercent()
    if (bonusPercent > 0) {
      this.time.delayedCall(1800, () => {
        this.showAchievement(`🎁 세트 효과 발동! 아이템 획득 확률 ${bonusPercent}% 증가!`)
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
    // 화면상 아이콘(반지름 13px)보다 넉넉하게(+15px) 판정을 넓혀서 손가락 탭에서도 잘 잡히게 한다.
    icon.setInteractive(
      new Phaser.Geom.Circle(POWERUP_RADIUS, POWERUP_RADIUS, POWERUP_RADIUS + 15),
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
        this.showAchievement(`🛡️ 실드 가득참! (${MAX_SHIELD_STACK}/${MAX_SHIELD_STACK})`)
        return
      }
      this.playPowerupSound()
      this.shieldCount += 1
      this.shieldRing.setVisible(true)
      this.updateShieldDisplay()
      this.showAchievement(`🛡️ 실드 충전! (${this.shieldCount}/${MAX_SHIELD_STACK})`)
    } else {
      if (this.bombCount >= MAX_BOMB_STACK) {
        this.showAchievement(`💣 폭탄 가득참! (${MAX_BOMB_STACK}/${MAX_BOMB_STACK})`)
        return
      }
      this.playPowerupSound()
      this.bombCount += 1
      this.updateBombDisplay()
      this.showAchievement(`💣 폭탄 보관! (${this.bombCount}/${MAX_BOMB_STACK}) 탭해서 사용`)
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
        this.showAchievement('🎉 신기록 달성!')
      }
      if (this.score >= GALAXY_TIER_SCORE) this.activateGalaxyTier()
      this.checkAchievements()
      this.updateDifficultyFromScore()
    }

    this.showAchievement(`💣 폭탄! +${count}`)
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
          this.showAchievement('🎉 신기록 달성!')
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
    this.playExplosionSound()

    if (this.score > this.bestScore) {
      this.bestScore = this.score
      localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore))
    }

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
    this.messageText.setText('게임 오버\n다시 하시겠습니까?')
    this.messageText.setVisible(true)
    const avgScore = this.totalGamesPlayed > 0 ? Math.round(this.totalScoreSum / this.totalGamesPlayed) : 0
    this.subMessageText.setText(
      `점수: ${this.score}   최고 점수: ${this.bestScore}\n` +
        `🪙 획득: ${this.lastRunCoinsEarned}   보유: ${this.totalCoins}\n` +
        `아슬아슬: ${this.runNearMissCount}번   평균 점수: ${avgScore}`,
    )
    this.subMessageText.setVisible(true)
    this.continueButtonText.setVisible(!this.usedContinueThisRun)
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
  resolution: Math.min(window.devicePixelRatio || 1, 3),
  backgroundColor: '#050818',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: GameScene,
})
